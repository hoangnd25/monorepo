# @lib/sst-constructs

Shared AWS CDK constructs for SST v2 applications. This package provides reusable, higher-level infrastructure components that extend SST and AWS CDK functionality.

## Overview

This package contains custom CDK constructs that simplify deploying server-side rendered applications and managing cross-service configuration in a multi-service architecture. All constructs are built on top of SST v2 and AWS CDK.

## Installation

This is an internal workspace package. Import it in your SST infrastructure code:

```typescript
import { NitroSite, SsrSite, ServiceConfig } from '@lib/sst-constructs';
```

For Node.js runtime code (Lambda functions), import from the `node` subpath:

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';
```

## Constructs

### SsrSite

**Abstract base construct** for deploying server-side rendered (SSR) applications with CloudFront and AWS Lambda.

#### Features

- **CloudFront Distribution**: Automatic CDN setup with custom domain support
- **S3 Static Assets**: Optimized asset delivery with versioned and non-versioned file caching
- **Regional Lambda Functions**: Server-side rendering via API Gateway + Lambda
- **Lambda Warming**: Built-in warmer to keep functions initialized (5-minute interval)
- **Cache Control**: Configurable TTLs for versioned (default: 365 days) and non-versioned files (default: 1 day with stale-while-revalidate)
- **CloudFront Functions**: Custom CloudFront Functions for request/response manipulation
- **Invalidation**: Automatic CloudFront cache invalidation on deployment
- **Environment Variables**: Support for SST bindings, secrets, and token replacement in built assets

#### Architecture

```
┌─────────────┐
│  CloudFront │
└──────┬──────┘
       │
   ┌───┴────┐
   │        │
   v        v
┌────┐  ┌──────────┐
│ S3 │  │ API GW + │
└────┘  │  Lambda  │
        └──────────┘
```

#### When to Extend

Extend `SsrSite` when building support for a new SSR framework. You must implement:

```typescript
abstract plan(bucket: Bucket): ReturnType<typeof this.validatePlan>;
abstract getConstructMetadata(): ReturnType<SSTConstruct['getConstructMetadata']>;
```

#### Example Usage

```typescript
// Not used directly - extend for specific frameworks
export class MyFrameworkSite extends SsrSite {
  protected plan(bucket: Bucket) {
    return this.validatePlan({
      edge: false,
      origins: {
        regionalServer: {
          type: 'function',
          constructId: 'ServerFunction',
          function: { handler: 'dist/index.handler', runtime: 'nodejs22.x' },
        },
        s3: {
          type: 's3',
          copy: [{ from: 'dist/public', to: '', cached: true }],
        },
      },
      behaviors: [
        { cacheType: 'server', origin: 'regionalServer' },
        { cacheType: 'static', pattern: 'assets/*', origin: 's3' },
      ],
    });
  }
}
```

---

### NitroSite

**Concrete implementation** of `SsrSite` for deploying [Nitro](https://nitro.unjs.io/) applications (used by Nuxt, TanStack Start, and other frameworks).

#### Features

- **Nitro Preset Validation**: Ensures `aws-lambda` preset is configured
- **Automatic Server Routing**: Cleans up conflicting `_server` and `api` directories from static assets
- **Lambda Streaming Support**: Supports AWS Lambda response streaming if configured in `nitro.config`
- **ESM Format**: Bundles server function as ES modules
- **CloudFront Function Injection**: Automatically injects `x-forwarded-host` header for proper host resolution

#### Configuration Requirements

Your Nitro app must be configured with the `aws-lambda` preset:

```typescript
// nitro.config.ts
export default defineNitroConfig({
  preset: 'aws-lambda',
  awsLambda: {
    streaming: true, // Optional: enable Lambda response streaming
  },
});
```

#### Example Usage

```typescript
import { NitroSite } from '@lib/sst-constructs';

new NitroSite(stack, 'web', {
  path: 'services/main-ui/app',
  environment: {
    API_URL: api.url,
  },
  bind: [api, bucket],
  customDomain: {
    domainName: 'example.com',
    hostedZone: 'example.com',
  },
});
```

#### Build Output Structure

```
.output/
├── nitro.json          # Nitro build metadata
├── public/             # Static assets
│   ├── _server/        # Removed by construct
│   ├── api/            # Removed by construct
│   └── assets/         # Versioned assets (images, fonts, etc.)
└── server/
    └── index.mjs       # Lambda handler
```

---

### ServiceConfig

**SSM Parameter Store wrapper** for cross-service configuration sharing with caching and type safety.

#### Features

- **SSM Parameter Store Integration**: Stores configuration in AWS Systems Manager Parameter Store
- **5-Minute Caching**: Reduces SSM API calls and improves Lambda cold start performance
- **Request Deduplication**: Prevents multiple concurrent requests for the same parameter
- **Type Safety**: Full TypeScript support with module augmentation
- **IAM Permissions**: Automatic permission setup for bound Lambda functions

#### Use Cases

- Share API URLs between services
- Store database connection strings
- Pass CloudFront distribution URLs to backend functions
- Cross-stack resource references

#### Infrastructure Setup

```typescript
import { ServiceConfig } from '@lib/sst-constructs';

// In your API stack
const apiConfig = new ServiceConfig(stack, 'MainApi', {
  path: '/main-api/url',
});

// Bind to Lambda functions
api.bind([apiConfig]);

// In your frontend stack
const uiConfig = new ServiceConfig(stack, 'MainUi', {
  path: '/main-ui/url',
});
```

#### Runtime Usage (Lambda Functions)

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';

// Fetch configuration (returns Promise<string>)
const apiUrl = await ServiceConfig.MainApi;
const uiUrl = await ServiceConfig.MainUi;

console.log(`API URL: ${apiUrl}`);
```

#### Type Safety

The `ServiceConfigResources` interface is **automatically generated** by SST during deployment in `.sst/types/index.ts`. This provides autocomplete and type checking for all bound ServiceConfig constructs.

**After first deployment**, the types are available automatically:

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';

// TypeScript knows about MainApi and MainUi automatically
const apiUrl = await ServiceConfig.MainApi; // ✅ Type-safe
const invalid = await ServiceConfig.NonExistent; // ❌ Compile error
```

**Before first deployment** (optional), you can manually declare types for type-checking:

```typescript
// In your Lambda function file or a types.d.ts file
declare module 'sst/node/config' {
  export interface ServiceConfigResources {
    MainApi: string;
    MainUi: string;
  }
}
```

This allows you to:

- Run `pnpm type-check` before deploying
- Get IDE autocomplete before infrastructure exists
- Catch typos during development

**Note**: Manual type declarations are **optional** and only needed if you want to type-check before the first deployment. After deployment, SST auto-generates these types and your manual declarations will be ignored in favor of the generated ones.

#### How It Works

1. **Infrastructure**: The construct creates an SSM parameter reference and registers it with SST's binding system
2. **Binding**: When bound to a Lambda function, it injects the parameter name as an environment variable
3. **Runtime**: The Node.js client fetches the parameter value from SSM, caching it for 5 minutes
4. **Type Safety**: TypeScript module augmentation provides compile-time type checking

#### Caching Behavior

- **First call**: Fetches from SSM and caches for 5 minutes
- **Subsequent calls**: Returns cached value if not expired
- **Concurrent calls**: Deduplicates requests to prevent thundering herd
- **Expiration**: After 5 minutes, next call refetches from SSM

---

## Common Patterns

### Binding Resources to SSR Sites

```typescript
const api = new Api(stack, 'api', {
  routes: {
    'GET /': 'functions/handler.main',
  },
});

const site = new NitroSite(stack, 'site', {
  path: 'frontend',
  bind: [api], // Injects API_URL as environment variable
});
```

### Custom Domain with DNS

```typescript
new NitroSite(stack, 'site', {
  path: 'frontend',
  customDomain: {
    domainName: `${stack.stage}.example.com`,
    hostedZone: 'example.com',
  },
});
```

### Lambda Function Warming

```typescript
new NitroSite(stack, 'site', {
  path: 'frontend',
  warm: 10, // Keep 10 Lambda instances warm
});
```

### Asset Cache Configuration

```typescript
new NitroSite(stack, 'site', {
  path: 'frontend',
  assets: {
    nonVersionedFilesTTL: '1 hour',
    versionedFilesTTL: '1 year',
    fileOptions: [
      {
        files: '**/*.json',
        cacheControl: 'public,max-age=300',
      },
    ],
  },
});
```

### Cross-Service Configuration

Share configuration values between services using SSM Parameter Store.

**Step 1: Create parameter in producer service** (e.g., `services/auth/infra/Main.ts`):

```typescript
import { serviceConfig } from '@lib/sst-helpers';
import { StackContext, Api } from 'sst/constructs';

export function Main(context: StackContext) {
  const { stack } = context;

  // Create your API
  const internalApi = new Api(stack, 'internal-api-routes', {});

  // Publish the API URL to SSM Parameter Store
  serviceConfig.createParameter(context, {
    path: 'auth/internal-api-url',
    value: internalApi.url + '/auth',
  });
}
```

**Step 2: Consume parameter in consumer service** (e.g., `services/main-ui/infra/Main.ts`):

```typescript
import { ServiceConfig } from '@lib/sst-constructs';
import { NitroSite } from '@lib/sst-constructs';
import { StackContext } from 'sst/constructs';

export function Main(context: StackContext) {
  const { stack } = context;

  // Import auth internal API URL from auth service
  const authInternalApiUrl = new ServiceConfig(stack, 'AuthInternalApiUrl', {
    path: 'auth/internal-api-url',
  });

  // Bind to your site or Lambda functions
  const mainSite = new NitroSite(stack, 'MainSite', {
    path: './app',
    bind: [authInternalApiUrl],
  });
}
```

**Step 3: Access in runtime code** (e.g., Lambda function or SSR server):

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';

// Fetch the auth API URL (cached for 5 minutes)
const authApiUrl = await ServiceConfig.AuthInternalApiUrl;
// Use it to make requests
const response = await fetch(`${authApiUrl}/users`);
```

**Benefits**:

- Deploy services independently (auth service can deploy before main-ui)
- No circular dependencies between stacks
- Values cached for 5 minutes to reduce SSM API calls
- Type-safe with auto-generated types after first deployment

## Architecture Decisions

### Why Abstract SsrSite?

The abstract `SsrSite` class provides a flexible foundation for different SSR frameworks (Nitro, Astro, SvelteKit, etc.) while sharing common infrastructure patterns (CloudFront, S3, Lambda warming, cache invalidation).

### Why Regional Lambda (Not Edge)?

- **Cost**: Regional Lambda functions are cheaper than Lambda@Edge
- **Timeout**: 180s timeout vs. 30s for Edge
- **Flexibility**: Easier to use VPCs, larger memory, and more AWS service integrations
- **Streaming**: Supports Lambda response streaming for improved TTFB

### Why ServiceConfig Over Environment Variables?

- **Cross-Stack References**: SSM parameters work across stacks and accounts
- **Dynamic Updates**: Can update config without redeploying Lambda functions
- **Caching**: Built-in caching reduces cold start time
- **Type Safety**: Module augmentation provides compile-time guarantees

## Related Packages

- **[@lib/sst-helpers](../sst-helpers)**: Helper functions for SST deployments (DNS, regions, environment config)
- **[@lib/client-internal-api](../client-internal-api)**: AWS Signature V4 signing for internal API calls
