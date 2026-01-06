/**
 * DefineAuthChallenge Lambda handler
 *
 * Orchestrates the custom authentication flow for various sign-in methods.
 * This handler supports multiple auth methods (Magic Link, FIDO2, SMS OTP)
 * based on clientMetadata.signInMethod.
 *
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

import type {
  DefineAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerHandler,
} from 'aws-lambda';
import { Logger, isValidSignInMethod, type SignInMethod } from '../common.js';

const logger = new Logger();

export const handler: DefineAuthChallengeTriggerHandler = async (
  event: DefineAuthChallengeTriggerEvent
) => {
  logger.debug('DefineAuthChallenge invoked', event);

  // No session yet - start a new auth flow
  if (!event.request.session.length) {
    logger.info('No session yet, starting one ...');
    return customChallenge(event);
  }

  // We only accept custom challenges
  if (
    event.request.session.find(
      (attempt) => attempt.challengeName !== 'CUSTOM_CHALLENGE'
    )
  ) {
    return deny(event, 'Expected CUSTOM_CHALLENGE');
  }

  const { signInMethod } = event.request.clientMetadata ?? {};
  logger.info(
    `Requested signInMethod: ${signInMethod} (attempt: ${countAttempts(event)})`
  );

  if (!isValidSignInMethod(signInMethod)) {
    return deny(event, `Unrecognized signInMethod: ${signInMethod}`);
  }

  return handleSignInMethod(event, signInMethod);
};

/**
 * Handle different sign-in methods
 */
function handleSignInMethod(
  event: DefineAuthChallengeTriggerEvent,
  signInMethod: SignInMethod
): DefineAuthChallengeTriggerEvent {
  switch (signInMethod) {
    case 'MAGIC_LINK':
      return handleMagicLinkResponse(event);
    case 'FIDO2':
      return handleFido2Response(event);
    case 'SMS_OTP':
      return handleSmsOtpResponse(event);
    case 'SOCIAL_LOGIN':
      return handleSocialLoginResponse(event);
    default:
      return deny(event, `Unrecognized signInMethod: ${signInMethod}`);
  }
}

/**
 * Handle Magic Link authentication response
 */
function handleMagicLinkResponse(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  logger.info('Checking Magic Link Auth ...');
  const { alreadyHaveMagicLink } = event.request.clientMetadata ?? {};
  const lastResponse = event.request.session.slice(-1)[0];

  if (lastResponse.challengeResult === true) {
    return allow(event);
  } else if (alreadyHaveMagicLink !== 'yes' && countAttempts(event) === 0) {
    logger.info('No magic link yet, creating one');
    return customChallenge(event);
  }

  return deny(event, 'Failed to authenticate with Magic Link');
}

/**
 * Handle FIDO2/WebAuthn authentication response
 * TODO: Implement when FIDO2 support is added
 */
function handleFido2Response(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  logger.info('Checking FIDO2 Auth ...');
  // Placeholder for FIDO2 implementation
  return deny(event, 'FIDO2 authentication not yet implemented');
}

/**
 * Handle SMS OTP authentication response
 * TODO: Implement when SMS OTP support is added
 */
function handleSmsOtpResponse(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  logger.info('Checking SMS OTP Auth ...');
  // Placeholder for SMS OTP implementation
  return deny(event, 'SMS OTP authentication not yet implemented');
}

/**
 * Handle Social Login authentication response
 *
 * Social login follows a two-step flow similar to magic link:
 * 1. First call: Create a challenge to accept the ID token
 * 2. Second call: Check if verification was successful
 *
 * The auth service exchanges the OAuth code for an ID token with the provider,
 * then sends that ID token as the challenge answer. The VerifyAuthChallengeResponse
 * trigger validates the ID token signature and claims.
 */
function handleSocialLoginResponse(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  logger.info('Checking Social Login Auth ...');
  const lastResponse = event.request.session.slice(-1)[0];

  // Check if the ID token verification was successful
  if (lastResponse?.challengeResult === true) {
    return allow(event);
  } else if (countAttempts(event) === 0) {
    // First attempt - create challenge to accept the social ID token
    logger.info('Creating social login challenge');
    return customChallenge(event);
  }

  return deny(event, 'Failed to authenticate with Social Login');
}

function deny(
  event: DefineAuthChallengeTriggerEvent,
  reason: string
): DefineAuthChallengeTriggerEvent {
  logger.info(`Failing authentication because: ${reason}`);
  event.response.issueTokens = false;
  event.response.failAuthentication = true;
  logger.debug('Response', event);
  return event;
}

function allow(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  logger.info('Authentication successful');
  event.response.issueTokens = true;
  event.response.failAuthentication = false;
  logger.debug('Response', event);
  return event;
}

function customChallenge(
  event: DefineAuthChallengeTriggerEvent
): DefineAuthChallengeTriggerEvent {
  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = 'CUSTOM_CHALLENGE';
  logger.info('Next step: CUSTOM_CHALLENGE');
  logger.debug('Response', event);
  return event;
}

function countAttempts(
  event: DefineAuthChallengeTriggerEvent,
  excludeProvideAuthParameters = true
): number {
  if (!excludeProvideAuthParameters) return event.request.session.length;
  return event.request.session.filter(
    (entry) => entry.challengeMetadata !== 'PROVIDE_AUTH_PARAMETERS'
  ).length;
}
