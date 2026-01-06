import { describe, it, expect, vi } from 'vitest';

// Mock SST Config values
vi.stubEnv('SST_Secret_value_SOCIAL_GOOGLE_CLIENT_ID', 'google-client-id');
vi.stubEnv('SST_Secret_value_SOCIAL_GOOGLE_CLIENT_SECRET', 'google-secret');
vi.stubEnv('SST_APP', 'test-app');

describe('social-providers', async () => {
  const { getEnabledProviders } = await import('./social-providers.js');

  describe('getEnabledProviders', () => {
    it('should return only enabled providers', () => {
      const providers = getEnabledProviders();

      expect(providers.size).greaterThanOrEqual(1);
      expect(providers.has('google')).toBe(true);
    });

    it('should return complete runtime config for each provider', () => {
      const providers = getEnabledProviders();
      const google = providers.get('google');

      expect(google).toMatchObject({
        issuer: expect.any(String),
        scope: expect.any(String),
        clientId: 'google-client-id',
        clientSecret: 'google-secret',
      });
    });
  });
});
