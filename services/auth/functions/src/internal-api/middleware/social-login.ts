import { os } from '@orpc/server';
import type { SocialLoginService } from '../services/social-login.ts';
import { createSocialLoginService } from '../services/social-login.ts';

/**
 * Context extension for social login routes
 */
export interface SocialLoginContext {
  socialLoginService: SocialLoginService;
}

/**
 * Module-level cache for SocialLoginService instance
 *
 * This caches the service across requests within the same Lambda execution context.
 * The service is created once per Lambda warm start, avoiding redundant API calls.
 */
let cachedSocialLoginService: SocialLoginService | null = null;

/**
 * Middleware that provides SocialLoginService in the context
 *
 * This middleware instantiates the SocialLoginService and adds it
 * to the ORPC context, making it available to all social login handlers.
 *
 * The service instance is cached at the module level, so it's created once
 * per Lambda execution context and reused across multiple requests.
 *
 * Usage:
 * ```ts
 * const initiate = implement(contract.socialLogin.initiate)
 *   .use(withSocialLoginService)
 *   .handler(async ({ input, context }) => {
 *     return context.socialLoginService.initiate(input);
 *   });
 * ```
 */
export const withSocialLoginService = os.middleware(async ({ next }) => {
  // Create service if not already cached
  if (!cachedSocialLoginService) {
    cachedSocialLoginService = await createSocialLoginService();
  }

  return next({
    context: {
      socialLoginService: cachedSocialLoginService,
    },
  });
});
