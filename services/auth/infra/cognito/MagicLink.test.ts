import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { initProject } from 'sst/project.js';
import { App, getStack, StackContext } from 'sst/constructs';
import { UserPool } from './UserPool.ts';
import { CognitoTriggers } from './CognitoTriggers.ts';
import { MagicLink } from './MagicLink.ts';

// Mock @lib/sst-helpers to avoid account validation in tests
vi.mock('@lib/sst-helpers', () => ({
  removalPolicy: {
    retainForPermanentStage: () => RemovalPolicy.DESTROY,
  },
}));

describe('MagicLink construct', () => {
  beforeAll(async () => {
    await initProject({});
  });

  it('should create KMS key for signing magic links', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // KMS key creation with RSA_2048 spec for signing
    template.hasResourceProperties('AWS::KMS::Key', {
      KeySpec: 'RSA_2048',
      KeyUsage: 'SIGN_VERIFY',
    });

    // KMS key alias is created
    template.resourceCountIs('AWS::KMS::Alias', 1);
  });

  it('should create DynamoDB secrets table for magic link metadata', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // DynamoDB table with correct partition key and TTL
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'userNameHash', KeyType: 'HASH' }],
      AttributeDefinitions: [
        { AttributeName: 'userNameHash', AttributeType: 'B' },
      ],
      TimeToLiveSpecification: {
        AttributeName: 'exp',
        Enabled: true,
      },
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('should configure CreateAuthChallenge Lambda with magic link environment variables', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: [
          'https://app.example.com',
          'https://staging.example.com',
        ],
        ses: {
          fromAddress: 'noreply@example.com',
          region: 'us-east-1',
        },
        expiryDuration: Duration.minutes(30),
        minimumInterval: Duration.seconds(30),
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Find the CreateAuthChallenge Lambda by handler pattern
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('create-auth-challenge'),
      Environment: {
        Variables: Match.objectLike({
          MAGIC_LINK_ENABLED: 'TRUE',
          ALLOWED_ORIGINS:
            'https://app.example.com,https://staging.example.com',
          SES_FROM_ADDRESS: 'noreply@example.com',
          SES_REGION: 'us-east-1',
          SECONDS_UNTIL_EXPIRY: '1800',
          MIN_SECONDS_BETWEEN: '30',
        }),
      },
    });
  });

  it('should grant SES SendEmail permission to CreateAuthChallenge Lambda', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // IAM policy for SES SendEmail
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'ses:SendEmail',
            Effect: 'Allow',
            Resource: Match.anyValue(),
          }),
        ]),
      },
    });
  });

  it('should grant KMS Sign permission to CreateAuthChallenge Lambda', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // IAM policy for KMS Sign with alias condition
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'kms:Sign',
            Effect: 'Allow',
            Condition: {
              StringLike: {
                'kms:RequestAlias': Match.anyValue(),
              },
            },
          }),
        ]),
      },
    });
  });

  it('should grant KMS GetPublicKey permission to VerifyAuthChallengeResponse Lambda', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // IAM policy for KMS GetPublicKey
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'kms:GetPublicKey',
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('should grant DynamoDB read/write permissions to Lambda functions', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // IAM policies for DynamoDB operations are granted
    // Policies are on VerifyAuthChallengeResponse Lambda (check both CreateAuthChallenge and VerifyAuthChallengeResponse)
    const policies = template.findResources('AWS::IAM::Policy');
    const policyNames = Object.keys(policies);

    // Find policies that contain DynamoDB actions
    const dynamoDbPolicies = policyNames.filter((name) => {
      const statements = policies[name].Properties?.PolicyDocument?.Statement;
      return statements?.some(
        (stmt: { Action?: string | string[] }) =>
          (Array.isArray(stmt.Action) &&
            stmt.Action.some((a: string) => a.startsWith('dynamodb:'))) ||
          (typeof stmt.Action === 'string' &&
            stmt.Action.startsWith('dynamodb:'))
      );
    });

    // Should have at least one policy with DynamoDB permissions
    expect(dynamoDbPolicies.length).toBeGreaterThanOrEqual(1);
  });

  it('should expose KMS key and secrets table as public properties', async () => {
    const app = new App({ mode: 'deploy' });
    let magicLink: MagicLink;
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      magicLink = new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    // Construct exposes public properties
    expect(magicLink!.kmsKey).toBeDefined();
    expect(magicLink!.secretsTable).toBeDefined();
  });

  it('should use default values for optional props', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Default expiry (900 seconds = 15 minutes) and interval (60 seconds)
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('create-auth-challenge'),
      Environment: {
        Variables: Match.objectLike({
          SECONDS_UNTIL_EXPIRY: '900',
          MIN_SECONDS_BETWEEN: '60',
        }),
      },
    });
  });

  it('should configure VerifyAuthChallengeResponse Lambda with magic link environment variables', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      const cognitoTriggers = new CognitoTriggers(
        ctx.stack,
        'cognito-triggers',
        {
          userPool: userPool.userPool,
        }
      );
      new MagicLink(ctx.stack, 'magic-link', {
        cognitoTriggers,
        allowedOrigins: ['https://app.example.com'],
        ses: {
          fromAddress: 'noreply@example.com',
        },
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // VerifyAuthChallengeResponse has magic link env vars
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('verify-auth-challenge-response'),
      Environment: {
        Variables: Match.objectLike({
          MAGIC_LINK_ENABLED: 'TRUE',
          ALLOWED_ORIGINS: 'https://app.example.com',
        }),
      },
    });
  });
});
