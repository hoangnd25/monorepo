import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { calculateSecretHash } from '../utils/cognito.ts';

// ============================================================================
// Types
// ============================================================================

export interface MagicLinkConfig {
  userPoolId: string;
  clientId: string;
  clientSecret: string;
}

export interface InitiateMagicLinkInput {
  email: string;
  redirectUri: string;
}

export interface InitiateMagicLinkOutput {
  session: string;
  message: string;
}

export interface CompleteMagicLinkInput {
  session: string;
  secret: string;
  redirectUri?: string;
}

export interface CompleteMagicLinkOutput {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// ============================================================================
// Service
// ============================================================================

export class MagicLinkService {
  private cognito: CognitoIdentityProviderClient;
  private config: MagicLinkConfig;

  constructor(config: MagicLinkConfig) {
    this.config = config;
    this.cognito = new CognitoIdentityProviderClient({});
  }

  /**
   * Initiate magic link authentication flow
   *
   * This starts the Cognito custom auth flow and triggers the Lambda
   * to send a magic link email to the user.
   */
  async initiate(
    input: InitiateMagicLinkInput
  ): Promise<InitiateMagicLinkOutput> {
    const { email, redirectUri } = input;

    try {
      // Calculate SECRET_HASH for client authentication
      const secretHash = calculateSecretHash(
        email,
        this.config.clientId,
        this.config.clientSecret
      );

      // Step 1: InitiateAuth with CUSTOM_AUTH
      const initiateResponse = await this.cognito.send(
        new InitiateAuthCommand({
          ClientId: this.config.clientId,
          AuthFlow: 'CUSTOM_AUTH' as AuthFlowType,
          AuthParameters: {
            USERNAME: email,
            SECRET_HASH: secretHash,
          },
        })
      );

      if (!initiateResponse.Session) {
        throw new Error('Failed to initiate authentication');
      }

      // Step 2: Respond to PROVIDE_AUTH_PARAMETERS challenge
      const challengeResponse = await this.cognito.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.config.clientId,
          ChallengeName: 'CUSTOM_CHALLENGE',
          Session: initiateResponse.Session,
          ChallengeResponses: {
            USERNAME: email,
            ANSWER: '__dummy__',
            SECRET_HASH: secretHash,
          },
          ClientMetadata: {
            signInMethod: 'MAGIC_LINK',
            redirectUri,
            alreadyHaveMagicLink: 'no',
          },
        })
      );

      if (!challengeResponse.Session) {
        throw new Error('Failed to create magic link challenge');
      }

      return {
        session: challengeResponse.Session,
        message: 'Magic link sent to your email. Please check your inbox.',
      };
    } catch (error) {
      console.error('Error initiating magic link:', error);

      throw new Error('Failed to send magic link. Please try again.');
    }
  }

  /**
   * Complete magic link authentication flow
   *
   * This verifies the magic link secret and completes the authentication,
   * returning JWT tokens if successful.
   */
  async complete(
    input: CompleteMagicLinkInput & { redirectUri?: string }
  ): Promise<CompleteMagicLinkOutput> {
    const { session, secret, redirectUri } = input;

    try {
      // Extract email from session (we decode it from the secret's message part)
      const [messageB64] = secret.split('.');
      const message = JSON.parse(
        Buffer.from(messageB64, 'base64url').toString()
      );
      const email = message.userName;

      // Calculate SECRET_HASH
      const secretHash = calculateSecretHash(
        email,
        this.config.clientId,
        this.config.clientSecret
      );

      // Respond to the magic link challenge
      const response = await this.cognito.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.config.clientId,
          ChallengeName: 'CUSTOM_CHALLENGE',
          Session: session,
          ChallengeResponses: {
            USERNAME: email,
            ANSWER: secret,
            SECRET_HASH: secretHash,
          },
          ClientMetadata: {
            signInMethod: 'MAGIC_LINK',
            ...(redirectUri && { redirectUri }),
            alreadyHaveMagicLink: 'yes',
          },
        })
      );

      if (
        !response.AuthenticationResult?.AccessToken ||
        !response.AuthenticationResult?.IdToken ||
        !response.AuthenticationResult?.RefreshToken
      ) {
        throw new Error('Invalid magic link or session expired');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn ?? 3600,
        tokenType: response.AuthenticationResult.TokenType ?? 'Bearer',
      };
    } catch (error) {
      console.error('Error completing magic link:', error);
      throw new Error(
        'Invalid or expired magic link. Please request a new one.'
      );
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a MagicLinkService instance from environment variables
 */
export function createMagicLinkService(): MagicLinkService {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;

  if (!userPoolId || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, or COGNITO_CLIENT_SECRET'
    );
  }

  return new MagicLinkService({
    userPoolId,
    clientId,
    clientSecret,
  });
}
