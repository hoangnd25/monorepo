# Agent Guidelines

## Critical Rules

1. **Always ask for AWS credentials method and stage name** before running `dev`, `deploy`, or `system-tests` commands
2. **Always read README.md** in any package/service directory before working with it
3. **Never import from `@chakra-ui/*` directly** - use `@lib/ui` package
4. **Internal API calls work only in server functions** - not client components
5. **Consult testing docs first**: `docs/iac-testing.md` for writing infrastructure unit test, `docs/manual-testing.md` for running manual browser/UI test

## Tech Stack

| Layer          | Technology                                       |
| -------------- | ------------------------------------------------ |
| Frontend       | TanStack Start (React 19, file-based routing)    |
| Backend        | AWS Lambda via SST v2                            |
| Infrastructure | SST v2 + AWS CDK                                 |
| Inter-service  | ORPC (contract-first, type-safe RPC, AWS Sig V4) |
| Monorepo       | Turborepo + pnpm workspaces with catalog         |

## Commands Reference

### Quick Reference

| Task       | Command           | Notes                         |
| ---------- | ----------------- | ----------------------------- |
| Install    | `pnpm install`    | Node.js >=22, pnpm >=10.26.2  |
| Build      | `pnpm build`      | All packages/services         |
| Lint       | `pnpm lint`       | All, or `--filter <pkg>`      |
| Type Check | `pnpm type-check` | All, or `--filter <pkg>`      |
| Format     | `pnpm format`     | `format:check` for check only |

### Development (requires AWS credentials + stage)

```bash
# Backend service
cd services/<service-name> && pnpm dev --stage <stage>

# Frontend service
cd services/<service-name>/app && pnpm dev --stage <stage>

# Check if already running
ps aux | grep "sst dev"
ps aux | grep "vite dev"
```

### Testing

```bash
# Unit tests
pnpm test                                             # watch mode
pnpm test:run                                         # single run
pnpm test:run src/path/to/file.test.tsx               # single file

# Unit tests for infrastructure (IAC) code at service root
cd services/<service-name> && pnpm test

# Unit tests for frontend app
cd services/<service-name>/app && pnpm test

# Unit tests for backend service code
cd services/<service-name>/functions && pnpm test

# System tests (requires AWS credentials)
cd system-tests && aws-vault exec <profile> -- pnpm system-tests -- --stage <stage>
```

### Deployment

```bash
# With aws-vault
aws-vault exec <profile> -- pnpm --filter @infra/<service> deploy -- --stage <stage>

# With env credentials
pnpm --filter @infra/<service> deploy -- --stage <stage>

# Within service folder
cd services/<service-name> && pnpm deploy --stage <stage>
```

### Turborepo Filters

```bash
pnpm --filter <pkg> <task>              # Single package
pnpm --filter '@infra/*' <task>         # Wildcard (quotes required)
pnpm --filter '<pkg>...' <task>         # Include dependencies
pnpm --filter '!<pkg>' <task>           # Exclude package
```

## Directory Structure

### Services (`services/`)

All services have `infra/` at root for infrastructure code. Service types:

**Backend** (run `pnpm dev` from service root):

```
services/<name>/
├── functions/src/     # Lambda code
├── functions/test/    # Function tests
├── infra/Main.ts      # Stack definition
└── sst.config.ts
```

**Frontend** (run `pnpm dev` from `app/`):

```
services/<name>/
├── app/src/routes/    # File-based routing
├── app/src/server/    # Server functions
├── infra/Main.ts      # Stack definition
└── sst.config.ts
```

**Infrastructure-only**:

```
services/<name>/
├── infra/Main.ts      # Stack definition
└── sst.config.ts
```

### Packages (`packages/`)

| Type      | Purpose               | Discovery                  |
| --------- | --------------------- | -------------------------- |
| UI        | Component libraries   | "ui" in name               |
| Contract  | API schemas (ORPC)    | "contract" in name         |
| Client    | API clients with auth | "client" in name           |
| Construct | SST/CDK constructs    | "construct", "sst" in name |
| Config    | ESLint, TS configs    | "config-" prefix           |

## Architectural Patterns

### Internal APIs (ORPC)

Pattern: Contract definition -> Implementation -> Client usage

- Uses AWS Signature V4 signing
- Lambda handler prefix must match API Gateway route prefix
- **See**: `docs/internal-api.md`

### Service Configuration (SSM)

Naming: `/service/{service-name}/{stage}/{key}`

- **See**: `docs/iac-patterns.md`

### Shared Infrastructure

1. Shared service creates base resources (HTTP API Gateway)
2. Other services import and add routes under a prefix
3. Routes use IAM authorization
4. Discovery via SSM parameters

**Important**: Declare workspace dependency when importing from other services' infrastructure.

## Code Style

### Imports

```typescript
import { Button } from '@lib/ui'; // UI components - ALWAYS use @lib/ui
import { NitroSite, ServiceConfig } from '@lib/sst-constructs'; // SST constructs
import { someHelper } from '@lib/sst-constructs/node'; // SST constructs consumption in lambda code
```

### Package Dependencies

```json
{
  "dependencies": {
    "@lib/ui": "workspace:*", // Internal packages
    "react": "catalog:" // Shared versions
  }
}
```

Catalog versions: react, typescript, zod, vitest, @testing-library/_, @types/node, @types/aws-lambda, @aws-sdk/_

### Naming Conventions

| Type       | Convention           | Example                      |
| ---------- | -------------------- | ---------------------------- |
| Files      | kebab-case           | `user-profile.tsx`           |
| Components | PascalCase export    | `export const UserProfile`   |
| Functions  | camelCase            | `getUserById`                |
| Routes     | Framework convention | `index.tsx`, `users/$id.tsx` |
| Tests      | `.test.` suffix      | `user-profile.test.tsx`      |

### TypeScript & Formatting

- Strict mode: `strict: true`, `strictNullChecks: true`
- No `any` (ESLint error)
- Zod v4 for runtime validation
- Prettier: single quotes, semicolons, 2-space indent, 80 char width

### ESLint Configs

| App Type         | Config                    |
| ---------------- | ------------------------- |
| TanStack Start   | `@config/eslint/tanstack` |
| Node.js services | `@config/eslint/node`     |
| React libraries  | `@config/eslint/react`    |

### Testing

- Vitest with jsdom
- Custom render from `~/test/test-utils.tsx` (wraps ChakraProvider)
- Mock TanStack Router with `createRouter`/`createRoute`
- Infrastructure tests: see `docs/iac-testing.md`

### Chakra UI v3

Use composition pattern:

```tsx
<Component.Root>
  <Component.Body />
</Component.Root>
```

## Common Gotchas

1. **AWS credentials for dev**: Services calling internal APIs need credentials
2. **Deployment order**: Use monorepo-level commands for automatic dependency ordering
3. **Infrastructure tests**: Named functions for stack, mock `@lib/sst-helpers`, call `await app.finish()` before assertions

## Documentation Index

| Topic                  | Location                 |
| ---------------------- | ------------------------ |
| Local Development      | `docs/local-dev.md`      |
| Manual Browser Testing | `docs/manual-testing.md` |
| IAC Testing            | `docs/iac-testing.md`    |
| IAC Patterns           | `docs/iac-patterns.md`   |
| Internal APIs          | `docs/internal-api.md`   |
| Authentication         | `docs/auth.md`           |
