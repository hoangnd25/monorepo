/**
 * Cognito Config Query - On-demand query for Cognito configuration
 *
 * Fetches Cognito User Pool ID and Client ID from SSM via ServiceConfig bindings.
 *
 * This enables:
 * - On-demand fetching: Config is fetched only when login form is shown
 * - Caching: Config is cached with staleTime: Infinity (fetched once)
 * - Local dev support: SST fetches values from SSM at runtime
 *
 * The config is fetched via useQuery (not useSuspenseQuery) to avoid suspending
 * inside Dialogs which interferes with Zag.js DOM reference management.
 */

import { getCognitoConfig } from '~/server/auth';

export const COGNITO_CONFIG_QUERY_KEY = ['cognito', 'config'] as const;

export type CognitoConfig = {
  userPoolId: string | null;
  clientId: string | null;
};

/**
 * Query options for Cognito config
 *
 * Used with useQuery in useCognitoContextData hook.
 * The config never changes at runtime, so we use staleTime: Infinity.
 */
export const cognitoConfigQueryOptions = {
  queryKey: COGNITO_CONFIG_QUERY_KEY,
  queryFn: getCognitoConfig,
  // Config is static - never refetch automatically
  staleTime: Infinity,
  // Cache forever - config doesn't change during session
  gcTime: Infinity,
};
