/**
 * Social Login authentication implementation
 *
 * Validates social provider ID tokens (Google, Apple, Microsoft) using aws-jwt-verify.
 * This module is used by the VerifyAuthChallengeResponse Cognito trigger
 * to validate ID tokens received from social OAuth providers.
 *
 * Provider configuration is managed via SST Config (SSM Parameter Store).
 * See shared/social-providers.ts for the centralized provider configuration.
 */

import { JwtVerifier } from 'aws-jwt-verify';
import { SimpleJwksCache } from 'aws-jwt-verify/jwk';
import { SimpleFetcher } from 'aws-jwt-verify/https';
import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';
import { Logger, UserFacingError } from '../common.js';
import {
  type SocialProvider,
  getEnabledProviders,
} from '../../shared/social-providers.js';

// ============================================================================
// Types
// ============================================================================

interface ProviderVerifyConfig {
  clientId: string;
  issuer: string;
  jwksUri?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Cache for configuration to avoid repeated lookups
 */
let cachedConfig: Map<SocialProvider, ProviderVerifyConfig> | null = null;

/**
 * Load enabled provider configurations for token verification.
 */
function getEnabledConfigs(): Map<SocialProvider, ProviderVerifyConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = getEnabledProviders();
  return cachedConfig;
}

// ============================================================================
// JWT Verifier Cache
// ============================================================================

/**
 * Cache for JWT verifiers by provider and client ID.
 */
const verifierCache = new Map<
  string,
  ReturnType<typeof JwtVerifier.create<{ issuer: string; audience: string }>>
>();

const jwksCache = new SimpleJwksCache({
  fetcher: new SimpleFetcher({
    defaultRequestOptions: {
      responseTimeout: 5000,
    },
  }),
});

/**
 * Get or create a JWT verifier for a specific provider
 */
function getVerifier(provider: SocialProvider, config: ProviderVerifyConfig) {
  const cacheKey = `${provider}:${config.clientId}`;

  const cached = verifierCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const verifier = JwtVerifier.create(
    {
      issuer: config.issuer,
      audience: config.clientId,
      jwksUri: config.jwksUri,
      graceSeconds: 3,
    },
    { jwksCache }
  );

  verifierCache.set(cacheKey, verifier);
  return verifier;
}

// ============================================================================
// Verify Challenge
// ============================================================================

/**
 * Adds social login verification result to the Cognito auth event.
 *
 * The challenge answer is expected to be a raw ID token (JWT) from the
 * social provider. This function validates the token signature and claims.
 */
export async function addChallengeVerificationResultToEvent(
  event: VerifyAuthChallengeResponseTriggerEvent,
  logger: Logger
): Promise<void> {
  const providers = getEnabledConfigs();

  logger.info('Verifying Social Login Challenge Response ...');

  // Check if any provider is enabled
  if (providers.size === 0) {
    throw new UserFacingError(
      'Social login not supported - no providers are enabled'
    );
  }

  // The ANSWER is the raw social provider ID token (JWT)
  const idToken = event.request.challengeAnswer;
  const provider = event.request.clientMetadata?.socialProvider as
    | SocialProvider
    | undefined;

  if (!provider) {
    throw new UserFacingError('Missing socialProvider in clientMetadata');
  }

  // Check if the requested provider is enabled
  const providerConfig = providers.get(provider);
  if (!providerConfig) {
    throw new UserFacingError(`Social provider ${provider} is not enabled`);
  }

  const email = event.request.userAttributes.email;

  event.response.answerCorrect = await verifyIdToken(
    provider,
    idToken,
    email,
    providerConfig,
    logger
  );
}

// ============================================================================
// ID Token Verification
// ============================================================================

/**
 * Verify a social provider ID token using aws-jwt-verify.
 *
 * Validates:
 * - Token signature (using provider's JWKS)
 * - Token expiration
 * - Issuer
 * - Audience (our OAuth Client ID)
 * - Email claim matches expected username
 * - Email is verified (if provider supports it)
 */
async function verifyIdToken(
  provider: SocialProvider,
  idToken: string,
  expectedEmail: string,
  config: ProviderVerifyConfig,
  logger: Logger
): Promise<boolean> {
  try {
    if (!idToken) {
      logger.error('Empty ID token provided');
      return false;
    }

    logger.info(`Verifying ${provider} ID token...`);

    const verifier = getVerifier(provider, config);
    const payload = await verifier.verify(idToken);

    // Validate email claim exists
    const email = payload.email as string | undefined;
    if (!email) {
      logger.error(`Missing email claim in ${provider} ID token`);
      return false;
    }

    // Validate email matches the Cognito username
    if (email.toLowerCase() !== expectedEmail.toLowerCase()) {
      logger.error(
        `Email mismatch: token email=${email}, expected=${expectedEmail}`
      );
      return false;
    }

    // Validate email is verified (if provider supports it)
    // Note: Apple doesn't always include email_verified
    const emailVerified = payload.email_verified as boolean | undefined;
    if (emailVerified === false) {
      logger.error(`Email not verified in ${provider} ID token`);
      return false;
    }

    logger.info(`${provider} ID token verified successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to verify ${provider} ID token`, error);
    return false;
  }
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Reset cached configuration (for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
