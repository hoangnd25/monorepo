import { describe, it, expect } from 'vitest';
import { calculateSecretHash } from './cognito.ts';

describe('cognito utils', () => {
  describe('calculateSecretHash', () => {
    it('should calculate correct secret hash', () => {
      const username = 'test@example.com';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const hash = calculateSecretHash(username, clientId, clientSecret);

      // Verify it returns a base64 string
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should generate different hashes for different usernames', () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const hash1 = calculateSecretHash(
        'user1@example.com',
        clientId,
        clientSecret
      );
      const hash2 = calculateSecretHash(
        'user2@example.com',
        clientId,
        clientSecret
      );

      expect(hash1).not.toBe(hash2);
    });

    it('should generate the same hash for the same inputs', () => {
      const username = 'test@example.com';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const hash1 = calculateSecretHash(username, clientId, clientSecret);
      const hash2 = calculateSecretHash(username, clientId, clientSecret);

      expect(hash1).toBe(hash2);
    });
  });
});
