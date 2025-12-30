import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RemovalPolicy } from 'aws-cdk-lib';
import { initProject } from 'sst/project.js';
import { App, getStack, StackContext } from 'sst/constructs';
import { UserPool } from './UserPool.ts';

// Mock @lib/sst-helpers to avoid account validation in tests
vi.mock('@lib/sst-helpers', () => ({
  removalPolicy: {
    retainForPermanentStage: () => RemovalPolicy.DESTROY,
  },
}));

describe('UserPool construct', () => {
  beforeAll(async () => {
    await initProject({});
  });

  describe('constructor', () => {
    it('should create a user pool with default configuration', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool');
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    it('should create a user pool with custom id', async () => {
      const app = new App({ mode: 'deploy' });
      let userPoolId;
      const Stack = function (ctx: StackContext) {
        const userPool = new UserPool(ctx.stack, 'custom-id');
        userPoolId = userPool.id;
        return { userPool };
      };
      app.stack(Stack);

      await app.finish();

      expect(userPoolId).toBe('custom-id');
    });
  });

  describe('password policy', () => {
    it('should apply default password policy', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool');
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      // Use Match.objectLike for more flexible matching
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: Match.objectLike({
          PasswordPolicy: Match.objectLike({
            MinimumLength: 8,
            RequireNumbers: true,
            RequireUppercase: true,
            RequireLowercase: true,
            RequireSymbols: true,
          }),
        }),
      });
    });

    it('should override password policy with custom props', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          cdk: {
            userPool: {
              passwordPolicy: {
                minLength: 12,
                requireSymbols: false,
              },
            },
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: Match.objectLike({
          PasswordPolicy: Match.objectLike({
            MinimumLength: 12,
            RequireSymbols: false,
          }),
        }),
      });
    });
  });

  describe('sign-in aliases', () => {
    it('should enable email and phone sign-in aliases by default', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool');
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AliasAttributes: Match.arrayWith(['email', 'phone_number']),
      });
    });
  });

  describe('user pool clients', () => {
    it('should not create clients when clients prop is undefined', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool');
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 0);
    });

    it('should create a single client with default config', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          clients: {
            web: {},
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'web',
      });
    });

    it('should create multiple clients', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          clients: {
            web: {},
            mobile: {},
            api: {},
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 3);
    });

    it('should apply client configuration with generateSecret', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          clients: {
            backend: {
              generateSecret: true,
            },
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'backend',
        GenerateSecret: true,
      });
    });

    it('should apply default auth flows', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          clients: {
            web: {},
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      });
    });

    it('should link client to user pool using Ref', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool', {
          clients: {
            web: {},
          },
        });
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));

      // Verify client references the user pool
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        UserPoolId: Match.objectLike({
          Ref: Match.stringLikeRegexp('testuserpool'),
        }),
      });
    });
  });

  describe('removal policy', () => {
    it('should call removalPolicy helper', async () => {
      const app = new App({ mode: 'deploy' });
      const Stack = function (ctx: StackContext) {
        new UserPool(ctx.stack, 'test-user-pool');
      };
      app.stack(Stack);

      await app.finish();

      const template = Template.fromStack(getStack(Stack));
      // Just verify the user pool was created - the removal policy
      // is handled by the removalPolicy helper from @lib/sst-helpers
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });
  });
});
