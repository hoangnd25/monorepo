import { implement } from '@orpc/server';
import { contract } from '@contract/internal-api/auth';
import { withMagicLinkService } from './middleware/magic-link.ts';

// ============================================================================
// Procedures
// ============================================================================

/**
 * Implement the auth contract's getUser procedure
 */
const getUser = implement(contract.user.get).handler(async ({ input }) => {
  // TODO: Implement actual user lookup logic
  return {
    id: input.id,
    email: 'user@example.com',
  };
});

/**
 * Initiate magic link authentication flow
 *
 * Uses withMagicLinkService middleware to inject MagicLinkService into context
 */
const initiateMagicLink = implement(contract.magicLink.initiate)
  .use(withMagicLinkService)
  .handler(async ({ input, context }) => {
    return context.magicLinkService.initiate(input);
  });

/**
 * Complete magic link authentication flow
 *
 * Uses withMagicLinkService middleware to inject MagicLinkService into context
 */
const completeMagicLink = implement(contract.magicLink.complete)
  .use(withMagicLinkService)
  .handler(async ({ input, context }) => {
    return context.magicLinkService.complete(input);
  });

/**
 * Auth service internal API router implementing the contract
 */
export const router = {
  user: {
    get: getUser,
  },
  magicLink: {
    initiate: initiateMagicLink,
    complete: completeMagicLink,
  },
};

export type Router = typeof router;
