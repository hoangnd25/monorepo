import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RemovalPolicy } from 'aws-cdk-lib';
import { initProject } from 'sst/project.js';
import { App, getStack, StackContext } from 'sst/constructs';
import { UserPool } from './UserPool.ts';
import { CognitoTriggers } from './CognitoTriggers.ts';

// Mock @lib/sst-helpers to avoid account validation in tests
vi.mock('@lib/sst-helpers', () => ({
  removalPolicy: {
    retainForPermanentStage: () => RemovalPolicy.DESTROY,
  },
}));

describe('CognitoTriggers construct', () => {
  beforeAll(async () => {
    await initProject({});
  });

  it('should create all required Lambda functions', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Check for Lambda functions with correct handlers
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('define-auth-challenge'),
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('create-auth-challenge'),
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('verify-auth-challenge-response'),
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('pre-signup'),
    });
  });

  it('should create Lambda functions without PreSignUp when autoConfirmUsers is false', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
        autoConfirmUsers: false,
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Check that there's no PreSignUp function
    const resources = template.findResources('AWS::Lambda::Function');
    const hasPreSignUp = Object.keys(resources).some((key) =>
      key.toLowerCase().includes('presignup')
    );
    expect(hasPreSignUp).toBe(false);
  });

  it('should attach Lambda triggers to UserPool', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // UserPool has Lambda triggers configured
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        DefineAuthChallenge: Match.anyValue(),
        CreateAuthChallenge: Match.anyValue(),
        VerifyAuthChallengeResponse: Match.anyValue(),
        PreSignUp: Match.anyValue(),
      },
    });
  });

  it('should configure Lambda functions with correct log level', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
        logLevel: 'DEBUG',
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Check log level is set
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('define-auth-challenge'),
      Environment: {
        Variables: Match.objectLike({
          LOG_LEVEL: 'DEBUG',
        }),
      },
    });
  });

  it('should expose Lambda functions as public properties', async () => {
    const app = new App({ mode: 'deploy' });
    let cognitoTriggers: CognitoTriggers;
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      cognitoTriggers = new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
      });
    };
    app.stack(Stack);

    await app.finish();

    // Construct exposes public properties
    expect(cognitoTriggers!.defineAuthChallengeFn).toBeDefined();
    expect(cognitoTriggers!.createAuthChallengeFn).toBeDefined();
    expect(cognitoTriggers!.verifyAuthChallengeResponseFn).toBeDefined();
    expect(cognitoTriggers!.preSignUpFn).toBeDefined();
  });

  it('should use default INFO log level when not specified', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      const userPool = new UserPool(ctx.stack, 'test-user-pool');
      new CognitoTriggers(ctx.stack, 'cognito-triggers', {
        userPool: userPool.userPool,
      });
    };
    app.stack(Stack);

    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: Match.stringLikeRegexp('define-auth-challenge'),
      Environment: {
        Variables: Match.objectLike({
          LOG_LEVEL: 'INFO',
        }),
      },
    });
  });
});
