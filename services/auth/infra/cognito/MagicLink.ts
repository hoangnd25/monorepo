import { Construct } from 'constructs';
import { Duration, Aws, Stack as CdkStack } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { App, Stack, Function as SstFunction } from 'sst/constructs';
import { removalPolicy } from '@lib/sst-helpers';
import { CognitoTriggers } from './CognitoTriggers.ts';

export type MagicLinkProps = {
  /**
   * The CognitoTriggers construct to configure for magic link authentication
   */
  cognitoTriggers: CognitoTriggers;

  /**
   * The origins where you will be hosting your Web app.
   * Used to validate the redirectUri in magic links.
   * Example: https://app.example.com
   */
  allowedOrigins: string[];

  /**
   * SES configuration for sending magic link emails
   */
  ses: {
    /** The e-mail address to use as FROM address for magic link emails */
    fromAddress: string;
    /** AWS region for SES (use different region if not in SES sandbox) */
    region?: string;
  };

  /**
   * Custom KMS key for signing magic links.
   * If not provided, a new RSA-2048 key will be created.
   */
  kmsKey?: kms.IKey;

  /**
   * A rotated KMS key for verifying old magic links during key rotation.
   */
  rotatedKmsKey?: kms.IKey;

  /**
   * How long until magic links expire
   * @default Duration.minutes(15)
   */
  expiryDuration?: Duration;

  /**
   * Minimum time between magic link requests for the same user
   * @default Duration.minutes(1)
   */
  minimumInterval?: Duration;
};

/**
 * Configures Magic Link authentication for Cognito.
 *
 * This construct creates magic-link specific resources (KMS key, DynamoDB table)
 * and configures the CognitoTriggers Lambda functions with the necessary
 * environment variables and permissions for magic link authentication.
 */
export class MagicLink extends Construct {
  readonly app: App;
  readonly stack: Stack;
  readonly kmsKey: kms.IKey;
  readonly secretsTable: dynamodb.Table;

  constructor(
    readonly scope: Construct,
    readonly id: string,
    readonly props: MagicLinkProps
  ) {
    super(scope, id);

    this.app = scope.node.root as App;
    this.stack = Stack.of(this) as Stack;

    this.kmsKey = this.createKmsKey();
    this.secretsTable = this.createSecretsTable();

    // Configure Lambda functions for magic link
    this.configureCreateAuthChallengeFn();
    this.configureVerifyAuthChallengeResponseFn();
  }

  private createKmsKey(): kms.IKey {
    if (this.props.kmsKey) {
      return this.props.kmsKey;
    }

    const key = new kms.Key(this, `MagicLinkKey`, {
      keySpec: kms.KeySpec.RSA_2048,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      description: `KMS key for signing magic links - ${this.app.name}/${this.stack.stackName}`,
      removalPolicy: removalPolicy.retainForPermanentStage({
        stack: this.stack,
        app: this.app,
      }),
      policy: new iam.PolicyDocument({
        statements: [
          // Allow account root for admin operations (but not Sign)
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            notActions: ['kms:Sign'],
            resources: ['*'],
            principals: [new iam.AccountRootPrincipal()],
          }),
        ],
      }),
    });

    return key.addAlias(
      `alias/magic-link-${this.app.name}-${this.stack.stackName}`
    );
  }

  private createSecretsTable(): dynamodb.Table {
    return new dynamodb.Table(this, `SecretsTable`, {
      tableName: this.app.logicalPrefixedName(`${this.id}-secrets`),
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'userNameHash',
        type: dynamodb.AttributeType.BINARY,
      },
      timeToLiveAttribute: 'exp',
      removalPolicy: removalPolicy.retainForPermanentStage({
        stack: this.stack,
        app: this.app,
      }),
    });
  }

  private configureCreateAuthChallengeFn(): void {
    const fn = this.props.cognitoTriggers.createAuthChallengeFn;
    const sesRegion = this.props.ses.region ?? Aws.REGION;
    const kmsKeyId = this.getKmsKeyIdentifier();
    const cdkStack = CdkStack.of(this);

    // Add magic link environment variables
    fn.addEnvironment('MAGIC_LINK_ENABLED', 'TRUE');
    fn.addEnvironment('ALLOWED_ORIGINS', this.props.allowedOrigins.join(','));
    fn.addEnvironment('SES_FROM_ADDRESS', this.props.ses.fromAddress);
    fn.addEnvironment('SES_REGION', sesRegion);
    fn.addEnvironment('KMS_KEY_ID', kmsKeyId);
    fn.addEnvironment('DYNAMODB_SECRETS_TABLE', this.secretsTable.tableName);
    fn.addEnvironment(
      'SECONDS_UNTIL_EXPIRY',
      (this.props.expiryDuration?.toSeconds() ?? 900).toString()
    );
    fn.addEnvironment(
      'MIN_SECONDS_BETWEEN',
      (this.props.minimumInterval?.toSeconds() ?? 60).toString()
    );
    fn.addEnvironment('STACK_ID', cdkStack.stackId);

    // Grant DynamoDB read/write access
    this.secretsTable.grantReadWriteData(fn);

    // Grant SES SendEmail permission
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [
          `arn:${Aws.PARTITION}:ses:${sesRegion}:${Aws.ACCOUNT_ID}:identity/*`,
        ],
        actions: ['ses:SendEmail'],
      })
    );

    // Grant KMS Sign permission
    this.grantKmsSignPermission(fn);
  }

  private configureVerifyAuthChallengeResponseFn(): void {
    const fn = this.props.cognitoTriggers.verifyAuthChallengeResponseFn;
    const cdkStack = CdkStack.of(this);

    // Add magic link environment variables
    fn.addEnvironment('MAGIC_LINK_ENABLED', 'TRUE');
    fn.addEnvironment('ALLOWED_ORIGINS', this.props.allowedOrigins.join(','));
    fn.addEnvironment('DYNAMODB_SECRETS_TABLE', this.secretsTable.tableName);
    fn.addEnvironment('STACK_ID', cdkStack.stackId);

    // Grant DynamoDB read/write access
    this.secretsTable.grantReadWriteData(fn);

    // Grant KMS GetPublicKey permission
    this.grantKmsGetPublicKeyPermission(fn);
  }

  private getKmsKeyIdentifier(): string {
    // If it's an alias, use the alias name; otherwise use key ID
    if ((this.kmsKey as kms.IAlias).aliasName) {
      return (this.kmsKey as kms.IAlias).aliasName;
    }
    return this.kmsKey.keyId;
  }

  private grantKmsSignPermission(fn: SstFunction): void {
    const keys = [this.kmsKey, this.props.rotatedKmsKey].filter(Boolean);

    for (const key of keys) {
      if (!key) continue;

      if ((key as kms.IAlias).aliasName) {
        // For aliases, use condition-based policy
        const aliasName = (key as kms.IAlias).aliasName;
        const permissions = {
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:${Aws.PARTITION}:kms:${Aws.REGION}:${Aws.ACCOUNT_ID}:key/*`,
          ],
          actions: ['kms:Sign'],
          conditions: {
            StringLike: {
              'kms:RequestAlias': aliasName,
            },
          },
        };

        // Add to key resource policy
        key.addToResourcePolicy(
          new iam.PolicyStatement({
            ...permissions,
            principals: [fn.role!],
          })
        );

        // Add to function's role policy
        fn.addToRolePolicy(new iam.PolicyStatement(permissions));
      } else {
        // For direct key references
        const permissions = {
          effect: iam.Effect.ALLOW,
          resources: [key.keyArn],
          actions: ['kms:Sign'],
        };

        key.addToResourcePolicy(
          new iam.PolicyStatement({
            ...permissions,
            principals: [fn.role!],
          })
        );

        fn.addToRolePolicy(new iam.PolicyStatement(permissions));
      }
    }
  }

  private grantKmsGetPublicKeyPermission(fn: SstFunction): void {
    const keys = [this.kmsKey, this.props.rotatedKmsKey].filter(Boolean);

    for (const key of keys) {
      if (!key) continue;

      if ((key as kms.IAlias).aliasName) {
        fn.addToRolePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:${Aws.PARTITION}:kms:${Aws.REGION}:${Aws.ACCOUNT_ID}:key/*`,
            ],
            actions: ['kms:GetPublicKey'],
            conditions: {
              StringLike: {
                'kms:RequestAlias': (key as kms.IAlias).aliasName,
              },
            },
          })
        );
      } else {
        fn.addToRolePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [key.keyArn],
            actions: ['kms:GetPublicKey'],
          })
        );
      }
    }
  }
}
