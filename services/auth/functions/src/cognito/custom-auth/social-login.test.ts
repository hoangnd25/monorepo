import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';
import { Logger, UserFacingError } from '../common.js';

// Mock SST Config values
vi.stubEnv('SST_Secret_value_SOCIAL_GOOGLE_CLIENT_ID', 'google-client-id');
vi.stubEnv('SST_Secret_value_SOCIAL_GOOGLE_CLIENT_SECRET', 'google-secret');
vi.stubEnv('SST_APP', 'test-app');

// Mock aws-jwt-verify
const mockVerify = vi.fn();
vi.mock('aws-jwt-verify', () => ({
  JwtVerifier: {
    create: vi.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

vi.mock('aws-jwt-verify/jwk', () => ({
  SimpleJwksCache: vi.fn(),
}));

vi.mock('aws-jwt-verify/https', () => ({
  SimpleFetcher: vi.fn(),
}));

describe('social-login', async () => {
  const { addChallengeVerificationResultToEvent, resetConfigCache } =
    await import('./social-login.js');

  const createMockLogger = (): Logger =>
    ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }) as unknown as Logger;

  const createMockEvent = (
    overrides: Partial<VerifyAuthChallengeResponseTriggerEvent> = {}
  ): VerifyAuthChallengeResponseTriggerEvent => ({
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_test',
    userName: 'test@example.com',
    callerContext: {
      awsSdkVersion: '1.0',
      clientId: 'test-client',
    },
    triggerSource: 'VerifyAuthChallengeResponse_Authentication',
    request: {
      userAttributes: {
        email: 'test@example.com',
      },
      privateChallengeParameters: {},
      challengeAnswer: 'mock-id-token',
      clientMetadata: {
        signInMethod: 'SOCIAL_LOGIN',
        socialProvider: 'google',
      },
      ...overrides.request,
    },
    response: {
      answerCorrect: false,
      ...overrides.response,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigCache();
  });

  describe('addChallengeVerificationResultToEvent', () => {
    it('should verify valid Google ID token successfully', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        email: 'test@example.com',
        email_verified: true,
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Verifying Social Login Challenge Response ...'
      );
    });

    it('should fail when socialProvider is missing', async () => {
      const event = createMockEvent({
        request: {
          userAttributes: {},
          privateChallengeParameters: {},
          challengeAnswer: 'mock-token',
          clientMetadata: {
            signInMethod: 'SOCIAL_LOGIN',
            // socialProvider is missing
          },
        },
      });
      const logger = createMockLogger();

      await expect(
        addChallengeVerificationResultToEvent(event, logger)
      ).rejects.toThrow(UserFacingError);

      await expect(
        addChallengeVerificationResultToEvent(event, logger)
      ).rejects.toThrow('Missing socialProvider in clientMetadata');
    });

    it('should fail when provider is disabled', async () => {
      const event = createMockEvent({
        request: {
          userAttributes: {},
          privateChallengeParameters: {},
          challengeAnswer: 'mock-token',
          clientMetadata: {
            signInMethod: 'SOCIAL_LOGIN',
            socialProvider: 'apple', // Apple is disabled (NA)
          },
        },
      });
      const logger = createMockLogger();

      await expect(
        addChallengeVerificationResultToEvent(event, logger)
      ).rejects.toThrow(UserFacingError);

      await expect(
        addChallengeVerificationResultToEvent(event, logger)
      ).rejects.toThrow('Social provider apple is not enabled');
    });

    it('should fail when ID token is empty', async () => {
      const event = createMockEvent({
        request: {
          userAttributes: {},
          privateChallengeParameters: {},
          challengeAnswer: '',
          clientMetadata: {
            signInMethod: 'SOCIAL_LOGIN',
            socialProvider: 'google',
          },
        },
      });
      const logger = createMockLogger();

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Empty ID token provided');
    });

    it('should fail when email claim is missing', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        // no email claim
        email_verified: true,
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Missing email claim in google ID token'
      );
    });

    it('should fail when email does not match expected username', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        email: 'different@example.com',
        email_verified: true,
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Email mismatch: token email=different@example.com, expected=test@example.com'
      );
    });

    it('should fail when email is not verified', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        email: 'test@example.com',
        email_verified: false,
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Email not verified in google ID token'
      );
    });

    it('should succeed when email_verified is undefined (e.g., Apple)', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        email: 'test@example.com',
        // email_verified is undefined - should pass
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(true);
    });

    it('should handle JWT verification errors gracefully', async () => {
      const event = createMockEvent();
      const logger = createMockLogger();

      mockVerify.mockRejectedValueOnce(new Error('Invalid token signature'));

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to verify google ID token',
        expect.any(Error)
      );
    });

    it('should compare emails case-insensitively', async () => {
      const event = createMockEvent({
        userName: 'Test@Example.COM',
      });
      const logger = createMockLogger();

      mockVerify.mockResolvedValueOnce({
        email: 'test@example.com',
        email_verified: true,
      });

      await addChallengeVerificationResultToEvent(event, logger);

      expect(event.response.answerCorrect).toBe(true);
    });
  });
});
