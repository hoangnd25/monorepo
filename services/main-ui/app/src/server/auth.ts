/**
 * Server-side authentication functions for magic link flow
 *
 * These functions run on the server and call the auth service internal API
 * using IAM-signed requests.
 */

import { createServerFn } from '@tanstack/react-start';
import { useSession } from '@tanstack/react-start/server';
import { authClient } from '~/internal-api/auth';

// Session configuration for magic link flow
const sessionConfig = {
  password:
    process.env.SESSION_SECRET ||
    'change-me-in-production-to-a-secure-random-string-at-least-32-chars-long',
};

type MagicLinkSessionData = {
  cognitoSession?: string;
  redirectPath?: string;
};

/**
 * Server function to initiate magic link authentication
 *
 * Stores session data in encrypted session cookie.
 */
export const initiateMagicLink = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { email: string; redirectUri: string; redirectPath?: string }) =>
      data
  )
  .handler(async ({ data }) => {
    try {
      const response = await authClient.magicLink.initiate({
        email: data.email,
        redirectUri: data.redirectUri,
      });

      // Store session data in encrypted session cookie
      const session = await useSession<MagicLinkSessionData>(sessionConfig);
      await session.update({
        cognitoSession: response.session,
        redirectPath: data.redirectPath || '/',
      });

      return {
        success: true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error initiating magic link:', JSON.stringify(error));
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send magic link. Please try again.',
      };
    }
  });

/**
 * Server function to complete magic link authentication
 *
 * Reads session from encrypted session cookie (same-browser) or accepts session parameter
 * (cross-browser). Clears session after successful authentication.
 */
export const completeMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((data: { session?: string; secret: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Get session from encrypted cookie or parameter
      const session = await useSession<MagicLinkSessionData>(sessionConfig);
      const cognitoSession = data.session || session.data.cognitoSession;

      if (!cognitoSession) {
        return {
          success: false,
          error: 'No session found. Please request a new magic link.',
        };
      }

      const response = await authClient.magicLink.complete({
        session: cognitoSession,
        secret: data.secret,
      });

      // Clear session after successful authentication (one-time use)
      await session.clear();

      return {
        success: true,
        tokens: {
          accessToken: response.accessToken,
          idToken: response.idToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
          tokenType: response.tokenType,
        },
      };
    } catch (error) {
      console.error('Error completing magic link:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Invalid or expired magic link. Please request a new one.',
      };
    }
  });

/**
 * Server function to get the redirect path from session
 *
 * Used by callback route to determine where to redirect after authentication.
 */
export const getRedirectPath = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useSession<MagicLinkSessionData>(sessionConfig);
    return session.data.redirectPath || '/';
  }
);
