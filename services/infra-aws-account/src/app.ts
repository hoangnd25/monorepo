#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AccountDnsStack } from './stacks/dns.ts';
import { regions } from '@lib/sst-helpers';

const app = new cdk.App();

const region = regions.getHomeRegion(); // process.env.CDK_DEFAULT_REGION
const account = process.env.CDK_DEFAULT_ACCOUNT;

new AccountDnsStack(app, 'AccountDns', {
  env: { account, region },
  description: 'AWS Account shared DNS stack',
});

app.synth();
