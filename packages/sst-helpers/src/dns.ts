import { StackContext } from 'sst/constructs';
import { AWS_ACCOUNTS, MAIN_HOSTED_ZONES } from './constants.ts';

export const mainHostedZone = (context: StackContext) => {
  const { account } = context.app;

  switch (account) {
    case AWS_ACCOUNTS.DEV:
      return MAIN_HOSTED_ZONES.DEV;
    case AWS_ACCOUNTS.PROD:
      return MAIN_HOSTED_ZONES.PROD;
    default:
      throw new Error(`Unable to get main hosted zone for account ${account}`);
  }
};
