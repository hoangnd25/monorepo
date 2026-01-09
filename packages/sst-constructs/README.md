# @lib/sst-constructs

Shared AWS CDK constructs for SST v2 applications. This package provides reusable, higher-level infrastructure components that extend SST and AWS CDK functionality.

## Overview

This package contains custom CDK constructs that simplify deploying server-side rendered applications and managing cross-service configuration in a multi-service architecture. All constructs are built on top of SST v2 and AWS CDK.

## Installation

This is an internal workspace package. Import it in your SST infrastructure code:

```typescript
import {
  NitroSite,
  SsrSite,
  ServiceConfig,
  GlobalTable,
} from '@lib/sst-constructs';
```

For Node.js runtime code (Lambda functions), import from the `node` subpath:

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';
import { GlobalTable } from '@lib/sst-constructs/node/global-table';
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
const apiConfig = new ServiceConfig(stack, 'MyApi', {
  path: '/my-api/url',
});

// Bind to Lambda functions
api.bind([apiConfig]);

// In your frontend stack
const uiConfig = new ServiceConfig(stack, 'MyUi', {
  path: '/my-ui/url',
});
```

#### Runtime Usage (Lambda Functions)

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';

// Fetch configuration (returns Promise<string>)
const apiUrl = await ServiceConfig.MyApi;
const uiUrl = await ServiceConfig.MyUi;

console.log(`API URL: ${apiUrl}`);
```

#### Type Safety

The `ServiceConfigResources` interface is **automatically generated** by SST during deployment in `.sst/types/index.ts`. This provides autocomplete and type checking for all bound ServiceConfig constructs.

**After first deployment**, the types are available automatically:

```typescript
import { ServiceConfig } from '@lib/sst-constructs/node/service-config';

// TypeScript knows about MyApi and MyUi automatically
const apiUrl = await ServiceConfig.MyApi; // ✅ Type-safe
const invalid = await ServiceConfig.NonExistent; // ❌ Compile error
```

**Before first deployment** (optional), you can manually declare types for type-checking:

```typescript
// In your Lambda function file or a types.d.ts file
declare module 'sst/node/config' {
  export interface ServiceConfigResources {
    MyApi: string;
    MyUi: string;
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

### GlobalTable

**DynamoDB Global Table construct** built on CDK's `TableV2` with an SST-style API for multi-region replication.

#### Features

- **Global Replication**: Create replica tables in multiple AWS regions
- **SST-Style API**: Familiar `fields`, `primaryIndex`, `globalIndexes`, `localIndexes` configuration
- **SST Binding Support**: Bind to Lambda functions with automatic IAM permissions
- **DynamoDB Streams**: Stream consumers with filtering support
- **Point-in-Time Recovery**: Enabled by default

#### Basic Usage

```typescript
import { GlobalTable } from '@lib/sst-constructs';

const table = new GlobalTable(stack, 'users', {
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
  },
  primaryIndex: { partitionKey: 'pk', sortKey: 'sk' },
  globalIndexes: {
    gsi1: { partitionKey: 'gsi1pk' },
  },
  replicas: [{ region: 'eu-west-1' }], // Optional: multi-region
});

// Bind to Lambda functions
api.bind([table]);
```

#### Runtime Usage

```typescript
import { GlobalTable } from '@lib/sst-constructs/node/global-table';

const tableName = GlobalTable.users.tableName;
```

#### Stream Consumers

```typescript
const table = new GlobalTable(stack, 'orders', {
  fields: { pk: 'string', sk: 'string' },
  primaryIndex: { partitionKey: 'pk', sortKey: 'sk' },
  stream: 'new_and_old_images',
  consumers: {
    processor: 'src/consumers/processor.handler',
  },
});
```

#### Importing Existing Tables

Import tables in replica regions or for existing infrastructure:

```typescript
// Simple import
const table = GlobalTable.fromTableName(stack, 'Users', 'my-table-name');

// With auto-lookup for stream consumers
const table = GlobalTable.fromTableName(stack, 'Users', 'my-table-name', {
  autoLookupAttributes: true,
});

// With explicit stream ARN (recommended for production)
const table = GlobalTable.fromTableAttributes(stack, 'Users', {
  tableName: 'my-table-name',
  tableStreamArn: 'arn:aws:dynamodb:...',
});
```

#### Multi-Region Pattern

```typescript
import { GlobalTable } from '@lib/sst-constructs';
import { regions } from '@lib/sst-helpers';

const isHomeRegion = app.region === regions.getHomeRegion();
const tableName = app.logicalPrefixedName('sessions');

const table = isHomeRegion
  ? new GlobalTable(stack, 'Sessions', {
      fields: { sessionId: 'string' },
      primaryIndex: { partitionKey: 'sessionId' },
      tableName,
      stream: 'new_and_old_images',
      replicas: [{ region: 'eu-west-1' }],
    })
  : GlobalTable.fromTableName(stack, 'Sessions', tableName, {
      autoLookupAttributes: true,
    });

// Works in any region
table.addConsumers(stack, {
  processor: 'src/consumers/processor.handler',
});
```

#### Configuration Options

| Property              | Type                                                                | Default        | Description         |
| --------------------- | ------------------------------------------------------------------- | -------------- | ------------------- |
| `fields`              | `Record<string, 'string' \| 'number' \| 'binary'>`                  | required       | Table attributes    |
| `primaryIndex`        | `{ partitionKey, sortKey? }`                                        | required       | Primary key         |
| `globalIndexes`       | `Record<string, GlobalTableGlobalIndexProps>`                       | -              | GSIs                |
| `localIndexes`        | `Record<string, GlobalTableLocalIndexProps>`                        | -              | LSIs                |
| `replicas`            | `GlobalTableReplicaProps[]`                                         | -              | Replica regions     |
| `stream`              | `'keys_only' \| 'new_image' \| 'old_image' \| 'new_and_old_images'` | -              | DynamoDB Streams    |
| `consumers`           | `Record<string, FunctionDefinition>`                                | -              | Stream consumers    |
| `timeToLiveAttribute` | `string`                                                            | -              | TTL attribute       |
| `pointInTimeRecovery` | `boolean`                                                           | `true`         | Enable PITR         |
| `tableName`           | `string`                                                            | auto-generated | Override table name |

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

## Development Notes

### Bundler Configuration

This package uses `tsup` for bundling. The `keepNames: true` option is **required** in `tsup.config.ts` to preserve class names at runtime.

**Why this matters**: SST's type generation system uses `constructor.name` to determine the TypeScript interface name (e.g., `GlobalTableResources`). Without `keepNames: true`, bundlers like esbuild may rename classes internally (e.g., `_GlobalTable` instead of `GlobalTable`) when they have static methods that reference the class. This would cause SST to generate incorrect interface names like `_GlobalTableResources`.

```typescript
// tsup.config.ts
export default defineConfig([
  {
    // ... other options
    keepNames: true, // Required for SST type generation
  },
]);
```

**Symptoms of missing `keepNames`**:

- Generated types have underscore prefixes (e.g., `_GlobalTableResources`)
- Runtime `MyConstruct.name` returns `_MyConstruct` instead of `MyConstruct`
- TypeScript autocomplete shows wrong interface names

## Related Packages

- **[@lib/sst-helpers](../sst-helpers)**: Helper functions for SST deployments (DNS, regions, environment config)
- **[@lib/client-internal-api](../client-internal-api)**: AWS Signature V4 signing for internal API calls
