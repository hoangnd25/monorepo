/**
 * Shared utilities for Cognito Lambda triggers
 * Based on AWS sample: amazon-cognito-passwordless-auth
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Simple logger that respects LOG_LEVEL environment variable
 */
export class Logger {
  private readonly logLevel: LogLevel;

  constructor(logLevel?: string) {
    this.logLevel = (logLevel ?? process.env.LOG_LEVEL ?? 'INFO') as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('DEBUG')) {
      console.trace(message, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('INFO')) {
      console.log(message, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('WARN')) {
      console.warn(message, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('ERROR')) {
      console.error(message, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}

/**
 * Error class for user-facing errors that should be shown to the user
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/**
 * Common configuration shared across Cognito triggers
 */
export interface CommonConfig {
  logLevel: string;
  salt: string;
}

export function getCommonConfig(): CommonConfig {
  return {
    logLevel: process.env.LOG_LEVEL ?? 'INFO',
    salt: process.env.STACK_ID ?? '',
  };
}

/**
 * Supported sign-in methods for custom auth flow
 */
export type SignInMethod = 'MAGIC_LINK' | 'FIDO2' | 'SMS_OTP';

/**
 * Helper to determine if a sign-in method is valid
 */
export function isValidSignInMethod(method: unknown): method is SignInMethod {
  return (
    typeof method === 'string' &&
    ['MAGIC_LINK', 'FIDO2', 'SMS_OTP'].includes(method)
  );
}
