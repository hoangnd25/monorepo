/**
 * VerifyAuthChallengeResponse Lambda handler
 *
 * Verifies challenge responses for the custom authentication flow.
 * Delegates to specific auth method implementations based on clientMetadata.signInMethod.
 *
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

import type {
  VerifyAuthChallengeResponseTriggerEvent,
  VerifyAuthChallengeResponseTriggerHandler,
} from 'aws-lambda';
import { Logger, UserFacingError, isValidSignInMethod } from '../common.js';
import * as magicLink from '../custom-auth/magic-link.js';
import * as socialLogin from '../custom-auth/social-login.js';

const logger = new Logger();

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (
  event: VerifyAuthChallengeResponseTriggerEvent
) => {
  logger.debug('VerifyAuthChallengeResponse invoked', event);

  try {
    event.response.answerCorrect = false;

    const { signInMethod } = event.request.clientMetadata ?? {};

    if (isValidSignInMethod(signInMethod)) {
      await handleSignInMethod(event, signInMethod);
    }

    logger.debug('Response', event);
    logger.info(
      `Verification result, answerCorrect: ${event.response.answerCorrect}`
    );
    return event;
  } catch (err) {
    logger.error('VerifyAuthChallengeResponse error', err);
    if (err instanceof UserFacingError) throw err;
    throw new Error('Internal Server Error');
  }
};

/**
 * Dispatch to the appropriate auth method verification handler
 */
async function handleSignInMethod(
  event: VerifyAuthChallengeResponseTriggerEvent,
  signInMethod: 'MAGIC_LINK' | 'FIDO2' | 'SMS_OTP' | 'SOCIAL_LOGIN'
): Promise<void> {
  switch (signInMethod) {
    case 'MAGIC_LINK':
      await magicLink.addChallengeVerificationResultToEvent(event, logger);
      break;
    case 'SOCIAL_LOGIN':
      await socialLogin.addChallengeVerificationResultToEvent(event, logger);
      break;
    case 'FIDO2':
      await verifyFido2Response(event);
      break;
    case 'SMS_OTP':
      await verifySmsOtpResponse(event);
      break;
  }
}

/**
 * Verify FIDO2/WebAuthn challenge response
 * TODO: Implement when FIDO2 support is added
 */
async function verifyFido2Response(
  _event: VerifyAuthChallengeResponseTriggerEvent
): Promise<void> {
  throw new UserFacingError('FIDO2 authentication not yet implemented');
}

/**
 * Verify SMS OTP challenge response
 * TODO: Implement when SMS OTP support is added
 */
async function verifySmsOtpResponse(
  _event: VerifyAuthChallengeResponseTriggerEvent
): Promise<void> {
  throw new UserFacingError('SMS OTP authentication not yet implemented');
}
