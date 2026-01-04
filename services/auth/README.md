# Auth Service

Authentication service using AWS Cognito with custom authentication flows and an internal API for inter-service communication.

> **📚 Comprehensive Guide**: See [Authentication Architecture](../../docs/auth.md) for detailed design principles, service communication patterns, and infrastructure setup.

## Overview

This service provides:

1. **Passwordless authentication** using AWS Cognito with custom Lambda triggers (Magic Link, with support for FIDO2/WebAuthn and SMS OTP planned)
2. **Internal API** built with ORPC for type-safe RPC calls between services

## Internal API

The auth service implements the `@contract/internal-api/auth` contract for type-safe inter-service communication.

See [Internal API Documentation](../../docs/internal-api.md) for details on:

- Contract-first API design
- Creating and consuming clients
- Testing procedures
- OpenAPI specification

### Quick Reference

```typescript
// Consuming the auth API from another service
import { createInternalApiClient } from '@client/internal-api';
import { contract } from '@contract/internal-api/auth';

const client = createInternalApiClient({
  contract,
  baseUrl: process.env.AUTH_INTERNAL_API_URL!,
  // AWS Signature V4 signing enabled by default
});

const user = await client.user.get({ id: 'user-123' });
```

## Cognito Authentication

### Infrastructure (`infra/`)

The infrastructure is organized into reusable CDK constructs:

- **`UserPool`** - Creates and configures AWS Cognito User Pool
- **`CognitoTriggers`** - Generic Lambda handlers for custom auth flow (supports multiple auth methods)
- **`MagicLink`** - Magic Link specific resources (KMS key, DynamoDB table, permissions)

### Lambda Functions (`functions/`)

```
functions/src/cognito/
├── common.ts                          # Shared utilities (Logger, UserFacingError)
├── handlers/                          # Generic Cognito Lambda trigger handlers
│   ├── define-auth-challenge.ts      # Orchestrates auth flow based on signInMethod
│   ├── create-auth-challenge.ts      # Delegates challenge creation to auth methods
│   ├── verify-auth-challenge-response.ts  # Delegates verification to auth methods
│   └── pre-signup.ts                 # Auto-confirms users
└── custom-auth/                      # Auth method implementations
    └── magic-link.ts                 # Magic Link create/verify logic
```

## Magic Link Authentication

Magic Links provide a secure, passwordless authentication method where users receive a time-limited sign-in link via email.

### How It Works

1. User enters email address
2. System generates a cryptographically signed magic link using AWS KMS
3. Link is sent via Amazon SES
4. User clicks link to authenticate
5. System verifies signature and issues Cognito tokens

### URL Structure

Magic links use hash fragments to pass the secret:

```
https://app.example.com/auth/callback#<message.base64url>.<signature.base64url>
```

The URL does **not** contain a session token. Sessions are managed by Cognito.

### Cross-Browser Support

Magic links work even when opened in a different browser or device:

- **Same-browser**: Session is retrieved from an **HttpOnly cookie** set by the server after `initiateMagicLink`
- **Cross-browser**: Client detects missing session (server returns error) and calls `initiateMagicLink` again to get a new session

**Cookie Security**:

- Cookies are set **server-side** with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes
- Session tokens are inaccessible to JavaScript (prevents XSS attacks)
- Cookies are automatically deleted after successful authentication (one-time use)

The `completeMagicLink` server function reads the session from cookies:

- If cookie exists: Uses the existing session for `RespondToAuthChallenge`
- If cookie missing: Returns error, triggering cross-browser flow in client

### Security Features

- **RSA-2048 KMS signing** - Links are signed with AWS KMS using RSASSA_PSS_SHA_512
- **Time-limited** - Links expire after 15 minutes (configurable)
- **One-time use** - Each link can only be used once
- **Rate limiting** - Minimum 1 minute between link requests (configurable)
- **Origin validation** - Only allowed origins can request magic links
- **HttpOnly cookies** - Session tokens stored in HttpOnly cookies (inaccessible to JavaScript)
- **Secure cookies** - HTTPS only transmission (prevents man-in-the-middle attacks)
- **SameSite=Strict** - CSRF protection via strict same-site cookie policy

### Infrastructure Components

**KMS Key**

- RSA-2048 asymmetric key for signing/verification
- Separate key permissions for signing (CreateAuthChallenge) and verification (VerifyAuthChallengeResponse)

**DynamoDB Table**

- Stores magic link metadata (hashed usernames and signatures)
- TTL enabled on `exp` attribute for automatic cleanup
- Conditional writes for rate limiting

**IAM Permissions**

- SES SendEmail for CreateAuthChallenge Lambda
- KMS Sign for CreateAuthChallenge Lambda
- KMS GetPublicKey for VerifyAuthChallengeResponse Lambda
- DynamoDB read/write for both Lambdas

## Configuration

### Example Setup (`infra/Main.ts`)

```typescript
import { CognitoTriggers } from './cognito/CognitoTriggers.ts';
import { MagicLink } from './cognito/MagicLink.ts';
import { UserPool } from './cognito/UserPool.ts';

// Create UserPool
const mainUserPool = new UserPool(stack, 'main', {
  clients: {
    main: {
      generateSecret: true,
    },
  },
});

// Create generic Cognito triggers
const cognitoTriggers = new CognitoTriggers(stack, 'cognito-triggers', {
  userPool: mainUserPool.userPool,
  autoConfirmUsers: true,
  logLevel: 'INFO', // DEBUG | INFO | ERROR
});

// Configure Magic Link authentication
const magicLink = new MagicLink(stack, 'magic-link', {
  cognitoTriggers,
  allowedOrigins: ['https://app.example.com'],
  ses: {
    fromAddress: 'noreply@example.com',
    region: 'us-east-1', // Optional, defaults to stack region
  },
  expiryDuration: Duration.minutes(15), // Optional
  minimumInterval: Duration.minutes(1), // Optional
});
```

### Local Development

When running services locally that consume the auth internal API, you need AWS credentials for request signing:

```bash
# Using aws-vault (recommended)
aws-vault exec <profile> -- pnpm dev

# Or with environment variables
AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx AWS_REGION=us-east-1 pnpm dev
```

See [Internal API Documentation](../../docs/internal-api.md) for more details on local development setup.

### Environment Variables

The Lambda handlers use the following environment variables (automatically configured):

**Magic Link Specific:**

- `MAGIC_LINK_ENABLED` - Whether magic link auth is enabled
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `SES_FROM_ADDRESS` - Email address for sending magic links
- `SES_REGION` - AWS region for SES
- `KMS_KEY_ID` - KMS key ID/alias for signing
- `DYNAMODB_SECRETS_TABLE` - DynamoDB table name
- `SECONDS_UNTIL_EXPIRY` - Magic link expiration time (default: 900)
- `MIN_SECONDS_BETWEEN` - Minimum time between requests (default: 60)
- `STACK_ID` - CloudFormation stack ID (used as salt)

**Common:**

- `LOG_LEVEL` - Logging level (DEBUG | INFO | ERROR)

## Adding New Auth Methods

The architecture supports adding new authentication methods without modifying existing code:

1. **Create implementation** in `functions/src/cognito/custom-auth/`

   ```typescript
   // functions/src/cognito/custom-auth/fido2.ts
   export async function addChallengeToEvent(event, logger) {
     /* ... */
   }
   export async function addChallengeVerificationResultToEvent(event, logger) {
     /* ... */
   }
   ```

2. **Update handlers** in `functions/src/cognito/handlers/`

   ```typescript
   // create-auth-challenge.ts
   import * as fido2 from '../custom-auth/fido2.js';

   case 'FIDO2':
     await fido2.addChallengeToEvent(event, logger);
     break;
   ```

3. **Create infrastructure construct** in `infra/cognito/`

   ```typescript
   // infra/cognito/Fido2.ts
   export class Fido2 extends Construct {
     constructor(scope, id, props: { cognitoTriggers: CognitoTriggers }) {
       // Configure Lambda environment variables and permissions
     }
   }
   ```

4. **Update SignInMethod type** in `functions/src/cognito/common.ts`

## References

Based on AWS sample: [amazon-cognito-passwordless-auth](https://github.com/aws-samples/amazon-cognito-passwordless-auth)
