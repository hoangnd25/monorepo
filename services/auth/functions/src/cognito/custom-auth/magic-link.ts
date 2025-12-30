/**
 * Magic Link authentication implementation
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

import type {
  CreateAuthChallengeTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';
import { createHash, createPublicKey, constants, createVerify } from 'crypto';
import {
  KMSClient,
  SignCommand,
  GetPublicKeyCommand,
} from '@aws-sdk/client-kms';
import {
  SESClient,
  SendEmailCommand,
  MessageRejected,
} from '@aws-sdk/client-ses';
import { Logger, UserFacingError } from '../common.js';
import {
  storeMagicLink,
  verifyAndConsumeMagicLink,
} from '../dynamodb/magic-link.js';

// ============================================================================
// Configuration
// ============================================================================

interface MagicLinkConfig {
  enabled: boolean;
  secondsUntilExpiry: number;
  minimumSecondsBetween: number;
  allowedOrigins: string[];
  sesFromAddress: string;
  sesRegion: string;
  kmsKeyId: string;
  dynamodbSecretsTableName: string;
  salt: string;
}

function getConfig(): MagicLinkConfig {
  return {
    enabled: process.env.MAGIC_LINK_ENABLED === 'TRUE',
    secondsUntilExpiry: Number(process.env.SECONDS_UNTIL_EXPIRY || 60 * 15),
    minimumSecondsBetween: Number(process.env.MIN_SECONDS_BETWEEN || 60),
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href).origin;
        } catch {
          return href;
        }
      }),
    sesFromAddress: process.env.SES_FROM_ADDRESS ?? '',
    sesRegion: process.env.SES_REGION || process.env.AWS_REGION || '',
    kmsKeyId: process.env.KMS_KEY_ID ?? '',
    dynamodbSecretsTableName: process.env.DYNAMODB_SECRETS_TABLE ?? '',
    salt: process.env.STACK_ID ?? '',
  };
}

// ============================================================================
// AWS SDK Clients
// ============================================================================

const kms = new KMSClient({});

// Cache for public keys
const publicKeys: Record<string, ReturnType<typeof createPublicKey>> = {};

// Lazy-initialized SES client (region-specific)
let sesClient: SESClient | undefined;

function getSesClient(region: string): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({ region });
  }
  return sesClient;
}

// ============================================================================
// Create Challenge
// ============================================================================

/**
 * Adds magic link challenge to the Cognito auth event
 */
export async function addChallengeToEvent(
  event: CreateAuthChallengeTriggerEvent,
  logger: Logger
): Promise<void> {
  const config = getConfig();

  if (!config.enabled) {
    throw new UserFacingError('Sign-in with Magic Link not supported');
  }

  event.response.challengeMetadata = 'MAGIC_LINK';
  const alreadyHaveMagicLink =
    event.request.clientMetadata?.alreadyHaveMagicLink;

  if (alreadyHaveMagicLink === 'yes') {
    logger.info('Client will use already obtained sign-in link');
    return;
  }

  logger.info('Client needs sign-in link');

  // Validate redirect URI
  const redirectUri = event.request.clientMetadata?.redirectUri;
  if (
    !redirectUri ||
    !config.allowedOrigins.includes(new URL(redirectUri).origin)
  ) {
    throw new UserFacingError(`Invalid redirectUri: ${redirectUri}`);
  }

  // Create and send magic link
  await createAndSendMagicLink(event, { redirectUri }, config, logger);

  // Handle user not found case
  if (event.request.userNotFound) {
    logger.info('User not found');
  }

  event.response.privateChallengeParameters = {
    challenge: 'PROVIDE_MAGIC_LINK',
  };
}

async function createAndSendMagicLink(
  event: CreateAuthChallengeTriggerEvent,
  { redirectUri }: { redirectUri: string },
  config: MagicLinkConfig,
  logger: Logger
): Promise<void> {
  logger.debug('Creating new magic link ...');

  const exp = Math.floor(Date.now() / 1000 + config.secondsUntilExpiry);
  const iat = Math.floor(Date.now() / 1000);

  // Create message payload
  const message = Buffer.from(
    JSON.stringify({
      userName: event.userName,
      iat,
      exp,
    })
  );

  // Create message context (for additional security)
  const messageContext = Buffer.from(
    JSON.stringify({
      userPoolId: event.userPoolId,
      clientId: event.callerContext.clientId,
    })
  );

  // Sign the message with KMS
  const { Signature: signature } = await kms.send(
    new SignCommand({
      KeyId: config.kmsKeyId,
      Message: createHash('sha512')
        .update(Buffer.concat([message, messageContext]))
        .digest(),
      SigningAlgorithm: 'RSASSA_PSS_SHA_512',
      MessageType: 'DIGEST',
    })
  );

  if (!signature) {
    throw new Error('Failed to create signature with KMS');
  }

  logger.debug('Storing magic link hash in DynamoDB ...');

  // Store hash in DynamoDB with rate limiting
  await storeMagicLink({
    userName: event.userName,
    signature: Buffer.from(signature),
    iat,
    exp,
    kmsKeyId: config.kmsKeyId,
    salt: config.salt,
    minimumSecondsBetween: config.minimumSecondsBetween,
    tableName: config.dynamodbSecretsTableName,
  });

  // Build the magic link URL
  const secretLoginLink = `${redirectUri}#${message.toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;

  logger.debug('Sending magic link ...');

  // Handle userNotFound case (if "Prevent user existence errors" is enabled)
  if (event.request.userNotFound) {
    logger.debug('Pretending to send magic link ...');
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
    return;
  }

  // Send the email
  await sendEmailWithLink(
    event.request.userAttributes.email,
    secretLoginLink,
    config,
    logger
  );
  logger.debug('Magic link sent!');
}

async function sendEmailWithLink(
  emailAddress: string,
  secretLoginLink: string,
  config: MagicLinkConfig,
  logger: Logger
): Promise<void> {
  const expiryMinutes = Math.floor(config.secondsUntilExpiry / 60);
  const ses = getSesClient(config.sesRegion);

  try {
    await ses.send(
      new SendEmailCommand({
        Destination: { ToAddresses: [emailAddress] },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Sign In to Your Account</h2>
                    <p>Click the link below to sign in. This link will expire in ${expiryMinutes} minutes.</p>
                    <p>
                      <a href="${secretLoginLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Sign In
                      </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">
                      If you didn't request this link, you can safely ignore this email.
                    </p>
                    <p style="color: #666; font-size: 12px;">
                      If the button doesn't work, copy and paste this link into your browser:<br/>
                      <a href="${secretLoginLink}">${secretLoginLink}</a>
                    </p>
                  </body>
                </html>
              `,
            },
            Text: {
              Charset: 'UTF-8',
              Data: `Sign in to your account by clicking this link: ${secretLoginLink}\n\nThis link is valid for ${expiryMinutes} minutes.\n\nIf you didn't request this link, you can safely ignore this email.`,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: 'Your Sign-In Link',
          },
        },
        Source: config.sesFromAddress,
      })
    );
  } catch (err) {
    if (
      err instanceof MessageRejected &&
      err.message.includes('Email address is not verified')
    ) {
      logger.error('SES email error', err);
      throw new UserFacingError(
        'E-mail address must still be verified in the e-mail service'
      );
    }
    throw err;
  }
}

// ============================================================================
// Verify Challenge
// ============================================================================

/**
 * Adds magic link verification result to the Cognito auth event
 */
export async function addChallengeVerificationResultToEvent(
  event: VerifyAuthChallengeResponseTriggerEvent,
  logger: Logger
): Promise<void> {
  const config = getConfig();

  logger.info('Verifying MagicLink Challenge Response ...');

  // Handle userNotFound case
  if (event.request.userNotFound) {
    logger.info('User not found');
  }

  if (!config.enabled) {
    throw new UserFacingError('Sign-in with Magic Link not supported');
  }

  // Skip verification if this is just the initial PROVIDE_AUTH_PARAMETERS step
  if (
    event.request.privateChallengeParameters.challenge ===
      'PROVIDE_AUTH_PARAMETERS' &&
    event.request.clientMetadata?.alreadyHaveMagicLink !== 'yes'
  ) {
    return;
  }

  event.response.answerCorrect = await verifyMagicLink(
    event.request.challengeAnswer,
    event.userName,
    {
      userPoolId: event.userPoolId,
      clientId: event.callerContext.clientId,
    },
    config,
    logger
  );
}

async function downloadPublicKey(
  kmsKeyId: string,
  logger: Logger
): Promise<ReturnType<typeof createPublicKey>> {
  logger.debug('Downloading KMS public key');
  const { PublicKey: publicKey } = await kms.send(
    new GetPublicKeyCommand({
      KeyId: kmsKeyId,
    })
  );

  if (!publicKey) {
    throw new Error('Failed to download public key from KMS');
  }

  return createPublicKey({
    key: publicKey as Buffer,
    format: 'der',
    type: 'spki',
  });
}

async function verifyMagicLink(
  magicLinkFragmentIdentifier: string,
  userName: string,
  context: { userPoolId: string; clientId: string },
  config: MagicLinkConfig,
  logger: Logger
): Promise<boolean> {
  logger.debug(
    `Verifying magic link fragment identifier: ${magicLinkFragmentIdentifier}`
  );

  const [messageB64, signatureB64] = magicLinkFragmentIdentifier.split('.');
  const signature = Buffer.from(signatureB64, 'base64url');

  // Read and consume item from DynamoDB
  const dbItem = await verifyAndConsumeMagicLink({
    userName,
    signature,
    salt: config.salt,
    tableName: config.dynamodbSecretsTableName,
  });

  if (!dbItem) {
    logger.error('Attempt to use invalid (potentially superseded) magic link');
    return false;
  }

  // Check if expired
  if (dbItem.exp < Date.now() / 1000) {
    logger.error('Magic link expired');
    return false;
  }

  // Get or download public key
  publicKeys[dbItem.kmsKeyId] ??= await downloadPublicKey(
    dbItem.kmsKeyId,
    logger
  );

  // Verify signature
  const verifier = createVerify('RSA-SHA512');
  const message = Buffer.from(messageB64, 'base64url');
  verifier.update(message);
  const messageContext = Buffer.from(JSON.stringify(context));
  verifier.update(messageContext);

  const valid = verifier.verify(
    {
      key: publicKeys[dbItem.kmsKeyId],
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    },
    signature
  );

  logger.debug(`Magic link signature is ${valid ? '' : 'NOT '}valid`);

  if (!valid) return false;

  // Parse and validate message content
  const parsed: unknown = JSON.parse(message.toString());
  assertIsMessage(parsed);
  logger.debug('Checking message:', parsed);

  if (parsed.userName !== userName) {
    logger.error('Username mismatch');
    return false;
  }

  if (parsed.exp !== dbItem.exp || parsed.iat !== dbItem.iat) {
    logger.error('State mismatch');
    return false;
  }

  return valid;
}

// ============================================================================
// Type Guards
// ============================================================================

function assertIsMessage(
  msg: unknown
): asserts msg is { userName: string; exp: number; iat: number } {
  if (
    !msg ||
    typeof msg !== 'object' ||
    !('userName' in msg) ||
    typeof msg.userName !== 'string' ||
    !('exp' in msg) ||
    typeof msg.exp !== 'number' ||
    !('iat' in msg) ||
    typeof msg.iat !== 'number'
  ) {
    throw new Error('Invalid magic link');
  }
}
