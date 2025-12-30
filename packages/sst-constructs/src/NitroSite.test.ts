/**
 * Infrastructure tests for NitroSite construct
 *
 * These tests verify that the NitroSite construct creates the necessary AWS resources
 * for hosting Nitro applications with proper security, performance, and integration
 * configurations.
 *
 * Key infrastructure components tested:
 * - CloudFront distribution with HTTPS redirect and cache configuration
 * - S3 bucket with security best practices (public access blocking)
 * - Lambda function with API Gateway for server-side rendering
 * - IAM roles and policies for S3 access and CloudFront invalidation
 *
 * Note: NitroSite extends SsrSite and provides simplified stub resources
 * during testing, allowing us to test construct instantiation without
 * requiring a fully built Nitro application.
 */
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { initProject } from 'sst/project.js';
import { App, getStack, StackContext } from 'sst/constructs';
import { NitroSite } from './NitroSite.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a stub Nitro output directory structure for testing
 * This simulates a built Nitro app without requiring an actual build
 */
const createStubNitroOutput = (appPath: string) => {
  const outputDir = path.join(appPath, '.output');
  fs.mkdirSync(path.join(outputDir, 'public'), { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'server'), { recursive: true });

  // Create stub nitro.json with required preset configuration
  fs.writeFileSync(
    path.join(outputDir, 'nitro.json'),
    JSON.stringify({ preset: 'aws-lambda' })
  );

  // Create stub server handler (NitroSite expects this path to exist)
  fs.writeFileSync(
    path.join(outputDir, 'server', 'index.mjs'),
    'export const handler = async () => ({ statusCode: 200 });'
  );

  // Create at least one file in public directory
  // NitroSite reads this directory to create CloudFront behaviors
  fs.writeFileSync(path.join(outputDir, 'public', 'favicon.ico'), '');
};

describe('NitroSite', () => {
  const tmpDir = path.join(__dirname, '../.tmp');
  let testAppPath: string;

  beforeAll(async () => {
    await initProject({});
    // Create base tmp directory
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up base tmp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create unique temp directory for this test
    testAppPath = path.join(tmpDir, `app-${randomUUID()}`);
    fs.mkdirSync(testAppPath);

    // Create stub Nitro output structure
    createStubNitroOutput(testAppPath);
  });

  afterEach(() => {
    // Clean up test-specific directories after each test
    if (fs.existsSync(testAppPath)) {
      fs.rmSync(testAppPath, { recursive: true, force: true });
    }
  });

  it('should create CloudFront distribution with S3 bucket and security configuration', async () => {
    const app = new App({ mode: 'deploy' });

    const Stack = function (ctx: StackContext) {
      new NitroSite(ctx.stack, 'TestNitroSite', {
        path: testAppPath,
      });
    };

    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: CloudFront distribution with HTTPS redirect and cache behaviors
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.hasResourceProperties(
      'AWS::CloudFront::Distribution',
      Match.objectLike({
        DistributionConfig: Match.objectLike({
          Enabled: true,
          // Verify origins are configured (S3 and API Gateway)
          Origins: Match.arrayWith([
            Match.objectLike({
              DomainName: Match.anyValue(),
            }),
          ]),
          // Verify HTTPS redirect and cache behaviors
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: Match.stringLikeRegexp(
              'redirect-to-https|https-only'
            ),
            TargetOriginId: Match.anyValue(),
            Compress: true,
            AllowedMethods: Match.anyValue(),
            CachedMethods: Match.anyValue(),
          }),
        }),
      })
    );

    // Group: S3 bucket with security best practices
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties(
      'AWS::S3::Bucket',
      Match.objectLike({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      })
    );
    // Note: S3 bucket encryption is not explicitly configured by NitroSite construct.
    // AWS S3 applies default encryption (SSE-S3) if not specified, but best practice
    // is to explicitly configure encryption in IaC.
  });

  it('should create Lambda function with API Gateway for server-side rendering', async () => {
    const app = new App({ mode: 'deploy' });

    const Stack = function (ctx: StackContext) {
      new NitroSite(ctx.stack, 'TestNitroSite', {
        path: testAppPath,
      });
    };

    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: Lambda function configuration
    template.hasResourceProperties(
      'AWS::Lambda::Function',
      Match.objectLike({
        Runtime: Match.stringLikeRegexp('nodejs'),
        Handler: Match.stringLikeRegexp('index.handler'),
        Description: Match.stringLikeRegexp('Server handler'),
      })
    );

    // Group: API Gateway integration
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties(
      'AWS::ApiGateway::RestApi',
      Match.objectLike({
        EndpointConfiguration: Match.objectLike({
          Types: ['REGIONAL'],
        }),
      })
    );

    template.hasResourceProperties(
      'AWS::ApiGateway::Method',
      Match.objectLike({
        HttpMethod: 'ANY',
      })
    );
  });

  it('should configure IAM permissions for S3 and CloudFront invalidation', async () => {
    const app = new App({ mode: 'deploy' });

    const Stack = function (ctx: StackContext) {
      new NitroSite(ctx.stack, 'TestNitroSite', {
        path: testAppPath,
      });
    };

    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Group: IAM role with Lambda trust policy
    template.hasResourceProperties(
      'AWS::IAM::Role',
      Match.objectLike({
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Principal: Match.objectLike({
                Service: 'lambda.amazonaws.com',
              }),
              Action: 'sts:AssumeRole',
            }),
          ]),
        }),
      })
    );

    // Group: S3 access permissions
    template.hasResourceProperties(
      'AWS::IAM::Policy',
      Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([Match.stringLikeRegexp('s3:GetObject')]),
              Effect: 'Allow',
            }),
          ]),
        }),
      })
    );

    // Group: CloudFront invalidation permissions
    template.hasResourceProperties(
      'AWS::IAM::Policy',
      Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'cloudfront:CreateInvalidation',
              Effect: 'Allow',
              Resource: Match.objectLike({
                'Fn::Join': Match.arrayWith([
                  Match.arrayWith([
                    Match.stringLikeRegexp('arn:'),
                    Match.stringLikeRegexp('cloudfront'),
                  ]),
                ]),
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('should instantiate and synthesize without errors', async () => {
    const app = new App({ mode: 'deploy' });

    const Stack = function (ctx: StackContext) {
      new NitroSite(ctx.stack, 'TestNitroSite', {
        path: testAppPath,
      });
    };

    app.stack(Stack);
    await app.finish();

    const template = Template.fromStack(getStack(Stack));

    // Verify basic resource creation
    const resources = template.toJSON().Resources;
    expect(resources).toBeDefined();
    expect(Object.keys(resources).length).toBeGreaterThan(0);
  });
});
