# Integrations Service Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-10

## Context & Problem Statement

### Business Need

As AI Agents become more powerful, they need to interact with external systems to perform real-world actions. Currently, the AI Agents Service supports:

- **System Tools**: Built-in capabilities (send_message, handoff_to_human, etc.)
- **Custom Tools**: Tenant-defined webhooks to their own endpoints

However, there's a gap for **pre-built integrations** with common third-party services that tenants can easily configure and use without building their own webhook handlers.

**Examples of needed integrations:**

| Category       | Use Cases                                         |
| -------------- | ------------------------------------------------- |
| **Shipping**   | Calculate fees, create shipments, track packages  |
| **Payment**    | Check payment status, process refunds             |
| **CRM**        | Look up customer info, update records             |
| **E-commerce** | Check inventory, get order details, update status |
| **Calendar**   | Check availability, book appointments             |

### Pain Points Without This Service

1. **Duplication**: Each tenant must build and maintain their own integrations
2. **Inconsistency**: Different implementations lead to varying reliability
3. **Security burden**: Tenants must handle credential management themselves
4. **Limited AI capabilities**: Agents can't take meaningful actions without external data

### Solution

Build an **Integrations Service** that:

1. **Provides a registry** of available third-party integrations
2. **Manages tenant connections** (credentials, configuration) securely
3. **Executes integration actions** on behalf of tenants
4. **Exposes tools** to AI Agents Service for LLM tool calling
5. **Handles complexity** (rate limiting, retries, error handling, data transformation)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONSUMERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ AI Agents Service │  │ Flows Service     │  │ Main UI               │   │
│  │                   │  │ (Future)          │  │                       │   │
│  │ Tool execution    │  │ Automation steps  │  │ Connection setup      │   │
│  └─────────┬─────────┘  └─────────┬─────────┘  └───────────┬───────────┘   │
│            │                      │                        │               │
└────────────┼──────────────────────┼────────────────────────┼───────────────┘
             │                      │                        │
             └──────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATIONS SERVICE                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Internal API (ORPC + IAM Auth)                     │  │
│  │                                                                       │  │
│  │  Catalog:                      Connections:                           │  │
│  │  • catalog.list                • connections.create                   │  │
│  │  • catalog.get                 • connections.get                      │  │
│  │  • catalog.getActions          • connections.update                   │  │
│  │                                • connections.delete                   │  │
│  │  Execution:                    • connections.test                     │  │
│  │  • actions.execute             • connections.list                     │  │
│  │  • actions.getSchema                                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Execution Engine                                │  │
│  │                                                                       │  │
│  │  1. Validate input against action schema                              │  │
│  │  2. Load tenant's connection config & credentials                     │  │
│  │  3. Apply rate limiting                                               │  │
│  │  4. Execute connector with retry logic                                │  │
│  │  5. Transform response to standard format                             │  │
│  │  6. Log execution for debugging/analytics                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Connectors                                    │  │
│  │                                                                       │  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐      │  │
│  │  │ Shipping         │ │ Payment          │ │ E-commerce       │      │  │
│  │  │                  │ │                  │ │                  │      │  │
│  │  │ • GHN Express    │ │ • VNPay          │ │ • Shopify        │      │  │
│  │  │ • GHTK           │ │ • MoMo           │ │ • Haravan        │      │  │
│  │  │ • Viettel Post   │ │ • ZaloPay        │ │ • Sapo           │      │  │
│  │  │ • J&T Express    │ │ • Stripe         │ │ • WooCommerce    │      │  │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘      │  │
│  │                                                                       │  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐      │  │
│  │  │ CRM              │ │ Calendar         │ │ Communication    │      │  │
│  │  │                  │ │                  │ │                  │      │  │
│  │  │ • HubSpot        │ │ • Google Cal     │ │ • Twilio         │      │  │
│  │  │ • Salesforce     │ │ • Calendly       │ │ • SendGrid       │      │  │
│  │  │ • Zoho           │ │                  │ │                  │      │  │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          Data Layer                                   │  │
│  │                                                                       │  │
│  │  DynamoDB                          Secrets Manager                    │  │
│  │  ┌────────────────────────────┐   ┌────────────────────────────┐     │  │
│  │  │ • Integration Catalog      │   │ • API Keys                 │     │  │
│  │  │ • Tenant Connections       │   │ • OAuth Tokens             │     │  │
│  │  │ • Execution Logs           │   │ • Webhook Secrets          │     │  │
│  │  └────────────────────────────┘   └────────────────────────────┘     │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL APIs                                        │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ GHN API      │ │ VNPay API    │ │ Shopify API  │ │ HubSpot API  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Relationship to AI Agents Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS SERVICE                                 │
│                                                                             │
│  Agent Execution Engine                                                     │
│  │                                                                          │
│  │  Tool Registry:                                                          │
│  │  ├─ System Tools (built-in)                                              │
│  │  │   └─ send_message, handoff_to_human, etc.                             │
│  │  │                                                                       │
│  │  ├─ Custom Tools (tenant webhooks)                                       │
│  │  │   └─ Configured by tenant, calls their endpoints                      │
│  │  │                                                                       │
│  │  └─ Integration Tools (from Integrations Service)  ◄─── NEW              │
│  │      └─ Dynamically loaded based on tenant's connections                 │
│  │                                                                          │
└──┼──────────────────────────────────────────────────────────────────────────┘
   │
   │  On agent invocation:
   │  1. Load tenant's active integration connections
   │  2. For each connection, generate tool definitions from action schemas
   │  3. Include in LLM tool calling context
   │
   │  When LLM calls integration tool:
   │  1. AI Agents calls integrationsClient.actions.execute()
   │  2. Integrations Service executes and returns result
   │  3. Result included in agent's context for next turn
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATIONS SERVICE                                 │
│                                                                             │
│  actions.execute({                                                          │
│    tenantId: "tenant-123",                                                  │
│    integrationId: "shipping-ghn",                                           │
│    actionId: "calculate_fee",                                               │
│    input: {                                                                 │
│      fromDistrict: "Quan 1",                                                │
│      toDistrict: "Quan 7",                                                  │
│      weight: 500,                                                           │
│      serviceType: "express"                                                 │
│    }                                                                        │
│  })                                                                         │
│                                                                             │
│  Returns:                                                                   │
│  {                                                                          │
│    success: true,                                                           │
│    data: {                                                                  │
│      fee: 25000,                                                            │
│      currency: "VND",                                                       │
│      estimatedDays: 1                                                       │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Integration

An **Integration** represents a third-party service that can be connected.

| Field           | Description                                          |
| --------------- | ---------------------------------------------------- |
| `integrationId` | Unique identifier (e.g., `shipping-ghn`)             |
| `category`      | Grouping (`shipping`, `payment`, `crm`, `ecommerce`) |
| `name`          | Display name (e.g., "GHN Express")                   |
| `description`   | What this integration does                           |
| `provider`      | Company/service name                                 |
| `version`       | Schema version for this integration                  |
| `logoUrl`       | Integration logo for UI                              |
| `configSchema`  | JSON Schema for connection configuration             |
| `authType`      | `api_key`, `oauth2`, `basic`, `custom`               |
| `actions`       | List of available actions                            |
| `status`        | `available`, `beta`, `deprecated`                    |

### Action

An **Action** is a specific operation available within an integration.

| Field          | Description                                       |
| -------------- | ------------------------------------------------- |
| `actionId`     | Unique within integration (e.g., `calculate_fee`) |
| `name`         | Human-readable name                               |
| `description`  | What this action does (used by LLM)               |
| `inputSchema`  | JSON Schema for input parameters                  |
| `outputSchema` | JSON Schema for response                          |
| `category`     | Action type (`read`, `write`, `action`)           |
| `rateLimit`    | Calls per minute allowed                          |

**Example Integration with Actions:**

```json
{
  "integrationId": "shipping-ghn",
  "category": "shipping",
  "name": "GHN Express",
  "description": "Vietnam's leading express delivery service",
  "provider": "Giao Hang Nhanh",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["apiKey", "shopId"],
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "Your GHN API key from the developer portal"
      },
      "shopId": {
        "type": "string",
        "title": "Shop ID",
        "description": "Your registered shop ID"
      },
      "environment": {
        "type": "string",
        "enum": ["sandbox", "production"],
        "default": "sandbox"
      }
    }
  },
  "actions": [
    {
      "actionId": "calculate_fee",
      "name": "Calculate Shipping Fee",
      "description": "Calculate the shipping fee for a package based on origin, destination, weight, and service type",
      "category": "read",
      "inputSchema": {
        "type": "object",
        "required": ["fromDistrictId", "toDistrictId", "weight"],
        "properties": {
          "fromDistrictId": {
            "type": "integer",
            "description": "Origin district ID"
          },
          "toDistrictId": {
            "type": "integer",
            "description": "Destination district ID"
          },
          "weight": {
            "type": "integer",
            "description": "Package weight in grams"
          },
          "serviceTypeId": {
            "type": "integer",
            "description": "Service type (1: Express, 2: Standard)"
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "fee": { "type": "integer", "description": "Shipping fee in VND" },
          "estimatedDeliveryDays": { "type": "integer" }
        }
      },
      "rateLimit": 100
    },
    {
      "actionId": "create_order",
      "name": "Create Shipping Order",
      "description": "Create a new shipping order and get tracking number",
      "category": "write",
      "inputSchema": { "...": "..." },
      "outputSchema": { "...": "..." }
    },
    {
      "actionId": "track_order",
      "name": "Track Shipment",
      "description": "Get current status and tracking history of a shipment",
      "category": "read",
      "inputSchema": { "...": "..." },
      "outputSchema": { "...": "..." }
    }
  ]
}
```

### Connection

A **Connection** is a tenant's configured instance of an integration.

| Field            | Description                             |
| ---------------- | --------------------------------------- |
| `tenantId`       | Owning tenant                           |
| `connectionId`   | Unique identifier (ULID)                |
| `integrationId`  | Which integration this connects to      |
| `name`           | Tenant's label (e.g., "Production GHN") |
| `config`         | Non-sensitive configuration             |
| `credentialsRef` | Reference to Secrets Manager secret     |
| `status`         | `active`, `inactive`, `error`           |
| `lastTestedAt`   | When connection was last verified       |
| `lastErrorAt`    | When last error occurred                |
| `lastError`      | Error message if status is `error`      |
| `createdAt`      | Creation timestamp                      |
| `updatedAt`      | Last update timestamp                   |

### Execution Log

An **Execution Log** records each action execution for debugging and analytics.

| Field           | Description                             |
| --------------- | --------------------------------------- |
| `executionId`   | Unique identifier (ULID)                |
| `tenantId`      | Tenant that made the request            |
| `connectionId`  | Connection used                         |
| `integrationId` | Integration executed                    |
| `actionId`      | Action executed                         |
| `input`         | Input parameters (sanitized)            |
| `output`        | Response data (sanitized)               |
| `status`        | `success`, `error`, `timeout`           |
| `errorMessage`  | Error details if failed                 |
| `latencyMs`     | Execution duration                      |
| `callerService` | Which service called (ai-agents, flows) |
| `callerRef`     | Reference ID from caller (executionId)  |
| `createdAt`     | Timestamp                               |

---

## Internal API Contract

### Catalog APIs

```typescript
// List available integrations
export const listIntegrations = oc
  .route({ method: 'GET', path: '/catalog' })
  .input(
    z.object({
      category: z.string().optional(),
      status: z.enum(['available', 'beta', 'deprecated']).optional(),
    })
  )
  .output(
    z.object({
      integrations: z.array(IntegrationSummarySchema),
    })
  );

// Get integration details including actions
export const getIntegration = oc
  .route({ method: 'GET', path: '/catalog/{integrationId}' })
  .input(
    z.object({
      integrationId: z.string(),
    })
  )
  .output(IntegrationSchema);

// Get action schema (for dynamic tool generation)
export const getActionSchema = oc
  .route({ method: 'GET', path: '/catalog/{integrationId}/actions/{actionId}' })
  .input(
    z.object({
      integrationId: z.string(),
      actionId: z.string(),
    })
  )
  .output(ActionSchema);
```

### Connection APIs

```typescript
// Create a new connection
export const createConnection = oc
  .route({ method: 'POST', path: '/connections' })
  .input(
    z.object({
      integrationId: z.string(),
      name: z.string(),
      config: z.record(z.unknown()),
      credentials: z.record(z.string()), // Will be stored in Secrets Manager
    })
  )
  .output(ConnectionSchema);

// List tenant's connections
export const listConnections = oc
  .route({ method: 'GET', path: '/connections' })
  .input(
    z.object({
      integrationId: z.string().optional(),
      status: z.enum(['active', 'inactive', 'error']).optional(),
    })
  )
  .output(
    z.object({
      connections: z.array(ConnectionSchema),
    })
  );

// Test a connection
export const testConnection = oc
  .route({ method: 'POST', path: '/connections/{connectionId}/test' })
  .input(
    z.object({
      connectionId: z.string(),
    })
  )
  .output(
    z.object({
      success: z.boolean(),
      message: z.string(),
      testedAt: z.string(),
    })
  );

// Update connection
export const updateConnection = oc
  .route({ method: 'PATCH', path: '/connections/{connectionId}' })
  .input(
    z.object({
      connectionId: z.string(),
      name: z.string().optional(),
      config: z.record(z.unknown()).optional(),
      credentials: z.record(z.string()).optional(),
      status: z.enum(['active', 'inactive']).optional(),
    })
  )
  .output(ConnectionSchema);

// Delete connection
export const deleteConnection = oc
  .route({ method: 'DELETE', path: '/connections/{connectionId}' })
  .input(
    z.object({
      connectionId: z.string(),
    })
  )
  .output(z.object({ success: z.boolean() }));
```

### Execution APIs

```typescript
// Execute an integration action
export const executeAction = oc
  .route({ method: 'POST', path: '/execute' })
  .input(
    z.object({
      connectionId: z.string(), // Which connection to use
      actionId: z.string(), // Which action to execute
      input: z.record(z.unknown()), // Action parameters
      callerService: z.string().optional(), // For logging
      callerRef: z.string().optional(), // For correlation
    })
  )
  .output(
    z.object({
      success: z.boolean(),
      executionId: z.string(),
      data: z.unknown().optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
        })
        .optional(),
      latencyMs: z.number(),
    })
  );

// Get execution logs
export const listExecutions = oc
  .route({ method: 'GET', path: '/executions' })
  .input(
    z.object({
      connectionId: z.string().optional(),
      integrationId: z.string().optional(),
      status: z.enum(['success', 'error', 'timeout']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    })
  )
  .output(
    z.object({
      executions: z.array(ExecutionLogSchema),
      nextCursor: z.string().optional(),
    })
  );
```

---

## Service Structure

```
services/integrations/
├── functions/
│   └── src/
│       ├── internal-api/
│       │   ├── router.ts            # ORPC router
│       │   ├── catalog.ts           # Catalog handlers
│       │   ├── connections.ts       # Connection CRUD handlers
│       │   └── execute.ts           # Execution handler
│       │
│       ├── connectors/
│       │   ├── base.ts              # Base connector interface
│       │   ├── registry.ts          # Connector registry
│       │   │
│       │   ├── shipping/
│       │   │   ├── ghn/
│       │   │   │   ├── connector.ts # GHN connector implementation
│       │   │   │   ├── actions.ts   # Action implementations
│       │   │   │   ├── client.ts    # GHN API client
│       │   │   │   ├── types.ts     # GHN-specific types
│       │   │   │   └── index.ts
│       │   │   ├── ghtk/
│       │   │   │   └── ...
│       │   │   └── index.ts         # Shipping category exports
│       │   │
│       │   ├── payment/
│       │   │   ├── vnpay/
│       │   │   ├── momo/
│       │   │   └── index.ts
│       │   │
│       │   ├── ecommerce/
│       │   │   ├── shopify/
│       │   │   ├── haravan/
│       │   │   └── index.ts
│       │   │
│       │   └── crm/
│       │       ├── hubspot/
│       │       └── index.ts
│       │
│       └── lib/
│           ├── db/
│           │   ├── connections.ts    # Connection repository
│           │   └── executions.ts     # Execution log repository
│           │
│           ├── credentials/
│           │   ├── manager.ts        # Secrets Manager wrapper
│           │   └── encryption.ts     # Additional encryption helpers
│           │
│           ├── rate-limiter.ts       # Per-integration rate limiting
│           ├── retry.ts              # Retry logic with backoff
│           └── sanitizer.ts          # PII removal for logs
│
├── infra/
│   ├── Main.ts                       # Stack definition
│   ├── Api.ts                        # Internal API setup
│   ├── Database.ts                   # DynamoDB tables
│   └── Secrets.ts                    # Secrets Manager setup
│
├── sst.config.ts
└── package.json
```

---

## Connector Implementation Pattern

### Base Connector Interface

```typescript
// functions/src/connectors/base.ts

export interface ConnectorConfig {
  credentials: Record<string, string>;
  config: Record<string, unknown>;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface Connector {
  readonly integrationId: string;
  readonly definition: IntegrationDefinition;

  // Test if credentials are valid
  testConnection(
    config: ConnectorConfig
  ): Promise<ActionResult<{ message: string }>>;

  // Execute an action
  executeAction<TInput, TOutput>(
    actionId: string,
    input: TInput,
    config: ConnectorConfig
  ): Promise<ActionResult<TOutput>>;
}

export abstract class BaseConnector implements Connector {
  abstract readonly integrationId: string;
  abstract readonly definition: IntegrationDefinition;

  protected abstract actions: Map<string, ActionHandler>;

  async testConnection(
    config: ConnectorConfig
  ): Promise<ActionResult<{ message: string }>> {
    // Default implementation - override if needed
    throw new Error('testConnection not implemented');
  }

  async executeAction<TInput, TOutput>(
    actionId: string,
    input: TInput,
    config: ConnectorConfig
  ): Promise<ActionResult<TOutput>> {
    const handler = this.actions.get(actionId);
    if (!handler) {
      return {
        success: false,
        error: {
          code: 'ACTION_NOT_FOUND',
          message: `Action ${actionId} not found in ${this.integrationId}`,
          retryable: false,
        },
      };
    }

    return handler(input, config);
  }
}
```

### Example Connector: GHN Express

```typescript
// functions/src/connectors/shipping/ghn/connector.ts

import { BaseConnector, ConnectorConfig, ActionResult } from '../../base';
import { GHNClient } from './client';
import { ghnDefinition } from './definition';

export class GHNConnector extends BaseConnector {
  readonly integrationId = 'shipping-ghn';
  readonly definition = ghnDefinition;

  protected actions = new Map([
    ['calculate_fee', this.calculateFee.bind(this)],
    ['create_order', this.createOrder.bind(this)],
    ['track_order', this.trackOrder.bind(this)],
    ['get_districts', this.getDistricts.bind(this)],
  ]);

  private getClient(config: ConnectorConfig): GHNClient {
    return new GHNClient({
      apiKey: config.credentials.apiKey,
      shopId: config.config.shopId as string,
      environment:
        (config.config.environment as 'sandbox' | 'production') || 'sandbox',
    });
  }

  async testConnection(
    config: ConnectorConfig
  ): Promise<ActionResult<{ message: string }>> {
    try {
      const client = this.getClient(config);
      await client.getShopInfo();
      return {
        success: true,
        data: { message: 'Connection successful' },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: false,
        },
      };
    }
  }

  private async calculateFee(
    input: CalculateFeeInput,
    config: ConnectorConfig
  ): Promise<ActionResult<CalculateFeeOutput>> {
    try {
      const client = this.getClient(config);
      const result = await client.calculateFee({
        from_district_id: input.fromDistrictId,
        to_district_id: input.toDistrictId,
        weight: input.weight,
        service_type_id: input.serviceTypeId,
      });

      return {
        success: true,
        data: {
          fee: result.total,
          currency: 'VND',
          estimatedDeliveryDays: result.expected_delivery_time,
          breakdown: {
            mainFee: result.main_service,
            insurance: result.insurance,
            surcharge: result.surcharge,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CALCULATE_FEE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  // ... other action implementations
}
```

---

## Infrastructure

### DynamoDB Tables

**Connections Table:**

| Key | Type | Description                 |
| --- | ---- | --------------------------- |
| PK  | S    | `TENANT#<tenantId>`         |
| SK  | S    | `CONNECTION#<connectionId>` |

GSI: `ConnectionsByIntegration`

- PK: `TENANT#<tenantId>`
- SK: `INTEGRATION#<integrationId>#<connectionId>`

**Executions Table:**

| Key | Type | Description                      |
| --- | ---- | -------------------------------- |
| PK  | S    | `TENANT#<tenantId>`              |
| SK  | S    | `EXEC#<timestamp>#<executionId>` |

GSI: `ExecutionsByConnection`

- PK: `CONNECTION#<connectionId>`
- SK: `<timestamp>#<executionId>`

TTL: 30 days for execution records

### Secrets Manager Structure

```
/integrations/{tenantId}/{connectionId}
└── {
      "apiKey": "xxx",
      "secretKey": "yyy",
      ...
    }
```

### IAM Permissions

```typescript
// Secrets Manager access
{
  actions: [
    'secretsmanager:CreateSecret',
    'secretsmanager:GetSecretValue',
    'secretsmanager:UpdateSecret',
    'secretsmanager:DeleteSecret',
  ],
  resources: [`arn:aws:secretsmanager:${region}:${account}:secret:/integrations/*`],
}

// DynamoDB access
{
  actions: [
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:UpdateItem',
    'dynamodb:DeleteItem',
    'dynamodb:Query',
  ],
  resources: [
    `arn:aws:dynamodb:${region}:${account}:table/Integrations-*`,
  ],
}
```

---

## Security Considerations

### Credential Management

1. **Storage**: All credentials stored in AWS Secrets Manager (never in DynamoDB)
2. **Encryption**: Secrets Manager uses AWS KMS for encryption at rest
3. **Access**: Lambda IAM role has least-privilege access to specific secret paths
4. **Rotation**: Support credential rotation without service disruption

### Data Sanitization

1. **Logs**: Remove PII and sensitive data before logging
2. **Responses**: Never expose raw credentials in API responses
3. **Errors**: Sanitize error messages from external APIs

### Rate Limiting

1. **Per-integration**: Respect external API rate limits
2. **Per-tenant**: Prevent abuse by limiting calls per tenant
3. **Circuit breaker**: Temporarily disable failing integrations

### Input Validation

1. **Schema validation**: Validate all inputs against JSON Schema
2. **Size limits**: Restrict input/output payload sizes
3. **Timeout**: Enforce maximum execution time per action

---

## Architecture Decisions

### Why Separate Service?

| Factor           | Same Service (AI Agents) | Separate Service     |
| ---------------- | ------------------------ | -------------------- |
| Reusability      | Only AI Agents can use   | Any service can use  |
| Deployment       | Coupled releases         | Independent releases |
| Team ownership   | Shared responsibility    | Clear ownership      |
| Credential scope | Broader access           | Isolated access      |
| Scaling          | Scale together           | Scale independently  |

**Decision**: Separate service for better isolation, reusability, and independent scaling.

### Integration Catalog Storage

| Option        | Pros                     | Cons                   |
| ------------- | ------------------------ | ---------------------- |
| Code (static) | Type-safe, versioned     | Requires deploy to add |
| DynamoDB      | Dynamic, runtime updates | Less type safety       |
| Hybrid        | Best of both             | More complexity        |

**Decision**: Start with **code-based catalog** for type safety. Add DynamoDB-backed custom integrations in future phases for tenant-defined integrations.

### Connector Execution Model

| Option          | Pros                     | Cons                      |
| --------------- | ------------------------ | ------------------------- |
| Inline (Lambda) | Simple, low latency      | Timeout constraints       |
| Step Functions  | Long-running, retries    | Higher latency, cost      |
| Async (SQS)     | Scalable, retry built-in | Not suitable for sync use |

**Decision**: **Inline Lambda** for most actions (< 30 second operations). Consider Step Functions for long-running operations in future.

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Service scaffolding (sst.config, infra)
- [ ] DynamoDB tables (Connections, Executions)
- [ ] Secrets Manager integration
- [ ] Base connector interface
- [ ] Internal API structure

### Phase 2: First Connectors

- [ ] GHN Express connector (shipping)
- [ ] Connection CRUD APIs
- [ ] Connection testing
- [ ] Execution logging
- [ ] Basic rate limiting

### Phase 3: AI Agents Integration

- [ ] API contract package
- [ ] AI Agents Service integration
- [ ] Dynamic tool generation from action schemas
- [ ] End-to-end testing with agent execution

### Phase 4: Expansion

- [ ] Additional shipping connectors (GHTK, Viettel Post)
- [ ] E-commerce connectors (Shopify, Haravan)
- [ ] Payment connectors (VNPay, MoMo)
- [ ] UI for connection management

### Phase 5: Advanced Features

- [ ] OAuth2 flow support
- [ ] Webhook receivers for async events
- [ ] Custom tenant-defined integrations
- [ ] Analytics dashboard

---

## Future Considerations

### Tenant-Defined Integrations

Allow tenants to create their own integrations by defining:

- API endpoint patterns
- Authentication method
- Request/response transformations
- Action schemas

### Marketplace

- Publish integrations to marketplace
- Allow third-party developers to contribute connectors
- Review and certification process

### Event-Driven Integrations

- Receive webhooks from external services
- Transform and route events to tenant's agents
- Example: Shopify order created -> trigger agent

---

## Connector Specifications

Detailed integration specifications are maintained in separate documents for each connector. See the [integrations/](./integrations/) folder for full specifications including:

- Authentication models and credential requirements
- Connection configuration schemas
- AI Agent tool definitions with input/output schemas
- Status code references
- Webhook payload formats
- Error handling guidelines
- Rate limiting recommendations

### Shipping Integrations

| Integration                   | Status     | Specification                                                     |
| ----------------------------- | ---------- | ----------------------------------------------------------------- |
| GHN Express (Giao Hang Nhanh) | Documented | [shipping-ghn.md](./integrations/shipping-ghn.md)                 |
| GHTK (Giao Hang Tiet Kiem)    | Documented | [shipping-ghtk.md](./integrations/shipping-ghtk.md)               |
| Viettel Post (VTP)            | Documented | [shipping-viettelpost.md](./integrations/shipping-viettelpost.md) |
| J&T Express                   | Planned    | -                                                                 |

### Payment Integrations

| Integration | Status     | Specification                                           |
| ----------- | ---------- | ------------------------------------------------------- |
| ZaloPay     | Documented | [payment-zalopay.md](./integrations/payment-zalopay.md) |
| MoMo        | Documented | [payment-momo.md](./integrations/payment-momo.md)       |
| VNPay       | Planned    | -                                                       |

### E-commerce Integrations

| Integration | Status     | Specification                                                     | Token Refresh                    |
| ----------- | ---------- | ----------------------------------------------------------------- | -------------------------------- |
| Sapo        | Documented | [ecommerce-sapo.md](./integrations/ecommerce-sapo.md)             | Not needed (permanent)           |
| Haravan     | Documented | [ecommerce-haravan.md](./integrations/ecommerce-haravan.md)       | Not needed (permanent)           |
| Shopify     | Documented | [ecommerce-shopify.md](./integrations/ecommerce-shopify.md)       | Required (1h token, 90d refresh) |
| PrestaShop  | Documented | [ecommerce-prestashop.md](./integrations/ecommerce-prestashop.md) | Not needed (API key permanent)   |

### CRM Integrations (Planned)

| Integration | Status  | Specification |
| ----------- | ------- | ------------- |
| HubSpot     | Planned | -             |
| Zoho        | Planned | -             |

---

## References

### Related Architecture Docs

- [AI Agents Service Architecture](./ai-agents-service-architecture.md)
- [Conversations Service Architecture](./conversations-service-architecture.md)

### External APIs (Examples)

- [GHN API Documentation](https://api.ghn.vn/home/docs/detail)
- [GHTK API Documentation](https://docs.giaohangtietkiem.vn/)
- [Shopify Admin API](https://shopify.dev/docs/api/admin-rest)
- [HubSpot API](https://developers.hubspot.com/docs/api/overview)
