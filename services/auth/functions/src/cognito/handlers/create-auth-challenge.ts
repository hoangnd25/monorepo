/**
 * CreateAuthChallenge Lambda handler
 *
 * Creates challenges for the custom authentication flow.
 * Delegates to specific auth method implementations based on clientMetadata.signInMethod.
 *
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

import type {
  CreateAuthChallengeTriggerEvent,
  CreateAuthChallengeTriggerHandler,
} from 'aws-lambda';
import { Logger, UserFacingError, isValidSignInMethod } from '../common.js';
import * as magicLink from '../custom-auth/magic-link.js';

const logger = new Logger();

export const handler: CreateAuthChallengeTriggerHandler = async (
  event: CreateAuthChallengeTriggerEvent
) => {
  logger.debug('CreateAuthChallenge invoked', event);

  try {
    if (!event.request.session || !event.request.session.length) {
      // First time Create Auth Challenge is called - create dummy challenge
      // allowing user to send client metadata with auth parameters
      logger.info('Client has no session yet, starting one ...');
      await provideAuthParameters(event);
    } else {
      const { signInMethod } = event.request.clientMetadata ?? {};
      logger.info(`Client has requested signInMethod: ${signInMethod}`);

      if (!isValidSignInMethod(signInMethod)) {
        throw new Error(`Unrecognized signInMethod: ${signInMethod}`);
      }

      await handleSignInMethod(event, signInMethod);
    }

    logger.debug('Response', event);
    return event;
  } catch (err) {
    logger.error('CreateAuthChallenge error', err);
    if (err instanceof UserFacingError) throw err;
    throw new Error('Internal Server Error');
  }
};

/**
 * Initial challenge to collect auth parameters from client
 */
async function provideAuthParameters(
  event: CreateAuthChallengeTriggerEvent
): Promise<void> {
  logger.info('Creating challenge: PROVIDE_AUTH_PARAMETERS');
  event.response.challengeMetadata = 'PROVIDE_AUTH_PARAMETERS';
  const parameters: Record<string, string> = {
    challenge: 'PROVIDE_AUTH_PARAMETERS',
  };
  event.response.privateChallengeParameters = parameters;
  event.response.publicChallengeParameters = parameters;
}

/**
 * Dispatch to the appropriate auth method handler
 */
async function handleSignInMethod(
  event: CreateAuthChallengeTriggerEvent,
  signInMethod: 'MAGIC_LINK' | 'FIDO2' | 'SMS_OTP'
): Promise<void> {
  switch (signInMethod) {
    case 'MAGIC_LINK':
      await magicLink.addChallengeToEvent(event, logger);
      break;
    case 'FIDO2':
      await handleFido2Challenge(event);
      break;
    case 'SMS_OTP':
      await handleSmsOtpChallenge(event);
      break;
  }
}

/**
 * Handle FIDO2/WebAuthn challenge creation
 * TODO: Implement when FIDO2 support is added
 */
async function handleFido2Challenge(
  _event: CreateAuthChallengeTriggerEvent
): Promise<void> {
  throw new UserFacingError('FIDO2 authentication not yet implemented');
}

/**
 * Handle SMS OTP challenge creation
 * TODO: Implement when SMS OTP support is added
 */
async function handleSmsOtpChallenge(
  _event: CreateAuthChallengeTriggerEvent
): Promise<void> {
  throw new UserFacingError('SMS OTP authentication not yet implemented');
}
