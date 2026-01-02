import { oc } from '@orpc/contract';
import * as z from 'zod';

const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
});

/**
 * Contract for getting user info by ID
 */
export const getUser = oc
  .route({ method: 'GET', path: '/users/{id}' })
  .input(UserSchema.pick({ id: true }))
  .output(UserSchema);

/**
 * Contract for initiating magic link authentication
 * Triggers Cognito custom auth flow to send magic link email
 */
export const initiateMagicLink = oc
  .route({ method: 'POST', path: '/magic-link/initiate' })
  .input(
    z.object({
      email: z.email('Invalid email address'),
      redirectUri: z.url('Invalid redirect URI'),
    })
  )
  .output(
    z.object({
      session: z.string(),
      message: z.string(),
    })
  );

/**
 * Contract for completing magic link authentication
 * Verifies the magic link and returns JWT tokens
 */
export const completeMagicLink = oc
  .route({ method: 'POST', path: '/magic-link/complete' })
  .input(
    z.object({
      session: z.string(),
      secret: z.string(),
    })
  )
  .output(
    z.object({
      accessToken: z.string(),
      idToken: z.string(),
      refreshToken: z.string(),
      expiresIn: z.number(),
      tokenType: z.string(),
    })
  );

/**
 * Internal API contract router
 */
export const contract = {
  user: {
    get: getUser,
  },
  magicLink: {
    initiate: initiateMagicLink,
    complete: completeMagicLink,
  },
};

export type Contract = typeof contract;
