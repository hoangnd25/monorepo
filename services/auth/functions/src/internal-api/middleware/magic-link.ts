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
 * Middleware that provides MagicLinkService in the context
 *
 * This middleware instantiates the MagicLinkService and adds it
 * to the ORPC context, making it available to all magic link handlers.
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
  return next({
    context: {
      magicLinkService: createMagicLinkService(),
    },
  });
});
