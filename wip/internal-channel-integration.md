# Internal Channel Integration Guide

> **Status**: Reference Documentation
> **Last Updated**: 2026-01-10
> **Platform**: Internal Messaging (Widget + API)

## Overview

This document details the technical integration for our **Internal Channel** - a first-party messaging channel that enables:

1. **Widget Chat**: Embeddable chat widget for tenant websites/applications
2. **Dashboard Testing**: Direct AI agent testing within the main-ui dashboard
3. **API Access**: Programmatic messaging for tenants building custom chat interfaces

Unlike external platforms (Meta, Zalo, Gmail), the Internal Channel is fully controlled by us, requiring no external webhooks, OAuth flows, or token management.

---

## Use Cases

### Primary Use Cases

| Use Case             | Description                                                                        | User          |
| -------------------- | ---------------------------------------------------------------------------------- | ------------- |
| **AI Agent Testing** | Tenants test AI agents directly in dashboard before deploying to external channels | Tenant admins |
| **Embedded Widget**  | Tenants embed chat widget in their websites for customer support                   | End customers |
| **Custom Chat UI**   | Tenants build custom chat interfaces using our API                                 | Developers    |
| **Internal Support** | Tenants provide internal support channels for their teams                          | Team members  |

### Why Internal Channel?

1. **Zero external dependencies** - No Meta, Google, or third-party API limits
2. **Instant setup** - No OAuth, no app review, no verification
3. **Full control** - Custom styling, branding, behavior
4. **Testing ground** - Safe environment to test AI agents
5. **Fallback option** - Works when external channels are rate-limited or down

---

## Platform Characteristics

### Comparison with External Platforms

| Feature              | Internal Channel     | Meta (FB/IG/WA)     | Zalo             | Gmail            |
| -------------------- | -------------------- | ------------------- | ---------------- | ---------------- |
| Messaging window     | **None**             | 24h                 | 7 days           | None             |
| OAuth required       | **No**               | Yes                 | Yes              | Yes              |
| Token management     | **No**               | Yes (never expires) | Yes (refresh)    | Yes (refresh)    |
| Webhook verification | **No**               | HMAC-SHA256         | MAC              | JWT              |
| Rate limits          | **Configurable**     | Platform-defined    | Platform-defined | Platform-defined |
| Template messages    | **Optional**         | Required (WA)       | Required (ZBS)   | N/A              |
| Real-time delivery   | **WebSocket**        | Webhook delay       | Webhook delay    | Pub/Sub delay    |
| Attachment storage   | **S3 (our control)** | Platform CDN        | Platform CDN     | Gmail storage    |

### Key Differences

1. **No external webhooks** - Messages flow directly through our infrastructure
2. **Real-time WebSocket** - Instant message delivery, no polling needed
3. **No messaging window** - Can send messages anytime
4. **No token expiration** - API keys managed internally
5. **Custom participant IDs** - We control the ID format

---

## Architecture

### Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTERNAL CHANNEL SOURCES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Dashboard Chat    │  │   Embedded Widget   │  │   Tenant API        │  │
│  │   (main-ui)         │  │   (JS SDK)          │  │   (REST/WebSocket)  │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘  │
│             │                        │                        │             │
└─────────────┼────────────────────────┼────────────────────────┼─────────────┘
              │                        │                        │
              │ Internal API           │ Public API             │ Public API
              │ (IAM Auth)             │ (API Key + Session)    │ (API Key)
              │                        │                        │
              ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVERSATIONS SERVICE                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       API Gateway (Shared HTTP API)                   │  │
│  │                                                                       │  │
│  │  Internal (IAM Auth):           Public (API Key Auth):                │  │
│  │  • POST /internal/messages      • POST /v1/chat/sessions              │  │
│  │  • GET  /internal/conversations • POST /v1/chat/sessions/:id/messages │  │
│  │                                 • GET  /v1/chat/sessions/:id/messages │  │
│  │                                 • WS   /v1/chat/ws                    │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Lambda: Internal Channel Handler                  │  │
│  │  1. Validate request (API key, session, permissions)                  │  │
│  │  2. Lookup/create conversation                                        │  │
│  │  3. Store message in DynamoDB                                         │  │
│  │  4. Push to WebSocket connections (real-time)                         │  │
│  │  5. Trigger AI agent if configured                                    │  │
│  │  6. Emit EventBridge event                                            │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│            ┌───────────────────────┼───────────────────────┐                │
│            │                       │                       │                │
│            ▼                       ▼                       ▼                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐    │
│  │   DynamoDB      │   │  API Gateway    │   │   EventBridge           │    │
│  │                 │   │  WebSocket      │   │                         │    │
│  │  • Channels     │   │                 │   │  Events:                │    │
│  │  • Conversations│   │  Real-time      │   │  • message.new          │    │
│  │  • Messages     │   │  push to        │   │  • message.sent         │    │
│  │  • Sessions     │   │  connected      │   │  • session.created      │    │
│  │  • Connections  │   │  clients        │   │  • session.ended        │    │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component            | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| **Internal API**     | main-ui dashboard access (IAM auth)                   |
| **Public API**       | Widget and tenant API access (API key + session auth) |
| **WebSocket API**    | Real-time message delivery                            |
| **Session Manager**  | Tracks active chat sessions and connections           |
| **AI Agent Trigger** | Routes messages to AI agents when configured          |

---

## Core Concepts

### Channel (Internal)

An Internal Channel represents a tenant's internal messaging endpoint.

| Field            | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `tenantId`       | Owning tenant                                         |
| `channelId`      | Unique identifier (ULID)                              |
| `platform`       | `internal`                                            |
| `platformId`     | `internal-{tenantId}` (auto-generated)                |
| `name`           | Display name (e.g., "Website Chat", "Support Widget") |
| `config`         | Channel-specific configuration (see below)            |
| `apiKeyHash`     | Hashed API key for public access                      |
| `allowedOrigins` | CORS origins for widget embedding                     |
| `status`         | `active` \| `disabled`                                |
| `createdAt`      | Timestamp when channel was created                    |

#### Channel Configuration

```typescript
interface InternalChannelConfig {
  // Widget customization
  widget?: {
    enabled: boolean;
    title: string;
    subtitle?: string;
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left';
    avatarUrl?: string;
    welcomeMessage?: string;
  };

  // AI agent configuration
  aiAgent?: {
    enabled: boolean;
    agentId: string;
    autoReply: boolean; // Auto-respond to all messages
    fallbackToHuman: boolean; // Transfer to human on failure
  };

  // Session settings
  session?: {
    idleTimeoutMinutes: number; // Default: 30
    maxDurationHours: number; // Default: 24
    requireIdentification: boolean; // Require name/email
  };

  // Rate limiting
  rateLimit?: {
    messagesPerMinute: number; // Default: 30
    messagesPerSession: number; // Default: 500
  };
}
```

### Session

A **Session** represents an active chat session (equivalent to a Conversation for external channels, but with session-specific metadata).

| Field                 | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `tenantId`            | Owning tenant                                                       |
| `sessionId`           | Unique identifier (ULID)                                            |
| `channelId`           | Parent channel                                                      |
| `conversationId`      | Linked conversation (1:1 mapping)                                   |
| `participantId`       | Visitor/user identifier                                             |
| `participantType`     | `anonymous` \| `identified` \| `authenticated`                      |
| `participantName`     | Visitor name (if provided)                                          |
| `participantEmail`    | Visitor email (if provided)                                         |
| `participantMetadata` | Custom metadata from tenant                                         |
| `status`              | `active` \| `idle` \| `ended`                                       |
| `startedAt`           | Session start time                                                  |
| `lastActivityAt`      | Last message timestamp                                              |
| `endedAt`             | Session end time (if ended)                                         |
| `endReason`           | `idle_timeout` \| `user_ended` \| `agent_ended` \| `duration_limit` |
| `connectionIds`       | Active WebSocket connection IDs                                     |

### Message (Internal)

Messages follow the same unified format as external channels, with additional internal-specific fields:

| Field            | Description                                     |
| ---------------- | ----------------------------------------------- |
| `conversationId` | Parent conversation                             |
| `messageId`      | Unique identifier (ULID)                        |
| `platformMsgId`  | Same as messageId for internal (no external ID) |
| `sessionId`      | Linked session                                  |
| `direction`      | `inbound` (visitor) \| `outbound` (agent/AI)    |
| `senderId`       | Sender identifier                               |
| `senderType`     | `visitor` \| `agent` \| `ai` \| `system`        |
| `content`        | Message content                                 |
| `contentType`    | `text` \| `image` \| `file` \| `system`         |
| `attachments`    | Array of attachment references                  |
| `metadata`       | Custom metadata                                 |
| `sentAt`         | Timestamp                                       |
| `status`         | `sent` \| `delivered` \| `read`                 |

---

## Authentication & Authorization

### Authentication Methods

| Method                | Use Case            | How It Works                      |
| --------------------- | ------------------- | --------------------------------- |
| **IAM Auth**          | Dashboard (main-ui) | AWS Signature V4 via internal API |
| **API Key + Session** | Widget              | API key in header + session token |
| **API Key Only**      | Tenant backend API  | API key in header                 |

### API Key Management

```typescript
interface ApiKeyRecord {
  tenantId: string;
  channelId: string;
  keyId: string; // Public identifier (prefix of the key)
  keyHash: string; // SHA-256 hash of full key
  name: string; // Human-readable name
  permissions: ApiKeyPermission[];
  allowedOrigins: string[]; // CORS origins
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  status: 'active' | 'revoked';
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
}

type ApiKeyPermission =
  | 'chat:read' // Read messages
  | 'chat:write' // Send messages
  | 'session:create' // Create new sessions
  | 'session:read' // Read session info
  | 'session:end'; // End sessions
```

### API Key Format

```
intk_<channelId-prefix>_<random-32-chars>
```

Example: `intk_01HN_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

- Prefix `intk_` identifies internal channel keys
- Channel ID prefix for quick identification
- 32 random alphanumeric characters
- Only shown once at creation (store securely)

### Session Token

For widget/embedded chat, sessions use short-lived tokens:

```typescript
interface SessionToken {
  sessionId: string;
  channelId: string;
  participantId: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

// Encoded as JWT-like token (base64url)
// Token format: <header>.<payload>.<signature>
```

---

## API Endpoints

### Internal API (IAM Auth) - For Dashboard

These endpoints are added to the existing ORPC internal API.

```typescript
// Contract definition
const internalChannelRouter = {
  // Channel management
  'internal.channels.create': {
    input: z.object({
      name: z.string(),
      config: InternalChannelConfigSchema.optional(),
    }),
    output: z.object({ channel: ChannelSchema }),
  },

  'internal.channels.update': {
    input: z.object({
      channelId: z.string(),
      name: z.string().optional(),
      config: InternalChannelConfigSchema.partial().optional(),
    }),
    output: z.object({ channel: ChannelSchema }),
  },

  'internal.channels.generateApiKey': {
    input: z.object({
      channelId: z.string(),
      name: z.string(),
      permissions: z.array(ApiKeyPermissionSchema),
      allowedOrigins: z.array(z.string()).optional(),
      expiresInDays: z.number().optional(),
    }),
    output: z.object({
      keyId: z.string(),
      apiKey: z.string(), // Only returned once!
    }),
  },

  'internal.channels.revokeApiKey': {
    input: z.object({
      channelId: z.string(),
      keyId: z.string(),
    }),
    output: z.object({ success: z.boolean() }),
  },

  // Dashboard chat (testing)
  'internal.chat.send': {
    input: z.object({
      channelId: z.string(),
      conversationId: z.string().optional(), // Create new if not provided
      content: z.string(),
      contentType: ContentTypeSchema.default('text'),
      attachments: z.array(AttachmentSchema).optional(),
    }),
    output: z.object({
      message: MessageSchema,
      conversationId: z.string(),
    }),
  },

  // Session management
  'internal.sessions.list': {
    input: z.object({
      channelId: z.string(),
      status: z.enum(['active', 'idle', 'ended']).optional(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }),
    output: z.object({
      sessions: z.array(SessionSchema),
      nextCursor: z.string().optional(),
    }),
  },

  'internal.sessions.end': {
    input: z.object({
      sessionId: z.string(),
      reason: z.string().optional(),
    }),
    output: z.object({ success: z.boolean() }),
  },
};
```

### Public API (API Key Auth) - For Widget & Tenant API

These are separate public endpoints (not on the internal API).

#### Create Session

```
POST /v1/chat/sessions
Authorization: Bearer <api_key>
Content-Type: application/json
Origin: https://tenant-website.com

{
  "participantId": "visitor-123",        // Optional, auto-generated if not provided
  "participantName": "John Doe",         // Optional
  "participantEmail": "john@example.com", // Optional
  "metadata": {                          // Optional custom data
    "page": "/pricing",
    "referrer": "google.com"
  }
}
```

**Response**:

```json
{
  "sessionId": "01HNQJK7...",
  "sessionToken": "eyJ...", // Use for subsequent requests
  "conversationId": "01HNQJK8...",
  "expiresAt": "2026-01-10T12:00:00Z",
  "websocketUrl": "wss://api.example.com/v1/chat/ws?token=..."
}
```

#### Send Message

```
POST /v1/chat/sessions/:sessionId/messages
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "content": "Hello, I have a question",
  "contentType": "text",
  "attachments": []  // Optional
}
```

**Response**:

```json
{
  "messageId": "01HNQJKM...",
  "status": "sent",
  "sentAt": "2026-01-10T10:30:00Z"
}
```

#### Get Messages

```
GET /v1/chat/sessions/:sessionId/messages?limit=50&before=<messageId>
Authorization: Bearer <session_token>
```

**Response**:

```json
{
  "messages": [
    {
      "messageId": "01HNQJKM...",
      "direction": "inbound",
      "senderType": "visitor",
      "content": "Hello, I have a question",
      "contentType": "text",
      "sentAt": "2026-01-10T10:30:00Z",
      "status": "read"
    },
    {
      "messageId": "01HNQJKN...",
      "direction": "outbound",
      "senderType": "ai",
      "content": "Hi! I'd be happy to help. What's your question?",
      "contentType": "text",
      "sentAt": "2026-01-10T10:30:05Z",
      "status": "delivered"
    }
  ],
  "hasMore": false
}
```

#### End Session

```
POST /v1/chat/sessions/:sessionId/end
Authorization: Bearer <session_token>

{
  "reason": "user_ended"  // Optional
}
```

### WebSocket API

#### Connection

```
WSS /v1/chat/ws?token=<session_token>
```

#### Message Types (Client → Server)

```typescript
// Send message
{
  "type": "message",
  "content": "Hello",
  "contentType": "text"
}

// Typing indicator
{
  "type": "typing",
  "isTyping": true
}

// Mark messages as read
{
  "type": "read",
  "messageIds": ["01HNQJKM..."]
}

// Ping (keepalive)
{
  "type": "ping"
}
```

#### Message Types (Server → Client)

```typescript
// New message
{
  "type": "message",
  "message": {
    "messageId": "01HNQJKN...",
    "direction": "outbound",
    "senderType": "ai",
    "content": "Hi! How can I help?",
    "sentAt": "2026-01-10T10:30:05Z"
  }
}

// Typing indicator
{
  "type": "typing",
  "senderType": "agent",
  "isTyping": true
}

// Message status update
{
  "type": "status",
  "messageId": "01HNQJKM...",
  "status": "read"
}

// Session ended
{
  "type": "session_ended",
  "reason": "idle_timeout"
}

// Pong (keepalive response)
{
  "type": "pong"
}

// Error
{
  "type": "error",
  "code": "rate_limited",
  "message": "Too many messages. Please wait."
}
```

---

## Widget Integration (Future Scope)

> **Note**: Widget SDK implementation is out of scope for initial implementation. This section documents the intended design.

### Embed Code

```html
<script>
  (function (w, d, s, o, f, js, fjs) {
    w['ChatWidget'] = o;
    w[o] =
      w[o] ||
      function () {
        (w[o].q = w[o].q || []).push(arguments);
      };
    js = d.createElement(s);
    fjs = d.getElementsByTagName(s)[0];
    js.id = o;
    js.src = f;
    js.async = 1;
    fjs.parentNode.insertBefore(js, fjs);
  })(
    window,
    document,
    'script',
    'chat',
    'https://widget.example.com/v1/widget.js'
  );

  chat('init', {
    apiKey: 'intk_01HN_...',
    // Optional overrides
    position: 'bottom-right',
    primaryColor: '#0066cc',
  });
</script>
```

### Widget SDK API

```typescript
// Initialize widget
chat('init', { apiKey: string, options?: WidgetOptions });

// Open/close widget
chat('open');
chat('close');
chat('toggle');

// Set visitor identity
chat('identify', {
  participantId?: string,
  name?: string,
  email?: string,
  metadata?: Record<string, any>
});

// Send message programmatically
chat('send', { content: string });

// Event listeners
chat('on', 'open', () => {});
chat('on', 'close', () => {});
chat('on', 'message', (message) => {});
chat('on', 'error', (error) => {});
```

---

## DynamoDB Schema Additions

### Session Entity

| Entity  | PK                  | SK                    | GSI1PK                | GSI1SK                     |
| ------- | ------------------- | --------------------- | --------------------- | -------------------------- |
| Session | `TENANT#<tenantId>` | `SESSION#<sessionId>` | `CHANNEL#<channelId>` | `SESSION#<lastActivityAt>` |

### WebSocket Connection Entity

| Entity     | PK                    | SK                    | TTL     |
| ---------- | --------------------- | --------------------- | ------- |
| Connection | `SESSION#<sessionId>` | `CONN#<connectionId>` | 2 hours |

### API Key Entity

| Entity | PK                  | SK               | GSI1PK              | GSI1SK           |
| ------ | ------------------- | ---------------- | ------------------- | ---------------- |
| ApiKey | `TENANT#<tenantId>` | `APIKEY#<keyId>` | `KEYHASH#<keyHash>` | `APIKEY#<keyId>` |

---

## Security Considerations

### API Key Security

1. **Hashed storage** - Only store SHA-256 hash, never plaintext
2. **One-time display** - API key shown only at creation
3. **Origin validation** - Enforce allowedOrigins for widget requests
4. **Rate limiting** - Per-key rate limits
5. **Expiration** - Optional key expiration
6. **Audit logging** - Log all key usage

### Session Security

1. **Token expiration** - Session tokens expire (configurable, default 24h)
2. **IP binding** - Optionally bind session to IP
3. **Fingerprinting** - Browser fingerprint validation
4. **Rate limiting** - Per-session message limits

### Data Protection

1. **Encryption at rest** - All messages encrypted in DynamoDB
2. **Encryption in transit** - TLS for all connections
3. **PII handling** - Email/name stored encrypted
4. **Data retention** - Configurable retention policies

---

## Platform Adapter Implementation

```typescript
// platforms/internal/adapter.ts
import {
  PlatformAdapter,
  NormalizedMessage,
  OutboundMessage,
  SendResult,
} from '../types';
import { Channel, Conversation } from '../../lib/db/entities';

export const internalAdapter: PlatformAdapter = {
  platform: 'internal',

  // No webhook parsing needed - messages come through API
  parseWebhook(payload: unknown): NormalizedMessage[] {
    throw new Error('Internal channel does not use webhooks');
  },

  // No webhook verification needed
  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    throw new Error('Internal channel does not use webhooks');
  },

  // Send message (real-time via WebSocket + store)
  async sendMessage(
    channel: Channel,
    message: OutboundMessage
  ): Promise<SendResult> {
    const messageId = ulid();

    // Store message
    await messageRepo.create({
      conversationId: message.conversationId,
      messageId,
      platformMsgId: messageId, // Same for internal
      direction: 'outbound',
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      contentType: message.contentType,
      attachments: message.attachments,
      sentAt: new Date(),
      status: 'sent',
    });

    // Push to WebSocket connections
    const session = await sessionRepo.getByConversationId(
      message.conversationId
    );
    if (session?.connectionIds?.length) {
      await pushToConnections(session.connectionIds, {
        type: 'message',
        message: { messageId, ...message },
      });
    }

    return {
      success: true,
      platformMsgId: messageId,
    };
  },

  // No messaging window for internal
  canSendRegularMessage(conversation: Conversation): boolean {
    return true; // Always allowed
  },

  getMessagingWindowHours(): number {
    return Infinity; // No window
  },

  getFreeWindowHours(): number {
    return Infinity; // No window
  },

  // Capabilities
  supportsTemplates(): boolean {
    return false; // Templates not required
  },

  supportsMessageTags(): boolean {
    return false;
  },

  supportsHtmlContent(): boolean {
    return false; // Plain text for chat
  },

  getWebhookResponseTimeoutMs(): number {
    return 0; // No webhooks
  },
};
```

---

## Service Structure Additions

```
services/conversations/
├── functions/
│   ├── src/
│   │   ├── internal-api/
│   │   │   ├── internal-channels.ts   # Internal channel CRUD
│   │   │   └── internal-chat.ts       # Dashboard chat procedures
│   │   │
│   │   ├── public-api/
│   │   │   ├── handler.ts             # Express + API key auth
│   │   │   ├── sessions.ts            # Session management
│   │   │   ├── messages.ts            # Message send/receive
│   │   │   └── middleware/
│   │   │       ├── api-key-auth.ts    # API key validation
│   │   │       ├── session-auth.ts    # Session token validation
│   │   │       └── rate-limit.ts      # Rate limiting
│   │   │
│   │   ├── websocket/
│   │   │   ├── connect.ts             # $connect handler
│   │   │   ├── disconnect.ts          # $disconnect handler
│   │   │   ├── message.ts             # $default handler
│   │   │   └── authorizer.ts          # WebSocket authorizer
│   │   │
│   │   ├── platforms/
│   │   │   └── internal/
│   │   │       └── adapter.ts         # Internal platform adapter
│   │   │
│   │   └── lib/
│   │       ├── db/
│   │       │   ├── sessions.ts        # Session repository
│   │       │   ├── connections.ts     # WebSocket connection repo
│   │       │   └── api-keys.ts        # API key repository
│   │       └── websocket/
│   │           └── push.ts            # Push to connections
│   │
│   └── test/
│       └── ...
│
└── infra/
    └── Main.ts                        # Add WebSocket API, public API
```

---

## Infrastructure Additions

### WebSocket API Gateway

```typescript
// In infra/Main.ts
const websocketApi = new apigw.WebSocketApi(stack, 'ChatWebSocketApi', {
  apiName: `${app.name}-${app.stage}-chat-ws`,
});

new apigw.WebSocketStage(stack, 'ChatWebSocketStage', {
  webSocketApi: websocketApi,
  stageName: app.stage,
  autoDeploy: true,
});

// Lambda handlers for WebSocket
const connectHandler = new sst.Function(stack, 'WsConnect', {
  handler: 'functions/src/websocket/connect.handler',
});

const disconnectHandler = new sst.Function(stack, 'WsDisconnect', {
  handler: 'functions/src/websocket/disconnect.handler',
});

const messageHandler = new sst.Function(stack, 'WsMessage', {
  handler: 'functions/src/websocket/message.handler',
});

// Routes
websocketApi.addRoute('$connect', {
  integration: new apigw.WebSocketLambdaIntegration(
    'ConnectIntegration',
    connectHandler
  ),
});

websocketApi.addRoute('$disconnect', {
  integration: new apigw.WebSocketLambdaIntegration(
    'DisconnectIntegration',
    disconnectHandler
  ),
});

websocketApi.addRoute('$default', {
  integration: new apigw.WebSocketLambdaIntegration(
    'MessageIntegration',
    messageHandler
  ),
});
```

### Public REST API (Separate from Internal)

```typescript
// Public API for widget and tenant API access
const publicApi = new sst.Api(stack, 'ChatPublicApi', {
  routes: {
    'POST /v1/chat/sessions': 'functions/src/public-api/sessions.create',
    'POST /v1/chat/sessions/{sessionId}/messages':
      'functions/src/public-api/messages.send',
    'GET /v1/chat/sessions/{sessionId}/messages':
      'functions/src/public-api/messages.list',
    'POST /v1/chat/sessions/{sessionId}/end':
      'functions/src/public-api/sessions.end',
  },
  cors: {
    allowOrigins: ['*'], // Validated per-request via API key allowedOrigins
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  },
});
```

---

## Implementation Phases

### Phase 1: Core Internal Channel (Current Scope)

- [x] Internal channel adapter
- [ ] Channel entity with `platform: 'internal'`
- [ ] Session entity and repository
- [ ] API key entity and repository
- [ ] Internal API procedures for channel management
- [ ] Internal API procedures for dashboard chat
- [ ] Basic message send/receive flow

### Phase 2: Public API & WebSocket

- [ ] Public REST API endpoints
- [ ] API key authentication middleware
- [ ] Session token generation and validation
- [ ] WebSocket API Gateway setup
- [ ] WebSocket connect/disconnect handlers
- [ ] Real-time message push

### Phase 3: Widget SDK (Out of Scope)

- [ ] Widget JavaScript SDK
- [ ] Widget UI components
- [ ] Embed code generator
- [ ] Widget customization options

### Phase 4: AI Agent Integration

- [ ] AI agent trigger on inbound messages
- [ ] Agent response handling
- [ ] Handoff to human agents
- [ ] Conversation context management

---

## Related Documentation

- [Conversations Service Architecture](./conversations-service-architecture.md) - Main architecture document
- [Meta Platform Integration Guide](./meta-platform-integration.md) - External platform reference
- [Internal API](../docs/internal-api.md) - ORPC contract patterns
- [IAC Patterns](../docs/iac-patterns.md) - Infrastructure code patterns
