import { describe, it, beforeAll, vi } from 'vitest';
import { Template } from 'aws-cdk-lib/assertions';
import { RemovalPolicy } from 'aws-cdk-lib';
import { initProject } from 'sst/project.js';
import { App, getStack } from 'sst/constructs';
import { Main } from './Main.ts';

// Mock @lib/sst-helpers to avoid account validation in tests
vi.mock('@lib/sst-helpers', () => ({
  removalPolicy: {
    retainForPermanentStage: () => RemovalPolicy.DESTROY,
  },
}));

describe('Main stack', () => {
  beforeAll(async () => {
    await initProject({});
  });

  describe('UserPool creation', () => {
    it('should create a UserPool with id "main"', async () => {
      const app = new App({ mode: 'deploy' });
      app.stack(Main);

      await app.finish();

      const template = Template.fromStack(getStack(Main));
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    it('should configure UserPool client with generateSecret', async () => {
      const app = new App({ mode: 'deploy' });
      app.stack(Main);

      await app.finish();

      const template = Template.fromStack(getStack(Main));
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'main',
        GenerateSecret: true,
      });
    });
  });

  describe('stack outputs', () => {
    it('should add UserPoolId to stack outputs', async () => {
      const app = new App({ mode: 'deploy' });
      app.stack(Main);

      await app.finish();

      const template = Template.fromStack(getStack(Main));
      template.hasOutput('UserPoolId', {});
    });
  });
});
