import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { App, Stack, Function as SstFunction } from 'sst/constructs';

export type CognitoTriggersProps = {
  /**
   * The UserPool to attach Lambda triggers to
   */
  userPool: cognito.UserPool;

  /**
   * Whether to auto-confirm users when they sign up
   * @default true
   */
  autoConfirmUsers?: boolean;

  /**
   * Log level for Lambda functions
   * @default 'INFO'
   */
  logLevel?: 'DEBUG' | 'INFO' | 'ERROR';
};

/**
 * Creates Cognito Lambda trigger handlers for custom authentication flows.
 * These handlers are generic and support multiple auth methods (Magic Link, FIDO2, SMS OTP).
 *
 * The actual auth method implementations are configured separately via
 * environment variables set by auth method-specific constructs (e.g., MagicLink).
 */
export class CognitoTriggers extends Construct {
  readonly app: App;
  readonly stack: Stack;
  readonly defineAuthChallengeFn: SstFunction;
  readonly createAuthChallengeFn: SstFunction;
  readonly verifyAuthChallengeResponseFn: SstFunction;
  readonly preSignUpFn?: SstFunction;

  constructor(
    readonly scope: Construct,
    readonly id: string,
    readonly props: CognitoTriggersProps
  ) {
    super(scope, id);

    this.app = scope.node.root as App;
    this.stack = Stack.of(this) as Stack;

    // Create Lambda functions
    this.defineAuthChallengeFn = this.createDefineAuthChallengeFn();
    this.createAuthChallengeFn = this.createCreateAuthChallengeFn();
    this.verifyAuthChallengeResponseFn =
      this.createVerifyAuthChallengeResponseFn();

    if (this.props.autoConfirmUsers !== false) {
      this.preSignUpFn = this.createPreSignUpFn();
    }

    // Attach triggers to the UserPool
    this.attachUserPoolTriggers();
  }

  private createDefineAuthChallengeFn(): SstFunction {
    return new SstFunction(this, `DefineAuthChallenge`, {
      handler: 'functions/src/cognito/handlers/define-auth-challenge.handler',
      runtime: 'nodejs22.x',
      architecture: 'arm_64',
      timeout: '5 seconds',
      environment: {
        LOG_LEVEL: this.props.logLevel ?? 'INFO',
      },
    });
  }

  private createCreateAuthChallengeFn(): SstFunction {
    return new SstFunction(this, `CreateAuthChallenge`, {
      handler: 'functions/src/cognito/handlers/create-auth-challenge.handler',
      runtime: 'nodejs22.x',
      architecture: 'arm_64',
      timeout: '5 seconds',
      environment: {
        LOG_LEVEL: this.props.logLevel ?? 'INFO',
      },
    });
  }

  private createVerifyAuthChallengeResponseFn(): SstFunction {
    return new SstFunction(this, `VerifyAuthChallengeResponse`, {
      handler:
        'functions/src/cognito/handlers/verify-auth-challenge-response.handler',
      runtime: 'nodejs22.x',
      architecture: 'arm_64',
      timeout: '5 seconds',
      environment: {
        LOG_LEVEL: this.props.logLevel ?? 'INFO',
      },
    });
  }

  private createPreSignUpFn(): SstFunction {
    return new SstFunction(this, `PreSignUp`, {
      handler: 'functions/src/cognito/handlers/pre-signup.handler',
      runtime: 'nodejs22.x',
      architecture: 'arm_64',
      timeout: '5 seconds',
      environment: {
        LOG_LEVEL: this.props.logLevel ?? 'INFO',
      },
    });
  }

  private attachUserPoolTriggers(): void {
    this.props.userPool.addTrigger(
      cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
      this.defineAuthChallengeFn.currentVersion
    );

    this.props.userPool.addTrigger(
      cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
      this.createAuthChallengeFn.currentVersion
    );

    this.props.userPool.addTrigger(
      cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
      this.verifyAuthChallengeResponseFn.currentVersion
    );

    if (this.preSignUpFn) {
      this.props.userPool.addTrigger(
        cognito.UserPoolOperation.PRE_SIGN_UP,
        this.preSignUpFn.currentVersion
      );
    }
  }
}
