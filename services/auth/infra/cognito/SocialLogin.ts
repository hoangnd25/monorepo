import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {
  App,
  Stack,
  Function as SstFunction,
  Api,
  Config,
} from 'sst/constructs';
import type { CognitoTriggers } from './CognitoTriggers.ts';

// ============================================================================
// Types
// ============================================================================

export type SocialProvider = 'google' | 'apple' | 'microsoft';

export interface SocialLoginProps {
  /**
   * The Cognito User Pool to use for social login
   */
  userPool: cognito.IUserPool;
  /**
   * The SST Api construct containing the internal API routes
   */
  internalApi: Api;
  /**
   * Cognito Lambda triggers to configure for social login token validation
   */
  cognitoTriggers: CognitoTriggers;
  /**
   * List of enabled social login providers
   */
  providers: SocialProvider[];
}

// ============================================================================
// Construct
// ============================================================================

/**
 * Configures Social Login authentication for the auth service.
 *
 * This construct manages social login providers using SST Config parameters.
 * Each provider requires two Config values:
 * - SOCIAL_<PROVIDER>_CLIENT_ID: OAuth client ID (set to "NA" to disable)
 * - SOCIAL_<PROVIDER>_CLIENT_SECRET: OAuth client secret
 *
 * If the client ID is set to "NA", the provider is considered disabled.
 *
 * Features:
 * - Supports multiple providers (Google, Apple, Microsoft)
 * - Per-provider enable/disable via Config (clientId = "NA" means disabled)
 * - Binds provider credentials to internal API Lambda
 * - Binds provider client IDs to VerifyAuthChallengeResponse Lambda for token validation
 * - Grants Cognito Admin* permissions for user management
 *
 * Environment variable naming convention (set by Lambda at runtime):
 * - SOCIAL_PROVIDER_<PROVIDER>_ENABLED: "true" if clientId !== "NA"
 * - SOCIAL_PROVIDER_<PROVIDER>_CLIENT_ID: OAuth client ID
 * - SOCIAL_PROVIDER_<PROVIDER>_CLIENT_SECRET: OAuth client secret (internal API only)
 */
export class SocialLogin extends Construct {
  readonly app: App;
  readonly stack: Stack;

  /**
   * Config parameters for each provider's client ID
   * Key format: SOCIAL_<PROVIDER>_CLIENT_ID
   */
  readonly clientIdConfigs: Map<SocialProvider, Config.Secret>;

  /**
   * Config parameters for each provider's client secret
   * Key format: SOCIAL_<PROVIDER>_CLIENT_SECRET
   */
  readonly clientSecretConfigs: Map<SocialProvider, Config.Secret>;

  constructor(
    readonly scope: Construct,
    readonly id: string,
    readonly props: SocialLoginProps
  ) {
    super(scope, id);

    this.app = scope.node.root as App;
    this.stack = Stack.of(this) as Stack;

    this.clientIdConfigs = new Map();
    this.clientSecretConfigs = new Map();

    // Create Config parameters for all providers
    this.createConfigParameters();

    // Configure Lambda functions
    this.configureInternalApiFunction();
    this.configureCognitoTriggers();
  }

  /**
   * Create SST Config parameters for all providers
   *
   * Each provider gets:
   * - SOCIAL_<PROVIDER>_CLIENT_ID (Secret - set to "NA" to disable)
   * - SOCIAL_<PROVIDER>_CLIENT_SECRET (Secret)
   */
  private createConfigParameters(): void {
    for (const provider of this.props.providers) {
      const configPrefix = `SOCIAL_${provider.toUpperCase()}`;

      const clientIdConfig = new Config.Secret(
        this.stack,
        `${configPrefix}_CLIENT_ID`
      );

      const clientSecretConfig = new Config.Secret(
        this.stack,
        `${configPrefix}_CLIENT_SECRET`
      );

      this.clientIdConfigs.set(provider, clientIdConfig);
      this.clientSecretConfigs.set(provider, clientSecretConfig);
    }
  }

  /**
   * Configure the internal API Lambda function with social login settings
   *
   * Binds all provider Config secrets to the Lambda.
   * The Lambda will check at runtime which providers are enabled (clientId !== "NA").
   */
  private configureInternalApiFunction(): void {
    const fn = this.getInternalApiFunction();

    if (!fn) {
      throw new Error(
        'Could not find internal API Lambda function for social login configuration'
      );
    }

    // Bind all provider configs to the Lambda
    const allConfigs: Config.Secret[] = [];
    for (const provider of this.props.providers) {
      const clientIdConfig = this.clientIdConfigs.get(provider);
      const clientSecretConfig = this.clientSecretConfigs.get(provider);

      if (clientIdConfig && clientSecretConfig) {
        allConfigs.push(clientIdConfig, clientSecretConfig);
      }
    }

    fn.bind(allConfigs);
  }

  /**
   * Configure the Cognito trigger Lambdas for social login token validation.
   *
   * Only binds CLIENT_ID configs (not secrets) since the trigger only needs
   * to validate the audience claim, not exchange tokens.
   */
  private configureCognitoTriggers(): void {
    const { verifyAuthChallengeResponseFn } = this.props.cognitoTriggers;

    const allConfigs: Config.Secret[] = [];
    for (const provider of this.props.providers) {
      const clientIdConfig = this.clientIdConfigs.get(provider);
      const clientSecretConfig = this.clientSecretConfigs.get(provider);

      if (clientIdConfig && clientSecretConfig) {
        allConfigs.push(clientIdConfig, clientSecretConfig);
      }
    }

    verifyAuthChallengeResponseFn.bind(allConfigs);
  }

  /**
   * Get the Lambda function from the internal API
   */
  private getInternalApiFunction(): SstFunction | undefined {
    return this.props.internalApi.getFunction('ANY /auth/{proxy+}');
  }
}
