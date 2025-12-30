import { StackContext } from 'sst/constructs';
import { UserPool } from './cognito/UserPool.ts';
import { CognitoTriggers } from './cognito/CognitoTriggers.ts';
import { MagicLink } from './cognito/MagicLink.ts';

export function Main({ stack }: StackContext) {
  const mainUserPool = new UserPool(stack, 'main', {
    clients: {
      main: {
        generateSecret: true,
      },
    },
  });

  // Create Cognito Lambda triggers for custom auth flow
  const cognitoTriggers = new CognitoTriggers(stack, 'cognito-triggers', {
    userPool: mainUserPool.userPool,
    autoConfirmUsers: true,
    // logLevel: 'DEBUG',
  });

  // Configure magic link authentication
  const magicLink = new MagicLink(stack, 'magic-link', {
    cognitoTriggers,
    allowedOrigins: [
      // TODO: Replace with your actual app origins
      'https://app.example.com',
    ],
    ses: {
      // TODO: Replace with your verified SES email address
      fromAddress: 'noreply@example.com',
      // Optional: specify region if SES is in a different region
      // region: 'us-east-1',
    },
    // Optional configuration
    // expiryDuration: Duration.minutes(15),
    // minimumInterval: Duration.minutes(1),
  });

  stack.addOutputs({
    UserPoolId: mainUserPool.userPool.userPoolId,
    MagicLinkSecretsTable: magicLink.secretsTable.tableName,
  });
}
