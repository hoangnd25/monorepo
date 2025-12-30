# IAC Code Structure Pattern

## Overview

This project uses **SST v2 (Serverless Stack)** with AWS CDK for infrastructure as code. Each service manages its own infrastructure independently while sharing common constructs through a monorepo workspace structure.

**Technology Stack:**

- SST v2
- AWS CDK
- TypeScript with strict mode
- Turborepo for task orchestration

## Directory Structure

```
services/<service-name>/
├── app/               # Application code (for UI services)
├── functions/         # Lambda function code (for API services)
├── infra/            # Infrastructure code
│   ├── Main.ts       # Main entry point - defines resources
│   └── <resource>/   # Optional subdirectories for complex resources
│       └── <Resource>.ts
├── sst.config.ts     # SST configuration file
├── package.json
└── tsconfig.json
```

## Core Patterns

### 1. Entry Point Convention

Every service has a single entry point for infrastructure:

- **Location**: `infra/Main.ts`
- **Export**: Function named `Main` that accepts `StackContext` (SST v2 pattern)
- **Purpose**: Compose and orchestrate all resources for the service
- **Pattern**: Import constructs, instantiate resources, add stack outputs

### 2. Simple Inline Resources

For straightforward services with minimal infrastructure:

- Define all resources directly in `infra/Main.ts`
- Use SST v2 built-in constructs (`Api`, `Function`, etc. from `sst/constructs`)
- Keep configuration inline
- **When to use**: Single API, simple Lambda functions, basic routing

### 3. Modular Resource Organization

For complex services with multiple resource types:

- Create subdirectories under `infra/` for each resource category
- Define custom CDK Construct classes for complex resources
- Extend `Construct` from `constructs` package
- Use private methods to organize resource creation logic
- Expose public properties for cross-resource references
- **When to use**: Multiple related resources (e.g., Cognito with multiple clients), complex configuration needs

**Structure**:

```
infra/
├── Main.ts           # Entry point - imports and composes
└── <category>/       # e.g., cognito/, database/, storage/
    └── <Resource>.ts # e.g., UserPool.ts, DataStore.ts
```

### 4. Shared Constructs

For infrastructure patterns used across multiple services:

- **Location**: `packages/sst-constructs/src/`
- **Import**: Via `@lib/sst-constructs` workspace package
- **Purpose**: Encapsulate reusable deployment patterns
- **Examples**: SSR site deployment, API patterns, common configurations
- **When to use**: Same infrastructure pattern needed in 2+ services

## Best Practices

### Separation of Concerns

- Keep infrastructure code in `infra/` directory
- Application code stays in `app/` or `functions/`
- Never mix infrastructure logic with application logic

### Progressive Complexity

- Start with inline resources in `Main.ts`
- Extract to separate constructs when complexity grows
- Move to shared constructs when pattern repeats across services

### Type Safety

- Use TypeScript with strict mode for all IAC code
- Define explicit prop types for custom constructs
- Leverage CDK type definitions for AWS resources

### Modularity

- One concern per construct class
- Use private methods to break down resource creation
- Keep public interface minimal (only expose what's needed)

### Clear Exports

- Use `stack.addOutputs()` for deployment-time values (URLs, ARNs, IDs)
- Expose resource properties via public class members for compile-time references
- Document what each output is used for

### Naming Conventions

- PascalCase for construct classes and types
- camelCase for instances and variables
- Descriptive names that indicate purpose

## Stack Outputs

Use `stack.addOutputs()` to expose values from infrastructure:

- Deployment URLs (API endpoints, website URLs)
- Resource identifiers (User Pool IDs, Bucket names)
- Connection strings and endpoints
- Values accessible via SST console or CLI after deployment

## Service Isolation

Each service is independently deployable using SST v2:

- Own `sst.config.ts` configuration
- Own infrastructure stack
- Self-contained resources
- Deploy/remove independently with SST CLI or Turborepo

## Deployment

### Via Turbo (from root directory)

**Deploy all services**:

```bash
pnpm deploy -- --stage <stage-name>
```

**Deploy specific service**:

```bash
pnpm deploy --filter=<service-name> -- --stage <stage-name>
```

Examples:

```bash
# Deploy all services to dev stage
pnpm deploy -- --stage dev

# Deploy only main-ui to dev stage
pnpm deploy --filter=main-ui -- --stage dev

# Deploy auth service to production
pnpm deploy --filter=auth -- --stage prod
```

### Direct service deployment

Alternatively, deploy from within a service directory:

```bash
cd services/<service-name>
pnpm run deploy -- --stage <stage-name>
```

### Remove infrastructure

```bash
cd services/<service-name>
pnpm run remove -- --stage <stage-name>
```

**Stage naming**: Use current branch name for development stages, standard names (prod, staging) for permanent environments

## When to Use Each Pattern

### Inline Resources (Main.ts only)

- Service has 1-3 simple resources
- Configuration is straightforward
- No need for reusability
- Example: Basic API with Lambda function

### Modular Constructs (infra/category/)

- Complex resource with multiple sub-components
- Configuration logic needs organization
- Resource type specific to this service
- Example: Cognito with multiple clients and complex settings

### Shared Constructs (packages/sst-constructs/)

- Pattern used in 2+ services
- Common deployment workflow (e.g., SSR sites)
- Standardized configuration across projects
- Example: Site deployment constructs

## Common Pitfalls to Avoid

- Don't create subdirectories for simple resources
- Don't share constructs prematurely (wait for second use)
- Don't mix application logic in infrastructure code
- Don't hardcode values that should be environment-specific
- Don't skip stack outputs for values needed by other services
