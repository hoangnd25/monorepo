/**
 * Social Login Provider Configuration
 *
 * Centralized configuration for all supported social login providers.
 * This module is shared between:
 * - Internal API service (OAuth flow initiation and completion)
 * - Cognito triggers (ID token verification)
 *
 * To add a new provider:
 * 1. Add the provider to the SocialProvider type
 * 2. Add configuration to SOCIAL_PROVIDERS (including clientId/clientSecret getters)
 * 3. Add SST Config secrets in sst-env.d.ts
 */

import { Config } from 'sst/node/config';

// ============================================================================
// Types
// ============================================================================

export type SocialProvider = 'google' | 'apple' | 'microsoft' | 'facebook';

/**
 * Configuration for a social provider with credential getters
 */
export interface ProviderConfig {
  /** OpenID Connect issuer URL */
  issuer: string;
  /** JWKS URI for token verification */
  jwksUri?: string;
  /** OAuth scopes to request */
  scope: string;
  /** Get OAuth Client ID from SST Config */
  clientId: () => string;
  /** Get OAuth Client Secret from SST Config */
  clientSecret: () => string;
}

/**
 * Runtime configuration for an enabled provider (resolved credentials)
 */
export interface ProviderRuntimeConfig {
  issuer: string;
  jwksUri?: string;
  scope: string;
  clientId: string;
  clientSecret: string;
}

// ============================================================================
// Provider Configuration Registry
// ============================================================================

/**
 * Value indicating a provider is disabled
 */
const PROVIDER_DISABLED_VALUE = 'NA';

/**
 * All supported social providers with their configuration
 *
 * Each provider includes:
 * - Static OIDC configuration (issuer, jwksUri, scope)
 * - Credential getters that read from SST Config at runtime
 */
const SOCIAL_PROVIDERS: Partial<Record<SocialProvider, ProviderConfig>> = {
  google: {
    issuer: 'https://accounts.google.com',
    scope: 'openid email profile',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    clientId: () => Config.SOCIAL_GOOGLE_CLIENT_ID,
    clientSecret: () => Config.SOCIAL_GOOGLE_CLIENT_SECRET,
  },
};

/**
 * List of all provider names
 */
const ALL_PROVIDERS = Object.keys(SOCIAL_PROVIDERS) as SocialProvider[];

// ============================================================================
// Credential Helpers
// ============================================================================

/**
 * Safely get credentials for a provider, returning null if disabled
 */
function getProviderCredentials(
  provider: SocialProvider
): { clientId: string; clientSecret: string } | null {
  const config = SOCIAL_PROVIDERS[provider];

  const clientId = config?.clientId();

  // Provider is disabled if clientId is missing or set to "NA"
  if (!clientId || clientId === PROVIDER_DISABLED_VALUE) {
    return null;
  }

  const clientSecret = config?.clientSecret();

  if (!clientSecret) {
    console.warn(
      `Provider ${provider} has CLIENT_ID but missing CLIENT_SECRET`
    );
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Get runtime configuration for all enabled providers
 */
export function getEnabledProviders(): Map<
  SocialProvider,
  ProviderRuntimeConfig
> {
  const enabled = new Map<SocialProvider, ProviderRuntimeConfig>();

  for (const provider of ALL_PROVIDERS) {
    const credentials = getProviderCredentials(provider);
    if (credentials) {
      const config = SOCIAL_PROVIDERS[provider];
      if (config) {
        enabled.set(provider, {
          issuer: config.issuer,
          jwksUri: config.jwksUri,
          scope: config.scope,
          ...credentials,
        });
      }
    }
  }

  return enabled;
}
