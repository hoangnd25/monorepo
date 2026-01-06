/**
 * Server-side authentication functions for magic link and social login flows
 *
 * These functions run on the server and call the auth service internal API
 * using IAM-signed requests.
 */

import { createServerFn } from '@tanstack/react-start';
import { useSession } from '@tanstack/react-start/server';
import * as client from 'openid-client';
import type { SocialProvider } from '@contract/internal-api/auth';
import { authClient } from '~/internal-api/auth';

// Session configuration for magic link flow
const sessionConfig = {
  password:
    process.env.SESSION_SECRET ||
    'change-me-in-production-to-a-secure-random-string-at-least-32-chars-long',
};

type AuthTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

type SocialLoginSession = {
  state: string;
  codeVerifier: string;
  provider: SocialProvider;
  redirectUri: string;
};

type SessionData = {
  cognitoSession?: string;
  redirectPath?: string;
  authTokens?: AuthTokens;
  socialLogin?: SocialLoginSession;
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
      const session = await useSession<SessionData>(sessionConfig);
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
 * Server function to get the redirect path from session
 *
 * Used by callback route to determine where to redirect after authentication.
 */
export const getRedirectPath = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useSession<SessionData>(sessionConfig);
    return session.data.redirectPath || '/';
  }
);

/**
 * Server function to process magic link callback
 *
 * Handles the entire magic link completion flow:
 * 1. Parses the hash to extract email (for cross-browser fallback)
 * 2. Attempts completion with session from HttpOnly cookie
 * 3. Handles cross-browser case by re-initiating auth if no session
 * 4. Stores tokens in session on success
 *
 * @param hash - The URL hash fragment (without #) containing the magic link secret
 * @param redirectUri - The redirect URI for cross-browser fallback (e.g., https://example.com/auth/magic-link)
 */
export const processMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((data: { hash: string; redirectUri: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Validate hash exists
      if (!data.hash) {
        return {
          success: false as const,
          error: 'No magic link data found in URL',
        };
      }

      // Parse hash to extract email (for cross-browser fallback)
      let email: string;
      try {
        const [messageB64] = data.hash.split('.');
        const message = JSON.parse(
          Buffer.from(messageB64, 'base64url').toString()
        );
        email = message.userName;
      } catch {
        return { success: false as const, error: 'Invalid magic link format' };
      }

      // Get session
      const session = await useSession<SessionData>(sessionConfig);
      let cognitoSession = session.data.cognitoSession;

      // Handle cross-browser case (no session cookie exists)
      if (!cognitoSession) {
        try {
          const initiateResponse = await authClient.magicLink.initiate({
            email,
            redirectUri: data.redirectUri,
          });
          cognitoSession = initiateResponse.session;
        } catch {
          return {
            success: false as const,
            error: 'Failed to initiate authentication session',
          };
        }
      }

      // Complete magic link authentication
      const response = await authClient.magicLink.complete({
        session: cognitoSession,
        secret: data.hash,
      });

      // Store tokens in session & clear auth session data
      const redirectPath = session.data.redirectPath || '/';
      await session.update({
        cognitoSession: undefined,
        redirectPath: undefined,
        authTokens: {
          accessToken: response.accessToken,
          idToken: response.idToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
          tokenType: response.tokenType,
        },
      });

      return { success: true as const, redirectPath };
    } catch (error) {
      console.error('Error processing magic link:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Invalid or expired magic link. Please request a new one.',
      };
    }
  });

/**
 * Server function to get auth tokens from session
 *
 * Used by the app to retrieve stored authentication tokens.
 */
export const getAuthTokens = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useSession<SessionData>(sessionConfig);
    return session.data.authTokens || null;
  }
);

// ============================================================================
// Social Login Server Functions
// ============================================================================

/**
 * Server function to initiate social login authentication
 *
 * Generates PKCE code verifier/challenge, calls auth service to get OAuth URL,
 * and stores PKCE state in session cookie.
 *
 * @param provider - The social provider to use (e.g., 'google')
 * @param redirectUri - The redirect URI for OAuth callback (where provider redirects back to)
 * @param redirectPath - Path to redirect to after successful login
 * @returns authUrl to redirect the user to, or error
 */
export const initiateSocialLogin = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      provider: SocialProvider;
      redirectUri: string;
      redirectPath?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      // Generate PKCE code verifier and challenge
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge =
        await client.calculatePKCECodeChallenge(codeVerifier);

      // Call auth service to get OAuth authorization URL
      const response = await authClient.socialLogin.initiate({
        provider: data.provider,
        redirectUri: data.redirectUri,
        codeChallenge,
      });

      // Store PKCE state and redirectUri in session cookie
      const session = await useSession<SessionData>(sessionConfig);
      await session.update({
        ...session.data,
        socialLogin: {
          state: response.state,
          codeVerifier,
          provider: data.provider,
          redirectUri: data.redirectUri,
        },
        redirectPath: data.redirectPath || '/',
      });

      return {
        success: true as const,
        authUrl: response.authUrl,
      };
    } catch (error) {
      console.error('Error initiating social login:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initiate social login. Please try again.',
      };
    }
  });

/**
 * Server function to process social login callback
 *
 * Verifies state, exchanges authorization code for tokens via auth service,
 * and stores tokens in session.
 *
 * @param code - Authorization code from OAuth callback
 * @param state - State parameter from OAuth callback (for CSRF validation)
 * @returns Success with redirect path, or error
 */
export const processSocialCallback = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Get session with stored PKCE state
      const session = await useSession<SessionData>(sessionConfig);
      const { socialLogin, redirectPath } = session.data;

      // Validate state (CSRF protection)
      if (!socialLogin?.state || socialLogin.state !== data.state) {
        return {
          success: false as const,
          error: 'Invalid state parameter. Please try logging in again.',
        };
      }

      // Call auth service to complete social login
      const response = await authClient.socialLogin.complete({
        provider: socialLogin.provider,
        code: data.code,
        state: data.state,
        codeVerifier: socialLogin.codeVerifier,
        redirectUri: socialLogin.redirectUri,
      });

      // Store tokens and clear social login session data
      await session.update({
        cognitoSession: undefined,
        redirectPath: undefined,
        socialLogin: undefined,
        authTokens: {
          accessToken: response.accessToken,
          idToken: response.idToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
          tokenType: response.tokenType,
        },
      });

      return { success: true as const, redirectPath: redirectPath || '/' };
    } catch (error) {
      console.error('Error processing social callback:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to complete social login. Please try again.',
      };
    }
  });
