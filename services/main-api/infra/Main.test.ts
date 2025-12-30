import { describe, it, beforeAll, expect } from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { initProject } from 'sst/project.js';
import { App, getStack, StackContext } from 'sst/constructs';
import { Main } from './Main.ts';

describe('Main API Stack', () => {
  beforeAll(async () => {
    await initProject({});
  });

  it('should create API Gateway with HTTP protocol and routes', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      Main(ctx);
    };
    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: API Gateway creation + protocol + route count
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties(
      'AWS::ApiGatewayV2::Api',
      Match.objectLike({
        ProtocolType: 'HTTP',
      })
    );
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 2);

    // Group: Catch-all route configuration
    template.hasResourceProperties(
      'AWS::ApiGatewayV2::Route',
      Match.objectLike({
        RouteKey: 'ANY /{proxy+}',
        AuthorizationType: 'NONE',
      })
    );

    // Group: Protected route with IAM authorization
    template.hasResourceProperties(
      'AWS::ApiGatewayV2::Route',
      Match.objectLike({
        RouteKey: 'ANY /protected',
        AuthorizationType: 'AWS_IAM',
      })
    );
  });

  it('should create Lambda function with correct configuration', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      Main(ctx);
    };
    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: Lambda function handler + runtime configuration
    template.hasResourceProperties(
      'AWS::Lambda::Function',
      Match.objectLike({
        Handler: 'functions/src/api.handler',
        Runtime: Match.stringLikeRegexp('nodejs'),
      })
    );

    // Group: IAM role for Lambda execution
    template.hasResourceProperties(
      'AWS::IAM::Role',
      Match.objectLike({
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: Match.objectLike({
                Service: 'lambda.amazonaws.com',
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('should configure API Gateway and Lambda integration', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      Main(ctx);
    };
    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: API Gateway integrations + Lambda permissions
    template.resourceCountIs('AWS::ApiGatewayV2::Integration', 2);
    template.hasResourceProperties(
      'AWS::ApiGatewayV2::Integration',
      Match.objectLike({
        IntegrationType: 'AWS_PROXY',
      })
    );

    // Group: Lambda invoke permissions for API Gateway
    template.hasResourceProperties(
      'AWS::Lambda::Permission',
      Match.objectLike({
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
      })
    );
  });

  it('should export API endpoint URL as stack output', async () => {
    const app = new App({ mode: 'deploy' });
    const Stack = function (ctx: StackContext) {
      Main(ctx);
    };
    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Verify stack output for API endpoint
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContain('ApiEndpoint');
  });
});
