import { os } from '@orpc/server';
import type { MagicLinkService } from '../services/magic-link.ts';
import { createMagicLinkService } from '../services/magic-link.ts';

/**
 * Context extension for magic link routes
 */
export interface MagicLinkContext {
  magicLinkService: MagicLinkService;
}

/**
 * Module-level cache for MagicLinkService instance
 *
 * This caches the service across requests within the same Lambda execution context.
 * The service is created once per Lambda warm start, avoiding redundant Cognito API calls.
 */
let cachedMagicLinkService: MagicLinkService | null = null;

/**
 * Middleware that provides MagicLinkService in the context
 *
 * This middleware instantiates the MagicLinkService and adds it
 * to the ORPC context, making it available to all magic link handlers.
 *
 * The service instance is cached at the module level, so it's created once
 * per Lambda execution context and reused across multiple requests.
 *
 * Usage:
 * ```ts
 * const initiate = implement(contract.magicLink.initiate)
 *   .use(withMagicLinkService)
 *   .handler(async ({ input, context }) => {
 *     return context.magicLinkService.initiate(input);
 *   });
 * ```
 */
export const withMagicLinkService = os.middleware(async ({ next }) => {
  // Create service if not already cached
  if (!cachedMagicLinkService) {
    cachedMagicLinkService = await createMagicLinkService();
  }

  return next({
    context: {
      magicLinkService: cachedMagicLinkService,
    },
  });
});
