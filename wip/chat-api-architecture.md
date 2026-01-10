# Chat API Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-11

## Context & Problem Statement

### Business Need

Tenants need to integrate AI-powered chat into their own applications and websites. They need:

- A simple API to send messages and receive responses
- Real-time streaming responses via Server-Sent Events (SSE)
- Low latency for responsive user experience
- Compatibility with popular AI SDK libraries (Vercel AI SDK)

### Solution

Build a **Chat API Service** that:

1. **Exposes a public API** for tenants to integrate chat into their apps
2. **Streams responses** via SSE for real-time AI interactions
3. **Optimizes for low latency** using Lambda response streaming
4. **Supports multi-region** deployment for global availability
5. **Leverages ElastiCache Redis** for message persistence and real-time distribution

### Design Goals

| Goal              | Approach                                                    |
| ----------------- | ----------------------------------------------------------- |
| Low Latency       | Lambda response streaming + Redis Streams                   |
| Serverless        | API Gateway REST + Lambda (no servers to manage)            |
| Multi-Region      | Route 53 latency-based routing (similar to SsrSite pattern) |
| SDK Compatibility | Vercel AI SDK UI Message Stream protocol                    |
| Scalability       | Serverless auto-scaling + ElastiCache                       |

---

## High-Level Architecture

```
+------------------------------------------------------------------------------+
|                          Client Applications                                  |
|                    (Vercel AI SDK / Custom Clients)                          |
|                                                                              |
|  +---------------------------+     +---------------------------+             |
|  | Tenant Web App            |     | Tenant Mobile App         |             |
|  | (React + Vercel AI SDK)   |     | (Custom HTTP Client)      |             |
|  +-------------+-------------+     +-------------+-------------+             |
+----------------|-----------------------------|---------------------------------+
                 |                             |
                 v                             v
+------------------------------------------------------------------------------+
|                      CloudFront Distribution                                  |
|                   (Home Region Only - e.g., us-west-2)                       |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |  Behaviors:                                                            |  |
|  |  - POST /v1/chat/* -> chat-routing.{domain} (streaming origin)        |  |
|  |  - GET  /v1/chat/stream/* -> chat-routing.{domain}                    |  |
|  |  - *    /v1/* -> chat-routing.{domain} (CRUD operations)              |  |
|  +------------------------------------------------------------------------+  |
+--------------------------------------+---------------------------------------+
                                       |
                                       v
+------------------------------------------------------------------------------+
|                Route 53 Latency-Based Routing                                |
|                (chat-routing.{domain})                                       |
|                                                                              |
|  +---------------------------+     +---------------------------+             |
|  |   A Record                |     |   A Record                |             |
|  |   region: us-west-2       |     |   region: us-west-1       |             |
|  |   setId: ...west-2-A      |     |   setId: ...west-1-A      |             |
|  +-------------+-------------+     +-------------+-------------+             |
+----------------|-----------------------------|---------------------------------+
                 |                             |
                 v                             v
+-------------------------------+   +-------------------------------+
|  API Gateway REST (us-west-2) |   |  API Gateway REST (us-west-1) |
|  EndpointType: REGIONAL       |   |  EndpointType: REGIONAL       |
|  Custom Domain: chat-routing  |   |  Custom Domain: chat-routing  |
|                               |   |                               |
|  +-------------------------+  |   |  +-------------------------+  |
|  | ANY /{proxy+}           |  |   |  | ANY /{proxy+}           |  |
|  | ResponseTransferMode:   |  |   |  | ResponseTransferMode:   |  |
|  | STREAM                  |  |   |  | STREAM                  |  |
|  +------------+------------+  |   |  +------------+------------+  |
+---------------|---------------+   +---------------|---------------+
                |                                   |
                v                                   v
+-------------------------------+   +-------------------------------+
|  Lambda (us-west-2)           |   |  Lambda (us-west-1)           |
|  - VPC Connected              |   |  - VPC Connected              |
|  - Response Streaming         |   |  - Response Streaming         |
|  - 5 min timeout (SSE)        |   |  - 5 min timeout (SSE)        |
+---------------|---------------+   +---------------|---------------+
                |                                   |
                +----------------+------------------+
                                 |
                                 v
+------------------------------------------------------------------------------+
|                     ElastiCache Redis                                        |
|              (Global Datastore or Regional Replication)                      |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  | Streams: chat:conv:{id} - Message persistence & ordering               |  |
|  | Pub/Sub: channel:conv:{id} - Real-time notifications (optional)        |  |
|  | Hash: message:{id} - Message metadata                                  |  |
|  | Sorted Set: user:{id}:conversations - User's conversations             |  |
|  +------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------+
                                 |
                                 v
+------------------------------------------------------------------------------+
|                        DynamoDB (Persistence)                                |
|                                                                              |
|  - Long-term message storage (conversations, messages)                       |
|  - Conversation metadata                                                     |
|  - API key management                                                        |
+------------------------------------------------------------------------------+
```

---

## Architecture Decisions

### Resolved Questions

| Decision          | Choice                                       | Rationale                                                               |
| ----------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Streaming Method  | API Gateway REST + Lambda Response Streaming | Follows SsrSite pattern; built-in auth/throttling; multi-region support |
| Multi-Region      | Route 53 latency-based routing               | Same pattern as SsrSite `gatewayDomain`; automatic failover             |
| CloudFront        | Single distribution in home region           | Cost optimization; origin points to routing domain                      |
| Message Storage   | Redis Streams + DynamoDB                     | Redis for real-time (low latency); DynamoDB for persistence             |
| SDK Compatibility | Vercel AI SDK UI Message Stream              | Popular SDK; SSE-based; good DX for customers                           |

### Why API Gateway REST (Not Function URLs)?

| Factor               | API Gateway REST                           | Lambda Function URLs                      |
| -------------------- | ------------------------------------------ | ----------------------------------------- |
| Multi-Region Routing | Works with custom domains + Route 53       | Requires CloudFront HTTP_PROXY workaround |
| Authentication       | Built-in API keys, IAM, Lambda authorizers | Resource-based policies only              |
| Rate Limiting        | Built-in throttling                        | None (must use reserved concurrency)      |
| WAF Integration      | Yes                                        | Via CloudFront only                       |
| Response Streaming   | Yes (`ResponseTransferMode.STREAM`)        | Yes (`RESPONSE_STREAM`)                   |
| VPC Support          | Yes                                        | No streaming in VPC                       |
| **Consistency**      | **Matches SsrSite pattern**                | Different pattern                         |

---

## API Specification

### Vercel AI SDK Compatibility

The API follows the Vercel AI SDK UI Message Stream protocol for seamless integration.

#### Request Format

**Endpoint**: `POST /v1/chat`

**Headers**:

```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Body**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Hello, how can you help me?" }]
    }
  ],
  "conversationId": "conv_abc123",
  "agentId": "agent_xyz789"
}
```

#### Response Format (SSE Stream)

**Headers**:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
x-vercel-ai-ui-message-stream: v1
```

**Stream Events**:

```
data: {"type":"start","messageId":"msg_123"}

data: {"type":"text-start","id":"t1"}

data: {"type":"text-delta","id":"t1","delta":"Hello"}

data: {"type":"text-delta","id":"t1","delta":"! I'm"}

data: {"type":"text-delta","id":"t1","delta":" here to help."}

data: {"type":"text-end","id":"t1"}

data: {"type":"finish"}

data: [DONE]

```

#### Event Types

| Event Type              | Description                            | Payload                         |
| ----------------------- | -------------------------------------- | ------------------------------- |
| `start`                 | Message stream started                 | `{ messageId: string }`         |
| `text-start`            | Text content block started             | `{ id: string }`                |
| `text-delta`            | Text content chunk                     | `{ id: string, delta: string }` |
| `text-end`              | Text content block ended               | `{ id: string }`                |
| `reasoning-start`       | Reasoning block started (if supported) | `{ id: string }`                |
| `reasoning-delta`       | Reasoning content chunk                | `{ id: string, delta: string }` |
| `reasoning-end`         | Reasoning block ended                  | `{ id: string }`                |
| `tool-input-start`      | Tool call started                      | `{ id: string, name: string }`  |
| `tool-input-delta`      | Tool call arguments chunk              | `{ id: string, delta: string }` |
| `tool-input-available`  | Tool call ready to execute             | `{ id: string, input: object }` |
| `tool-output-available` | Tool result available                  | `{ id: string, output: any }`   |
| `error`                 | Error occurred                         | `{ message: string }`           |
| `finish`                | Message generation complete            | `{}`                            |
| `[DONE]`                | Stream terminated                      | (raw text, not JSON)            |

---

## Data Model

### Redis Data Structures

```redis
# Message stream per conversation (ordered, persistent)
# Key: chat:conv:{conversationId}
# Entry: { msgId, role, content (JSON), timestamp, status }
XADD chat:conv:{convId} * msgId {id} role {role} content {json} ts {timestamp}

# Read new messages (blocking for real-time)
XREAD BLOCK 30000 STREAMS chat:conv:{convId} {lastId}

# Read last N messages (for conversation history)
XREVRANGE chat:conv:{convId} + - COUNT 50

# Pub/Sub for instant notifications (optional optimization)
PUBLISH channel:conv:{convId} {messageJson}

# User's active conversations (sorted by last activity)
ZADD user:{participantId}:conversations {timestamp} {convId}

# Conversation metadata (cached)
HSET conv:{convId} title {title} createdAt {ts} agentId {agentId}
EXPIRE conv:{convId} 86400  # 24 hour TTL
```

### DynamoDB Table Design

Extends existing conversations service table:

| Entity           | PK                  | SK                   | GSI1PK                        | GSI1SK                     |
| ---------------- | ------------------- | -------------------- | ----------------------------- | -------------------------- |
| ChatConversation | `TENANT#{tenantId}` | `CHATCONV#{convId}`  | `PARTICIPANT#{participantId}` | `CHATCONV#{lastMessageAt}` |
| ChatMessage      | `CHATCONV#{convId}` | `MSG#{messageId}`    | -                             | -                          |
| ChatApiKey       | `TENANT#{tenantId}` | `CHATAPIKEY#{keyId}` | `KEYHASH#{keyHash}`           | `CHATAPIKEY#{keyId}`       |

**Access Patterns**:

1. Get conversations by tenant: `PK = TENANT#{tenantId}, SK begins_with CHATCONV#`
2. Get conversations by participant: `GSI1PK = PARTICIPANT#{participantId}` (sorted by lastMessageAt)
3. Get messages by conversation: `PK = CHATCONV#{convId}, SK begins_with MSG#`
4. Authenticate API key: `GSI1PK = KEYHASH#{keyHash}`

---

## Message Flows

### Send Message (POST /v1/chat)

```
1. Client sends POST /v1/chat with messages array
                    |
                    v
2. CloudFront routes to chat-routing.{domain}
                    |
                    v
3. Route 53 resolves to nearest healthy region (latency-based)
                    |
                    v
4. API Gateway receives request
   - Validates API key (Lambda authorizer or API key)
   - Routes to Lambda with ResponseTransferMode.STREAM
                    |
                    v
5. Lambda starts streaming response:
   a. Set SSE headers (Content-Type, x-vercel-ai-ui-message-stream)
   b. Parse and validate request body
   c. Load conversation from Redis (or create new)
   d. Store user message in Redis Stream
                    |
                    v
6. Generate AI response:
   a. Stream: {"type":"start","messageId":"..."}
   b. Call AI service (internal or external)
   c. For each response chunk:
      - Stream: {"type":"text-delta","id":"...","delta":"..."}
   d. Store assistant message in Redis Stream
   e. Stream: {"type":"text-end","id":"..."}
   f. Stream: {"type":"finish"}
   g. Stream: [DONE]
                    |
                    v
7. Lambda ends response stream
                    |
                    v
8. Async: Persist to DynamoDB (eventual consistency OK)
```

### Receive Messages (SSE Subscription - Optional)

For clients that want to subscribe to new messages (e.g., multi-device sync):

```
1. Client connects GET /v1/chat/stream?conversationId={id}
                    |
                    v
2. Lambda starts SSE stream:
   a. Set SSE headers
   b. Poll Redis Stream with XREAD BLOCK
                    |
                    v
3. When new message arrives in Redis:
   a. Stream: {"type":"message","data":{...}}
                    |
                    v
4. Continue polling until timeout or disconnect
                    |
                    v
5. Stream: [DONE] and close connection
```

---

## Infrastructure (SST v2)

### Stack Definition

```typescript
// services/chat-api/infra/Main.ts
import { StackContext, use } from 'sst/constructs';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { SharedInfra } from '@infra/shared-infra';
import { regions } from '@lib/sst-helpers';

export function ChatApiStack({ stack, app }: StackContext) {
  const { vpc, elasticacheEndpoint, hostedZone } = use(SharedInfra);
  const isHomeRegion = stack.region === regions.getHomeRegion();
  const context = app.local ? 'local' : stack.stage;

  // --- Lambda Function with Streaming Support ---
  const chatHandler = new sst.Function(stack, 'ChatStreamHandler', {
    handler: 'functions/src/chat/handler.main',
    runtime: 'nodejs20.x',
    timeout: '5 minutes', // Long timeout for SSE
    memorySize: 1024,
    vpc,
    environment: {
      REDIS_ENDPOINT: elasticacheEndpoint,
      REDIS_PORT: '6379',
    },
  });

  // --- API Gateway REST API (Regional) ---
  const api = new apigateway.RestApi(stack, 'ChatApi', {
    restApiName: `chat-api-${stack.stage}`,
    endpointConfiguration: {
      types: [apigateway.EndpointType.REGIONAL],
    },
    deployOptions: {
      stageName: 'v1',
      throttlingRateLimit: 1000,
      throttlingBurstLimit: 2000,
    },
  });

  // Add proxy resource with Lambda streaming
  const v1 = api.root.addResource('v1');
  const chat = v1.addResource('chat');
  const chatProxy = chat.addProxy({
    anyMethod: false,
  });

  // POST /v1/chat (send message with streaming response)
  chat.addMethod(
    'POST',
    new apigateway.LambdaIntegration(chatHandler.function, {
      proxy: true,
      responseTransferMode: apigateway.ResponseTransferMode.STREAM,
    })
  );

  // GET /v1/chat/stream (SSE subscription)
  const stream = chat.addResource('stream');
  stream.addMethod(
    'GET',
    new apigateway.LambdaIntegration(chatHandler.function, {
      proxy: true,
      responseTransferMode: apigateway.ResponseTransferMode.STREAM,
    })
  );

  // ANY /v1/chat/{proxy+} (other operations)
  chatProxy.addMethod(
    'ANY',
    new apigateway.LambdaIntegration(chatHandler.function, {
      proxy: true,
      responseTransferMode: apigateway.ResponseTransferMode.STREAM,
    })
  );

  // --- Custom Domain with Latency-Based Routing ---
  const routingDomain = `chat-routing.${dns.rootDomain(context)}`;
  const certificate = getCertificate(stack, 'regional');

  const domainName = new apigateway.DomainName(stack, 'ChatDomain', {
    domainName: routingDomain,
    certificate,
    endpointType: apigateway.EndpointType.REGIONAL,
    securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
  });

  new apigateway.BasePathMapping(stack, 'BasePathMapping', {
    domainName,
    restApi: api,
    stage: api.deploymentStage,
  });

  // Latency-based A record (created in ALL regions)
  new route53.ARecord(stack, 'LatencyARecord', {
    zone: hostedZone,
    recordName: routingDomain,
    target: route53.RecordTarget.fromAlias(
      new targets.ApiGatewayDomain(domainName)
    ),
    region: stack.region,
    setIdentifier: `${routingDomain}-${stack.region}-A`,
  });

  // AAAA record for IPv6
  new route53.AaaaRecord(stack, 'LatencyAaaaRecord', {
    zone: hostedZone,
    recordName: routingDomain,
    target: route53.RecordTarget.fromAlias(
      new targets.ApiGatewayDomain(domainName)
    ),
    region: stack.region,
    setIdentifier: `${routingDomain}-${stack.region}-AAAA`,
  });

  // --- CloudFront Distribution (Home Region Only) ---
  if (isHomeRegion) {
    const publicDomain = `chat-api.${dns.rootDomain(context)}`;
    const cloudfrontCert = getCertificate(stack, 'cloudfront'); // us-east-1

    const distribution = new cloudfront.Distribution(stack, 'ChatCdn', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(routingDomain, {
          readTimeout: cdk.Duration.seconds(300), // 5 min for SSE
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: new cloudfront.CachePolicy(stack, 'NoCachePolicy', {
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
            'Authorization',
            'Content-Type',
            'Accept'
          ),
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          defaultTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.seconds(0),
        }),
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      domainNames: [publicDomain],
      certificate: cloudfrontCert,
    });

    // Public domain A record
    new route53.ARecord(stack, 'PublicARecord', {
      zone: hostedZone,
      recordName: publicDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    stack.addOutputs({
      ApiUrl: `https://${publicDomain}/v1/chat`,
      DistributionId: distribution.distributionId,
    });
  }

  return { api, chatHandler };
}
```

### Lambda Handler (Streaming)

```typescript
// services/chat-api/functions/src/chat/handler.ts
import { pipeline } from 'stream/promises';
import Redis from 'ioredis';

// Connection reuse across invocations
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_ENDPOINT!,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      tls: {},
      lazyConnect: true,
    });
  }
  return redis;
}

// Lambda response streaming handler
export const main = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method;

    // Set SSE headers for Vercel AI SDK compatibility
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'x-vercel-ai-ui-message-stream': 'v1',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    try {
      if (method === 'POST' && path.endsWith('/chat')) {
        await handleChatMessage(event, responseStream);
      } else if (method === 'GET' && path.includes('/stream')) {
        await handleSSEStream(event, responseStream);
      } else {
        responseStream.write(
          `data: {"type":"error","message":"Not found"}\n\n`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      responseStream.write(
        `data: {"type":"error","message":"${escapeJson(message)}"}\n\n`
      );
    } finally {
      responseStream.write('data: [DONE]\n\n');
      responseStream.end();
    }
  }
);

async function handleChatMessage(event: any, responseStream: any) {
  const body = JSON.parse(event.body || '{}');
  const { messages, conversationId, agentId } = body;
  const redis = getRedis();

  const messageId = `msg_${Date.now()}_${randomId()}`;
  const textId = `text_${randomId()}`;
  const convId = conversationId || `conv_${randomId()}`;

  // Start message stream
  writeSSE(responseStream, { type: 'start', messageId });
  writeSSE(responseStream, { type: 'text-start', id: textId });

  // Store user message in Redis Stream
  const userMessage = messages[messages.length - 1];
  await redis.xadd(
    `chat:conv:${convId}`,
    '*',
    'msgId',
    `msg_${randomId()}`,
    'role',
    'user',
    'content',
    JSON.stringify(userMessage.parts),
    'timestamp',
    Date.now().toString()
  );

  // Generate AI response (placeholder - integrate with AI service)
  const responseChunks = await generateAIResponse(messages, agentId);
  let fullResponse = '';

  for await (const chunk of responseChunks) {
    fullResponse += chunk;
    writeSSE(responseStream, { type: 'text-delta', id: textId, delta: chunk });
  }

  // Store assistant message in Redis Stream
  await redis.xadd(
    `chat:conv:${convId}`,
    '*',
    'msgId',
    messageId,
    'role',
    'assistant',
    'content',
    JSON.stringify([{ type: 'text', text: fullResponse }]),
    'timestamp',
    Date.now().toString()
  );

  // End stream
  writeSSE(responseStream, { type: 'text-end', id: textId });
  writeSSE(responseStream, { type: 'finish' });
}

async function handleSSEStream(event: any, responseStream: any) {
  const params = event.queryStringParameters || {};
  const { conversationId, lastId = '$' } = params;
  const redis = getRedis();

  if (!conversationId) {
    writeSSE(responseStream, {
      type: 'error',
      message: 'conversationId required',
    });
    return;
  }

  // Poll for new messages with timeout
  const timeout = 30000; // 30 seconds
  const startTime = Date.now();
  let currentLastId = lastId;

  while (Date.now() - startTime < timeout) {
    const results = await redis.xread(
      'BLOCK',
      5000,
      'STREAMS',
      `chat:conv:${conversationId}`,
      currentLastId
    );

    if (results) {
      for (const [, messages] of results as any) {
        for (const [id, fields] of messages) {
          const message = parseRedisFields(fields);
          writeSSE(responseStream, { type: 'message', id, data: message });
          currentLastId = id;
        }
      }
    }
  }
}

// Helpers
function writeSSE(stream: any, data: object) {
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}

function escapeJson(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseRedisFields(fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    result[key] = key === 'content' ? JSON.parse(value) : value;
  }
  return result;
}

async function* generateAIResponse(messages: any[], agentId?: string) {
  // TODO: Integrate with AI Agents service
  // This is a placeholder that simulates streaming
  const response = "Hello! I'm here to help. How can I assist you today?";
  const words = response.split(' ');

  for (const word of words) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield word + ' ';
  }
}
```

---

## Frontend Integration

### Vercel AI SDK (React)

```typescript
// Example: Tenant's React application using Vercel AI SDK
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

interface ChatWidgetProps {
  apiKey: string;
  conversationId?: string;
  agentId?: string;
}

export function ChatWidget({ apiKey, conversationId, agentId }: ChatWidgetProps) {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status, error, stop, reload } = useChat({
    transport: new DefaultChatTransport({
      api: 'https://chat-api.example.com/v1/chat',
      headers: () => ({
        Authorization: `Bearer ${apiKey}`,
      }),
      body: () => ({
        conversationId,
        agentId,
      }),
    }),
    onFinish: ({ message }) => {
      console.log('Message completed:', message.id);
    },
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <div className="chat-widget">
      {/* Messages */}
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
            {message.parts.map((part, i) =>
              part.type === 'text' ? <span key={i}>{part.text}</span> : null
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {status === 'streaming' && (
          <div className="message assistant streaming">
            <span className="typing-indicator">...</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="error">
          <p>Something went wrong</p>
          <button onClick={reload}>Retry</button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={status !== 'ready'}
        />
        {status === 'streaming' ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" disabled={status !== 'ready'}>Send</button>
        )}
      </form>
    </div>
  );
}
```

### Custom HTTP Client (Non-SDK)

```typescript
// Example: Custom client without Vercel AI SDK
async function sendChatMessage(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch('https://chat-api.example.com/v1/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const event = JSON.parse(data);
          if (event.type === 'text-delta') {
            onChunk(event.delta);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

// Usage
await sendChatMessage(
  'sk_live_xxx',
  [{ role: 'user', content: 'Hello!' }],
  (text) => console.log('Received:', text)
);
```

---

## Service Structure

```
services/chat-api/
+-- functions/
|   +-- src/
|   |   +-- chat/
|   |   |   +-- handler.ts           # Main streaming handler
|   |   |   +-- routes.ts            # Route matching logic
|   |   |   +-- send-message.ts      # POST /v1/chat logic
|   |   |   +-- stream.ts            # GET /v1/chat/stream logic
|   |   |   +-- history.ts           # GET /v1/chat/conversations logic
|   |   |   +-- types.ts             # Request/response types
|   |   |   +-- sse.ts               # SSE formatting helpers
|   |   |   +-- vercel-protocol.ts   # Vercel AI SDK protocol helpers
|   |   |
|   |   +-- auth/
|   |   |   +-- api-key.ts           # API key validation
|   |   |   +-- authorizer.ts        # Lambda authorizer
|   |   |
|   |   +-- lib/
|   |   |   +-- redis/
|   |   |   |   +-- client.ts        # Redis connection management
|   |   |   |   +-- streams.ts       # Redis Streams helpers
|   |   |   |   +-- pubsub.ts        # Pub/Sub helpers (optional)
|   |   |   |
|   |   |   +-- db/
|   |   |   |   +-- entities.ts      # ElectroDB entity definitions
|   |   |   |   +-- conversations.ts # Conversation repository
|   |   |   |   +-- messages.ts      # Message repository
|   |   |   |   +-- api-keys.ts      # API key repository
|   |   |   |
|   |   |   +-- ai/
|   |   |       +-- client.ts        # AI service client (ORPC)
|   |   |       +-- streaming.ts     # AI response streaming
|   |   |
|   |   +-- test/
|   |       +-- ...                  # Unit tests
|   |
|   +-- package.json
|   +-- tsconfig.json
|
+-- infra/
|   +-- Main.ts                      # Stack definition
|
+-- sst.config.ts
+-- package.json
+-- tsconfig.json
```

---

## Deployment Topology

| Region           | CloudFront | API Gateway | Lambda | Route 53 Record           |
| ---------------- | ---------- | ----------- | ------ | ------------------------- |
| us-west-2 (home) | Yes        | Yes         | Yes    | chat-routing -> us-west-2 |
| us-west-1        | No         | Yes         | Yes    | chat-routing -> us-west-1 |

**Request Flow**:

1. Client in California -> `chat-api.example.com`
2. CloudFront (edge) -> Origin: `chat-routing.example.com`
3. Route 53 resolves -> **us-west-2** (lowest latency)
4. API Gateway (us-west-2) -> Lambda with streaming
5. Response streams back to CloudFront -> Client

**Failover**:

1. If us-west-2 becomes unhealthy
2. Route 53 detects failure (health checks)
3. Subsequent requests -> **us-west-1**
4. Automatic failover, no code changes

---

## Cost Estimates

| Component        | Pricing Model             | Estimate (100k requests/day) |
| ---------------- | ------------------------- | ---------------------------- |
| Lambda           | Per request + GB-seconds  | ~$30-50/mo                   |
| API Gateway REST | Per request               | ~$35/mo                      |
| ElastiCache      | Per node-hour or ECPUs    | ~$50-100/mo                  |
| DynamoDB         | Per request + storage     | ~$10-20/mo                   |
| CloudFront       | Per request + transfer    | ~$20-40/mo                   |
| Route 53         | Per hosted zone + queries | ~$5/mo                       |

**Total: ~$150-250/month** for moderate usage (100k requests/day)

---

## Open Questions

### Resolved

- [x] **Streaming method**: API Gateway REST + Lambda Response Streaming (matches SsrSite)
- [x] **Multi-region**: Route 53 latency-based routing with `gatewayDomain` pattern
- [x] **SDK compatibility**: Vercel AI SDK UI Message Stream protocol

### Pending

- [ ] **Authentication**: API keys only, or support JWT/OAuth for end-users?
- [ ] **Rate limiting**: Per-key limits? Per-tenant limits? Conversation limits?
- [ ] **Message retention**: TTL for Redis? Archive to S3?
- [ ] **AI integration**: How to connect to AI Agents service? ORPC or direct?
- [ ] **Conversation ownership**: How to associate conversations with end-users vs API keys?
- [ ] **Multi-tenant Redis**: Shared cluster with key prefixes, or separate clusters?

---

## Related Documents

- [Conversations Service Architecture](./conversations-service-architecture.md) - Internal channel integration
- [AI Agents Service Architecture](./ai-agents-service-architecture.md) - AI response generation
- [Internal Channel Integration](./internal-channel-integration.md) - First-party chat channel
