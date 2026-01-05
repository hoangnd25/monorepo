# @lib/sst-helpers

Utility functions and helpers for SST v2 infrastructure code. Provides type-safe abstractions for common infrastructure patterns including region management, deployment controls, environment configuration, and service-to-service communication.

## Installation

```bash
pnpm add @lib/sst-helpers
```

## Overview

This package contains helpers organized into modules:

- **regions**: Multi-region deployment utilities with region groups
- **dns**: DNS/hosted zone resolution by AWS account
- **deploy**: Deployment guards and controls
- **env**: Environment and stage detection utilities
- **removalPolicy**: CDK removal policy helpers for resource lifecycle
- **serviceConfig**: Type-safe SSM-based service-to-service configuration sharing
- **envConfig**: Environment-specific configuration management via SSM

## Modules

### regions

Manages regional deployments with logical region groups. Each group has a primary region and optional secondary regions.

```typescript
import { regions } from '@lib/sst-helpers';

// Get all regions in a group
const usRegions = regions.getRegionsByRegionGroup('us1');
// ['us-west-2', 'us-west-1']

// Get primary region for a group
const primary = regions.getPrimaryRegionByRegionGroup('us1');
// 'us-west-2'

// Check if region is primary
const isPrimary = regions.isPrimaryRegion('us-west-2');
// true

// Get region group from region
const group = regions.getRegionGroup('us-west-1');
// 'us1'

// Get home region (primary of us1)
const home = regions.getHomeRegion();
// 'us-west-2'
```

**Region Groups:**

- `us1`: us-west-2 (primary), us-west-1
- `ap1`: ap-northeast-1 (primary), ap-northeast-2
- `eu1`: eu-west-1 (primary), eu-west-2

### dns

Resolves the main hosted zone based on AWS account.

```typescript
import { dns } from '@lib/sst-helpers';

// Get hosted zone for current account
const zone = dns.mainHostedZone(ctx);
```

### deploy

Controls deployment execution with guards and validation.

```typescript
import { deploy } from '@lib/sst-helpers';

// Only deploy in home region
deploy.checkDeployment(app, { type: 'home-region-only' });

// Allow multi-region deployment
deploy.checkDeployment(app, { type: 'multi-region' });
```

### env

Determines environment and stage types from AWS account and SST stage.

```typescript
import { env } from '@lib/sst-helpers';

// Get environment name
const envName = env.accountEnv(ctx);
// 'DEV' or 'PROD'

// Check if preview/ephemeral stage
const isPreview = env.isPreviewStage(ctx);
// true if DEV account and stage !== 'dev'

// Check if permanent stage
const isPermanent = env.isPermanentStage(ctx);
// true for 'dev' in DEV account or any stage in PROD
```

### removalPolicy

CDK removal policies based on environment and stage permanence.

```typescript
import { removalPolicy } from '@lib/sst-helpers';
import { RemovalPolicy } from 'aws-cdk-lib';

// Retain for permanent stages (dev, prod), destroy for preview
const policy = removalPolicy.retainForPermanentStage(ctx);
// RemovalPolicy.RETAIN or RemovalPolicy.DESTROY

// Retain only for PROD environment
const prodPolicy = removalPolicy.retainForProdEnvironment(ctx);
// RemovalPolicy.RETAIN in PROD, DESTROY in DEV
```

### serviceConfig

Type-safe SSM-based service-to-service configuration sharing. Services publish configuration values to SSM parameters that other services can consume.

**Purpose:** Allows services within the application to share dynamically-generated configuration values with each other. For example, the `auth` service can publish its internal API URL for other services to consume. These parameters are created and managed by the application itself during deployment.

**Key Features:**

- Compile-time type safety for service names and resource keys
- Automatic validation of service dependencies in package.json
- Consistent SSM parameter naming: `/service/<service-name>/<stage>/<resource-key>`
- Stage-specific: Each stage (dev, preview, prod) has its own isolated parameters

```typescript
import { serviceConfig } from '@lib/sst-helpers';

// Publishing service creates parameter
serviceConfig.createParameter(ctx, {
  service: 'shared-infra',
  key: 'internal-api-url',
  value: api.url,
});

// Or using path notation
serviceConfig.createParameter(ctx, {
  path: 'shared-infra/internal-api-url',
  value: api.url,
});

// Consuming service reads parameter value
const apiUrl = serviceConfig.getParameterValue(ctx, {
  service: 'shared-infra',
  key: 'internal-api-url',
});

// Get parameter ARN for IAM policies
const arn = serviceConfig.getParameterArn(ctx, {
  path: 'auth/internal-api-url',
});

// Get parameter name for Lambda environment variables
const paramName = serviceConfig.getParameterName(ctx, {
  service: 'shared-infra',
  key: 'internal-api-id',
});
```

**Important:** Consuming services must declare dependency in `package.json`:

```json
{
  "dependencies": {
    "@infra/shared-infra": "workspace:*"
  }
}
```

This ensures Turborepo deploys services in correct order.

### envConfig

Environment-specific configuration management via SSM. Uses namespaces for logical grouping of related configuration.

**Purpose:** Allows consumption of SSM parameters that are managed outside of the application. These are typically infrastructure resources created manually or by separate processes that need to be shared across different application stages. For example, a single VPC created elsewhere can be referenced by all stages (dev, preview, prod) of the application.

**Key Features:**

- Type-safe namespaces and keys
- Environment-specific values (e.g., prod vs dev)
- SSM parameter format: `/config/<namespace>/<id>/<key>`
- Cross-stage sharing: Same infrastructure resource (like VPC) can be used by multiple stages

```typescript
import { envConfig } from '@lib/sst-helpers';

// Get email identity ARN for 'prod' environment
const emailArn = envConfig.getValue(ctx, {
  namespace: 'email-identity',
  key: 'arn',
  id: 'prod',
});

// Using path notation
const kmsKeyArn = envConfig.getValue(ctx, {
  path: 'kms/key-arn',
  id: 'prod',
});
```

## serviceConfig vs envConfig

Understanding when to use each:

| Aspect             | serviceConfig                                   | envConfig                                         |
| ------------------ | ----------------------------------------------- | ------------------------------------------------- |
| **Purpose**        | Service-to-service communication within the app | Access to external/pre-existing infrastructure    |
| **Created By**     | Application services during deployment          | Manual setup or external processes                |
| **Scope**          | Stage-specific (each stage has own values)      | Shared across stages (same VPC for across stages) |
| **Examples**       | API URLs, API Gateway IDs, Cognito Pool IDs     | VPC IDs, KMS keys, email identities, hosted zones |
| **Parameter Path** | `/service/<service>/<stage>/<key>`              | `/config/<namespace>/<id>/<key>`                  |
| **Dependency**     | Requires package.json dependency                | No dependency required                            |

**Example Scenario:**

```typescript
// envConfig: Get shared VPC created outside the application
// This VPC is used by all stages (dev, preview-branch-1, prod)
const vpcId = envConfig.getValue(ctx, {
  path: 'vpc/id',
  id: 'shared-vpc',
});

// serviceConfig: Get auth service's internal API URL
// This URL is different for each stage
const authApiUrl = serviceConfig.getParameterValue(ctx, {
  path: 'auth/internal-api-url', // different value per stage
});
```

## Usage in Infrastructure Code

```typescript
import { StackContext } from 'sst/constructs';
import { env, regions, removalPolicy, serviceConfig } from '@lib/sst-helpers';

export function MyStack(ctx: StackContext) {
  const { stack } = ctx;

  // Check environment
  const isProd = env.accountEnv(ctx) === 'PROD';
  const isPreview = env.isPreviewStage(ctx);

  // Set removal policy
  const policy = removalPolicy.retainForPermanentStage(ctx);

  // Get shared configuration
  const apiUrl = serviceConfig.getParameterValue(ctx, {
    path: 'shared-infra/internal-api-url',
  });

  // Use in resources
  new Function(stack, 'MyFunction', {
    environment: {
      API_URL: apiUrl,
      IS_PROD: String(isProd),
    },
  });
}
```
