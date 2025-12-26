import { describe, expect, test } from 'vitest';
import { mainHostedZone } from './dns.ts';
import { AWS_ACCOUNTS, MAIN_HOSTED_ZONES } from './constants.ts';
import { StackContext } from 'sst/constructs';

describe('dns helpers', () => {
  describe('mainHostedZone', () => {
    test('should return dev hosted zone for dev account', () => {
      const mockContext = {
        app: { account: AWS_ACCOUNTS.DEV },
      } as StackContext;

      const result = mainHostedZone(mockContext);

      expect(result).toBe(MAIN_HOSTED_ZONES.DEV);
    });

    test('should return prod hosted zone for prod account', () => {
      const mockContext = {
        app: { account: AWS_ACCOUNTS.PROD },
      } as StackContext;

      const result = mainHostedZone(mockContext);

      expect(result).toBe(MAIN_HOSTED_ZONES.PROD);
    });

    test('should throw error for unknown account', () => {
      const unknownAccount = 'unknown-account-id';
      const mockContext = {
        app: { account: unknownAccount },
      } as StackContext;

      expect(() => mainHostedZone(mockContext)).toThrowError(
        `Unable to get main hosted zone for account ${unknownAccount}`
      );
    });
  });
});
