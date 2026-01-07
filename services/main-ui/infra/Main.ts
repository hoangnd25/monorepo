import { StackContext } from 'sst/constructs';
import { NitroSite, ServiceConfig } from '@lib/sst-constructs';
import { serviceConfig } from '@lib/sst-helpers';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface MainProps {
  appPath?: string;
}

export function Main(context: StackContext, props?: MainProps) {
  const { stack } = context;
  const appPath = props?.appPath ?? './app';

  // Import internal API ID from shared infra service
  const internalApiId = serviceConfig.getParameterValue(context, {
    path: 'shared-infra/internal-api-id',
  });

  // Import auth internal API URL from auth service
  const authInternalApiUrl = new ServiceConfig(stack, 'AuthInternalApiUrl', {
    path: 'auth/internal-api-url',
  });

  // Import Cognito User Pool ID and Client ID for device fingerprinting
  // These are public identifiers (not secrets) used by the Cognito Advanced Security library
  const cognitoUserPoolId = new ServiceConfig(stack, 'CognitoUserPoolId', {
    path: 'auth/cognito-user-pool-id',
  });
  const cognitoClientId = new ServiceConfig(stack, 'CognitoClientId', {
    path: 'auth/cognito-client-id',
  });

  const mainSite = new NitroSite(stack, 'MainSite', {
    path: appPath,
    buildCommand: 'pnpm build:app',
    dev: {
      deploy: false,
      url: 'http://localhost:3000',
    },
    bind: [authInternalApiUrl, cognitoUserPoolId, cognitoClientId],
    permissions: [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `arn:aws:execute-api:${stack.region}:${stack.account}:${internalApiId}/*`,
        ],
      }),
    ],
  });

  stack.addOutputs({
    MainSiteUrl: mainSite.url,
  });
}
