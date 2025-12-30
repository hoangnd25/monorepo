/**
 * PreSignUp Lambda handler
 *
 * Auto-confirms users when they sign up via passwordless auth flow.
 * This is used for all passwordless auth methods (Magic Link, FIDO2, SMS OTP).
 *
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

import type {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
} from 'aws-lambda';
import { Logger } from '../common.js';

const logger = new Logger();

export const handler: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent
) => {
  logger.info('Pre-signup: auto confirming user ...');
  logger.debug('PreSignUp invoked', event);

  event.response.autoConfirmUser = true;

  logger.debug('Response', event);
  return event;
};
