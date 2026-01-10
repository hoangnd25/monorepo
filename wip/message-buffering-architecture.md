# Message Buffering Architecture

> **Status**: Draft - Architecture Proposal
> **Last Updated**: 2026-01-10
> **Version**: 2.0 - Fault-tolerant self-sustaining processor design

## Context & Problem Statement

### Business Need

When AI agents subscribe to chat messages from external platforms (WhatsApp, Messenger, etc.), users often send messages in small fragments. This is a natural messaging behavior - people hit send after typing a partial thought, then continue typing the rest.

**Example of fragmented messaging:**

```
User: Hey
User: I have a question about my order
User: Order #12345
User: It hasn't arrived yet
User: Can you help?
```

Without buffering, an AI agent would:

1. Receive "Hey" and respond with "Hi! How can I help you?"
2. Receive "I have a question about my order" and respond with "Sure, what's your order number?"
3. Receive "Order #12345" and look it up
4. ...and so on

This creates a poor user experience:

- **Premature responses**: Agent responds before understanding the full context
- **Wasted AI tokens**: Multiple incomplete requests to the LLM
- **Confusing conversations**: Overlapping responses and questions
- **Higher costs**: More API calls to both the AI model and messaging platforms

### Solution

Implement a **dynamic message buffering system** that:

1. **Buffers incoming messages** per conversation
2. **Detects "silence"** - waits until the user stops typing (configurable threshold)
3. **Infers typing patterns** - if messages arrive rapidly, extends the wait time
4. **Applies dynamic rules** - different conversations can have different buffering behavior
5. **Processes in batches** - sends all buffered messages to the AI agent as a single context

### Relationship to AI Agents Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATIONS SERVICE                                │
│                                                                             │
│  - Receives webhooks from WhatsApp, Messenger, etc.                        │
│  - Normalizes message format                                                │
│  - Forwards to Message Buffer                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE BUFFER SERVICE                              │
│                                                                             │
│  - Buffers messages per conversation                                        │
│  - Applies dynamic debounce rules                                           │
│  - Detects when user has stopped typing                                     │
│  - Emits buffered message batch when ready                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ EventBridge: messages.batch.ready
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS SERVICE                                 │
│                                                                             │
│  - Receives complete message context                                        │
│  - Processes with full understanding of user intent                         │
│  - Generates single, contextually appropriate response                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Serverless is Challenging for This Use Case

Traditional AWS serverless patterns have limitations for sub-second debouncing:

| Service                 | Minimum Granularity | Can Reschedule?    | Notes                            |
| ----------------------- | ------------------- | ------------------ | -------------------------------- |
| EventBridge Scheduler   | 60 seconds          | Yes                | Too slow for 1-2 second debounce |
| Step Functions Express  | 1 second            | No                 | Cannot cancel running workflow   |
| Step Functions Standard | 1 second            | Yes (via callback) | Expensive for high volume        |
| SQS Delay               | 0-900 seconds       | No                 | Cannot reschedule on new message |
| DynamoDB TTL            | ~48 hours lag       | N/A                | Too slow for debounce trigger    |
| Lambda sleep            | Any                 | N/A                | Wastes compute, expensive        |

**The core problem**: True debouncing requires the ability to **reset a timer** when a new event arrives. Most AWS services either can't reset timers or have minimum granularities of 60 seconds.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL EVENTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ WhatsApp          │  │ Messenger         │  │ Other Platforms       │   │
│  │ Webhook           │  │ Webhook           │  │ Webhooks              │   │
│  └─────────┬─────────┘  └─────────┬─────────┘  └───────────┬───────────┘   │
│            │                      │                        │               │
└────────────┼──────────────────────┼────────────────────────┼───────────────┘
             │                      │                        │
             └──────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE BUFFER SERVICE                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Ingest Lambda                                 │  │
│  │                                                                       │  │
│  │  1. Receive webhook from platform                                     │  │
│  │  2. Normalize message format                                          │  │
│  │  3. Buffer message in Redis (atomic Lua script)                       │  │
│  │  4. Start Processor Lambda if not already running                     │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ElastiCache Serverless (Redis/Valkey)              │  │
│  │                                                                       │  │
│  │  Processor Coordination:                                              │  │
│  │  processor:lease         → Lease ID + expiry (ownership lock)         │  │
│  │  processor:heartbeat     → Timestamp (updated every loop)             │  │
│  │                                                                       │  │
│  │  Message Buffering:                                                   │  │
│  │  messages:{convId}       → List of buffered messages                  │  │
│  │  debounce:pending        → Sorted set of (processAt, convId)          │  │
│  │  lastmsg:{convId}        → Timestamp of last message                  │  │
│  │  firstmsg:{convId}       → Timestamp of first message in buffer       │  │
│  │  global:lastMessageTime  → Last message received (any conversation)   │  │
│  │                                                                       │  │
│  │  Conversation Locks:                                                  │  │
│  │  processing:{convId}     → Lock for in-flight AI processing           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                 Processor Lambda (Self-Sustaining Loop)               │  │
│  │                                                                       │  │
│  │  1. Acquire lease (atomic, prevents duplicate processors)             │  │
│  │  2. Loop until timeout OR idle threshold:                             │  │
│  │     a. Update heartbeat                                               │  │
│  │     b. ZRANGEBYSCORE debounce:pending 0 {now}                        │  │
│  │     c. For each ready conv: invoke ConversationProcessor (async)      │  │
│  │     d. Check idle threshold (10s no activity → exit)                  │  │
│  │     e. Sleep 500ms                                                    │  │
│  │  3. Graceful shutdown: release lease                                  │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │              ConversationProcessor Lambda (Fan-out)                   │  │
│  │              One instance per conversation (parallel)                 │  │
│  │                                                                       │  │
│  │  1. Acquire conversation lock                                         │  │
│  │  2. Fetch buffered messages                                           │  │
│  │  3. Process with AI                                                   │  │
│  │  4. Send response                                                     │  │
│  │  5. Cleanup (release lock, delete messages)                           │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                    Watchdog Lambda (Crash Recovery)                   │  │
│  │                    Triggered by EventBridge every 30s                 │  │
│  │                                                                       │  │
│  │  1. Check for stuck conversations (stale processing locks)            │  │
│  │     → Re-queue to debounce:pending                                    │  │
│  │  2. Check processor health (stale heartbeat + expired lease)          │  │
│  │     → Start new Processor if pending work exists                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ EventBridge: messages.batch.ready
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS SERVICE                                 │
│                                                                             │
│  Receives:                                                                  │
│  {                                                                          │
│    conversationId: "conv_123",                                              │
│    messages: [                                                              │
│      { text: "Hey", timestamp: "..." },                                     │
│      { text: "I have a question about my order", timestamp: "..." },        │
│      { text: "Order #12345", timestamp: "..." },                            │
│      { text: "It hasn't arrived yet", timestamp: "..." },                   │
│      { text: "Can you help?", timestamp: "..." }                            │
│    ],                                                                       │
│    metadata: { platform: "whatsapp", ... }                                  │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### Self-Sustaining Processor

Instead of constant polling (wasteful when idle), the Processor Lambda:

1. **Starts on-demand** - Triggered by Ingest when first message arrives
2. **Runs continuously** - Loops internally with 500ms intervals
3. **Exits when idle** - Stops after 10 seconds of no activity
4. **Graceful timeout** - Exits 30 seconds before Lambda timeout

This eliminates polling costs when there are no messages to process.

### Fan-out for Parallelism

When multiple conversations are ready simultaneously, the Processor invokes a separate **ConversationProcessor Lambda** for each conversation asynchronously. This ensures:

- Slow AI processing for one conversation doesn't block others
- Automatic parallelism across conversations
- Independent error handling per conversation

### Fault Tolerance

The system is designed to recover from failures:

| Failure                       | Detection                             | Recovery                                    |
| ----------------------------- | ------------------------------------- | ------------------------------------------- |
| Processor crash               | Stale heartbeat + expired lease       | Watchdog starts new Processor               |
| Processor timeout             | Graceful exit before timeout          | Ingest or Watchdog restarts if pending work |
| ConversationProcessor crash   | `processing:{convId}` lock age > 5min | Watchdog re-queues to `debounce:pending`    |
| ConversationProcessor timeout | Same as crash                         | Same - lock expires, Watchdog recovers      |
| AI service error              | ConversationProcessor catches error   | Re-queues for retry                         |

---

## Component Details

### 1. Ingest Lambda

Receives webhooks from messaging platforms, buffers messages in Redis, and starts the Processor if not already running.

```typescript
import { Redis } from 'ioredis';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

interface BufferingRules {
  silenceMs: number; // Wait this long after last message (default: 1000ms)
  minMessages?: number; // Minimum messages before processing
  maxWaitMs?: number; // Maximum wait time regardless of activity
  maxMessages?: number; // Process immediately if this many messages buffered
  typingInferenceMs?: number; // If messages arrive < this apart, user is "typing"
}

// Lua script for atomic message buffering with typing inference
const BUFFER_MESSAGE_SCRIPT = `
  local convId = KEYS[1]
  local message = ARGV[1]
  local silenceMs = tonumber(ARGV[2])
  local typingInferenceMs = tonumber(ARGV[3])
  local maxWaitMs = tonumber(ARGV[4])
  local maxMessages = tonumber(ARGV[5])
  local now = tonumber(ARGV[6])
  
  -- Get timing info
  local lastMsgTime = redis.call('GET', 'lastmsg:' .. convId)
  local firstMsgTime = redis.call('GET', 'firstmsg:' .. convId)
  
  -- Determine effective silence threshold based on typing pattern
  local effectiveSilence = silenceMs
  if lastMsgTime then
    local gap = now - tonumber(lastMsgTime)
    if gap < typingInferenceMs then
      -- Messages arriving rapidly = user is typing, use longer threshold
      effectiveSilence = typingInferenceMs
    end
  end
  
  -- Track first message time for max wait calculation
  if not firstMsgTime then
    redis.call('SET', 'firstmsg:' .. convId, now, 'EX', 3600)
    firstMsgTime = now
  end
  
  -- Check max wait constraint
  local timeSinceFirst = now - tonumber(firstMsgTime)
  local processAt = now + effectiveSilence
  if maxWaitMs > 0 and timeSinceFirst + effectiveSilence > maxWaitMs then
    -- Would exceed max wait, process at max wait time instead
    processAt = tonumber(firstMsgTime) + maxWaitMs
  end
  
  -- Add message to buffer
  redis.call('LPUSH', 'messages:' .. convId, message)
  redis.call('EXPIRE', 'messages:' .. convId, 3600)
  
  -- Update last message time
  redis.call('SET', 'lastmsg:' .. convId, now, 'EX', 3600)
  
  -- Get current message count
  local msgCount = redis.call('LLEN', 'messages:' .. convId)
  
  -- Check if we should process immediately (max messages reached)
  if maxMessages > 0 and msgCount >= maxMessages then
    processAt = now  -- Process immediately
  end
  
  -- Update debounce schedule
  redis.call('ZADD', 'debounce:pending', processAt, convId)
  
  -- Update global activity tracker
  redis.call('SET', 'global:lastMessageTime', now, 'EX', 3600)
  
  return { processAt, msgCount, effectiveSilence }
`;

export const handler = async (event: WebhookEvent) => {
  const redis = new Redis(process.env.REDIS_URL);
  const lambda = new LambdaClient();

  try {
    const { conversationId, message, platform } = parseWebhook(event);

    // Load buffering rules (could be from DynamoDB, or cached in Redis)
    const rules = await getBufferingRules(conversationId);

    // Buffer message atomically
    const result = await redis.eval(
      BUFFER_MESSAGE_SCRIPT,
      1, // number of keys
      conversationId,
      JSON.stringify({
        ...message,
        platform,
        receivedAt: Date.now(),
      }),
      rules.silenceMs || 1000,
      rules.typingInferenceMs || 3000,
      rules.maxWaitMs || 30000,
      rules.maxMessages || 20,
      Date.now()
    );

    console.log(`Buffered message for ${conversationId}`, {
      scheduledFor: result[0],
      messageCount: result[1],
      effectiveSilence: result[2],
    });

    // Check if Processor is running (valid lease + recent heartbeat)
    const [leaseRaw, heartbeat] = await Promise.all([
      redis.get('processor:lease'),
      redis.get('processor:heartbeat'),
    ]);

    const lease = leaseRaw ? JSON.parse(leaseRaw) : null;
    const leaseValid = lease && lease.expiresAt > Date.now();
    const heartbeatRecent =
      heartbeat && Date.now() - parseInt(heartbeat) < 30_000;

    if (!leaseValid || !heartbeatRecent) {
      // Start Processor (async invocation - don't wait)
      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.PROCESSOR_FUNCTION_NAME,
          InvocationType: 'Event',
          Payload: JSON.stringify({ source: 'ingest' }),
        })
      );
      console.log('Started Processor Lambda');
    }

    return { statusCode: 200 };
  } finally {
    redis.disconnect();
  }
};
```

### 2. Processor Lambda (Self-Sustaining Loop)

Runs continuously until idle or near timeout. Fans out to ConversationProcessor for each ready conversation.

```typescript
import { Redis } from 'ioredis';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Context } from 'aws-lambda';
import { randomUUID } from 'crypto';

const TIMEOUT_BUFFER_MS = 30_000; // Exit 30s before Lambda timeout
const HEARTBEAT_INTERVAL_MS = 5_000; // Update heartbeat every 5s
const POLL_INTERVAL_MS = 500; // Check for ready conversations every 500ms
const IDLE_THRESHOLD_MS = 10_000; // Exit after 10s of no activity
const LEASE_TTL_MS = 60_000; // Lease expires after 60s if not renewed

// Lua script for atomic lease acquisition
const ACQUIRE_LEASE_SCRIPT = `
  local leaseKey = KEYS[1]
  local leaseData = ARGV[1]
  local now = tonumber(ARGV[2])
  local ttlMs = tonumber(ARGV[3])
  
  local current = redis.call('GET', leaseKey)
  if current then
    local data = cjson.decode(current)
    if data.expiresAt > now then
      return 0  -- Lease still valid, held by another processor
    end
  end
  
  -- Acquire lease
  redis.call('SET', leaseKey, leaseData, 'PX', ttlMs)
  return 1
`;

// Lua script for lease extension
const EXTEND_LEASE_SCRIPT = `
  local leaseKey = KEYS[1]
  local leaseId = ARGV[1]
  local newExpiry = tonumber(ARGV[2])
  local ttlMs = tonumber(ARGV[3])
  
  local current = redis.call('GET', leaseKey)
  if not current then
    return 0  -- Lease doesn't exist
  end
  
  local data = cjson.decode(current)
  if data.leaseId ~= leaseId then
    return 0  -- Lease held by different processor
  end
  
  -- Extend lease
  data.expiresAt = newExpiry
  redis.call('SET', leaseKey, cjson.encode(data), 'PX', ttlMs)
  return 1
`;

export const handler = async (event: { source?: string }, context: Context) => {
  const redis = new Redis(process.env.REDIS_URL);
  const lambda = new LambdaClient();
  const leaseId = randomUUID();

  try {
    // 1. Try to acquire lease
    const leaseData = JSON.stringify({
      leaseId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + LEASE_TTL_MS,
    });

    const acquired = await redis.eval(
      ACQUIRE_LEASE_SCRIPT,
      1,
      'processor:lease',
      leaseData,
      Date.now(),
      LEASE_TTL_MS
    );

    if (!acquired) {
      console.log('Another processor holds the lease, exiting');
      return { status: 'skipped', reason: 'lease_held' };
    }

    console.log(
      `Acquired lease: ${leaseId}, source: ${event.source || 'unknown'}`
    );

    const timeoutAt =
      Date.now() + (context.getRemainingTimeInMillis() - TIMEOUT_BUFFER_MS);
    let lastActivityTime = Date.now();
    let lastHeartbeat = 0;
    let processedCount = 0;
    let loopCount = 0;

    // 2. Main processing loop
    while (Date.now() < timeoutAt) {
      const now = Date.now();
      loopCount++;

      // Update heartbeat and extend lease periodically
      if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
        await redis.set('processor:heartbeat', now, 'PX', LEASE_TTL_MS);
        await redis.eval(
          EXTEND_LEASE_SCRIPT,
          1,
          'processor:lease',
          leaseId,
          now + LEASE_TTL_MS,
          LEASE_TTL_MS
        );
        lastHeartbeat = now;
      }

      // Check for ready conversations
      const ready = await redis.zrangebyscore('debounce:pending', 0, now);

      if (ready.length > 0) {
        lastActivityTime = now;
        console.log(`Found ${ready.length} conversations ready to process`);

        // Remove from pending set before invoking processors
        await redis.zrem('debounce:pending', ...ready);

        // Fan out: invoke ConversationProcessor for each (async, parallel)
        const invocations = ready.map((convId) =>
          lambda
            .send(
              new InvokeCommand({
                FunctionName: process.env.CONVERSATION_PROCESSOR_FUNCTION_NAME,
                InvocationType: 'Event', // Async - don't wait
                Payload: JSON.stringify({
                  convId,
                  processorLeaseId: leaseId,
                }),
              })
            )
            .catch((err) => {
              // If invocation fails, re-queue the conversation
              console.error(`Failed to invoke processor for ${convId}:`, err);
              return redis.zadd('debounce:pending', now, convId);
            })
        );

        await Promise.all(invocations);
        processedCount += ready.length;
      }

      // Check global activity (any new messages received?)
      const globalLastMessage = await redis.get('global:lastMessageTime');
      if (globalLastMessage && parseInt(globalLastMessage) > lastActivityTime) {
        lastActivityTime = parseInt(globalLastMessage);
      }

      // Check idle threshold
      if (now - lastActivityTime > IDLE_THRESHOLD_MS) {
        console.log(`Idle for ${IDLE_THRESHOLD_MS}ms, exiting gracefully`);
        break;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const exitReason = Date.now() >= timeoutAt ? 'timeout' : 'idle';
    console.log(
      `Processor exiting: ${exitReason}, loops: ${loopCount}, processed: ${processedCount}`
    );

    return {
      status: 'completed',
      processedCount,
      loopCount,
      exitReason,
    };
  } finally {
    // 3. Graceful shutdown - release lease and clear heartbeat
    await redis.del('processor:heartbeat');

    // Only release lease if we still own it
    const currentLease = await redis.get('processor:lease');
    if (currentLease) {
      const lease = JSON.parse(currentLease);
      if (lease.leaseId === leaseId) {
        await redis.del('processor:lease');
      }
    }

    redis.disconnect();
  }
};
```

### 3. ConversationProcessor Lambda (Per-Conversation)

Processes a single conversation's buffered messages with AI. Invoked asynchronously by the Processor.

```typescript
import { Redis } from 'ioredis';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';

const PROCESSING_LOCK_TTL_MS = 300_000; // 5 minute lock (max AI processing time)

export const handler = async (event: {
  convId: string;
  processorLeaseId: string;
}) => {
  const { convId, processorLeaseId } = event;
  const redis = new Redis(process.env.REDIS_URL);
  const eventbridge = new EventBridgeClient();

  try {
    // 1. Acquire conversation lock (prevent duplicate processing)
    const lockKey = `processing:${convId}`;
    const lockData = JSON.stringify({
      startedAt: Date.now(),
      processedBy: processorLeaseId,
    });

    const locked = await redis.set(
      lockKey,
      lockData,
      'NX', // Only if not exists
      'PX',
      PROCESSING_LOCK_TTL_MS
    );

    if (!locked) {
      console.log(`Conversation ${convId} already being processed, skipping`);
      return { status: 'skipped', reason: 'already_processing' };
    }

    // 2. Fetch buffered messages
    const messagesRaw = await redis.lrange(`messages:${convId}`, 0, -1);

    if (messagesRaw.length === 0) {
      console.log(`No messages for ${convId}, cleaning up`);
      await redis.del(lockKey);
      return { status: 'skipped', reason: 'no_messages' };
    }

    const messages = messagesRaw.map((m) => JSON.parse(m)).reverse(); // Chronological order

    console.log(`Processing ${messages.length} messages for ${convId}`);

    // 3. Emit event for AI processing
    await eventbridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'message-buffer',
            DetailType: 'messages.batch.ready',
            Detail: JSON.stringify({
              conversationId: convId,
              messages,
              bufferedAt: Date.now(),
              messageCount: messages.length,
              metadata: {
                platform: messages[0]?.platform,
                firstMessageAt: messages[0]?.receivedAt,
                lastMessageAt: messages[messages.length - 1]?.receivedAt,
              },
            }),
          },
        ],
      })
    );

    // 4. Cleanup - remove messages and release lock
    await redis.del(
      `messages:${convId}`,
      `lastmsg:${convId}`,
      `firstmsg:${convId}`,
      lockKey
    );

    console.log(
      `Successfully processed ${convId} with ${messages.length} messages`
    );
    return { status: 'success', messageCount: messages.length };
  } catch (error) {
    console.error(`Error processing ${convId}:`, error);

    // Re-queue for retry
    await redis.zadd('debounce:pending', Date.now(), convId);

    // Release lock so Watchdog can pick it up
    await redis.del(`processing:${convId}`);

    throw error;
  } finally {
    redis.disconnect();
  }
};
```

### 4. Watchdog Lambda (Crash Recovery)

Monitors system health and recovers from failures. Triggered by EventBridge every 30 seconds.

```typescript
import { Redis } from 'ioredis';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const HEARTBEAT_STALE_THRESHOLD_MS = 30_000; // Heartbeat older than 30s = stale
const PROCESSING_STUCK_THRESHOLD_MS = 300_000; // Processing lock older than 5min = stuck

export const handler = async () => {
  const redis = new Redis(process.env.REDIS_URL);
  const lambda = new LambdaClient();

  try {
    let recoveredConversations = 0;
    let processorStarted = false;

    // === Part 1: Recover stuck conversations ===
    const processingKeys = await redis.keys('processing:*');

    for (const key of processingKeys) {
      const lockData = await redis.get(key);
      if (!lockData) continue;

      const { startedAt } = JSON.parse(lockData);
      const lockAge = Date.now() - startedAt;

      // If lock is older than threshold, conversation is stuck
      if (lockAge > PROCESSING_STUCK_THRESHOLD_MS) {
        const convId = key.replace('processing:', '');
        console.log(
          `Found stuck conversation: ${convId}, lock age: ${lockAge}ms`
        );

        // Re-queue for processing
        await redis.zadd('debounce:pending', Date.now(), convId);

        // Release the stale lock
        await redis.del(key);

        recoveredConversations++;
      }
    }

    if (recoveredConversations > 0) {
      console.log(`Recovered ${recoveredConversations} stuck conversations`);
    }

    // === Part 2: Check if Processor needs to be started ===
    const pendingCount = await redis.zcard('debounce:pending');

    if (pendingCount === 0) {
      return {
        status: 'healthy',
        pendingCount: 0,
        recoveredConversations,
        processorStarted: false,
      };
    }

    // Check processor heartbeat
    const heartbeat = await redis.get('processor:heartbeat');
    const heartbeatAge = heartbeat
      ? Date.now() - parseInt(heartbeat)
      : Infinity;

    // Check lease
    const leaseRaw = await redis.get('processor:lease');
    const lease = leaseRaw ? JSON.parse(leaseRaw) : null;
    const leaseValid = lease && lease.expiresAt > Date.now();

    console.log(
      `Health check: pending=${pendingCount}, heartbeatAge=${heartbeatAge}ms, leaseValid=${leaseValid}`
    );

    // If heartbeat is stale and lease expired, start new processor
    if (heartbeatAge > HEARTBEAT_STALE_THRESHOLD_MS && !leaseValid) {
      console.log('Processor appears dead, starting new one');

      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.PROCESSOR_FUNCTION_NAME,
          InvocationType: 'Event',
          Payload: JSON.stringify({ source: 'watchdog' }),
        })
      );

      processorStarted = true;
    }

    return {
      status: processorStarted ? 'processor_started' : 'healthy',
      pendingCount,
      heartbeatAge,
      leaseValid,
      recoveredConversations,
      processorStarted,
    };
  } finally {
    redis.disconnect();
  }
};
```

### 5. ElastiCache Serverless Configuration

```typescript
// In SST/CDK infrastructure code
import { aws_elasticache as elasticache } from 'aws-cdk-lib';

const serverlessCache = new elasticache.CfnServerlessCache(
  this,
  'MessageBuffer',
  {
    serverlessCacheName: `message-buffer-${stage}`,
    engine: 'valkey', // Or 'redis' - Valkey is 33% cheaper

    // Security
    subnetIds: vpc.privateSubnets.map((s) => s.subnetId),
    securityGroupIds: [securityGroup.securityGroupId],

    // Scaling
    cacheUsageLimits: {
      dataStorage: {
        maximum: 5, // GB - adjust based on expected buffer size
        unit: 'GB',
      },
      ecpuPerSecond: {
        maximum: 5000, // Adjust based on throughput needs
      },
    },
  }
);
```

---

## Dynamic Buffering Rules

Rules can be configured per conversation, agent, or tenant:

```typescript
interface BufferingRules {
  // Core debounce settings
  silenceMs: number; // Wait after last message (default: 1000ms)

  // Typing inference
  typingInferenceMs?: number; // Gap < this = user still typing (default: 3000ms)

  // Constraints
  minMessages?: number; // Don't process until at least N messages
  maxMessages?: number; // Process immediately at N messages
  maxWaitMs?: number; // Maximum total wait time (default: 30000ms)

  // Platform-specific overrides
  platformOverrides?: {
    whatsapp?: Partial<BufferingRules>;
    messenger?: Partial<BufferingRules>;
  };
}

// Example: Different rules for different scenarios
const rules = {
  // Quick support chat: fast responses
  quickSupport: {
    silenceMs: 500,
    maxWaitMs: 5000,
  },

  // Complex inquiries: wait for full context
  complexInquiry: {
    silenceMs: 2000,
    minMessages: 2,
    maxWaitMs: 60000,
  },

  // High-volume: batch aggressively
  highVolume: {
    silenceMs: 1000,
    maxMessages: 10,
    maxWaitMs: 10000,
  },
};
```

### Rules Storage Options

1. **DynamoDB** - For tenant/agent-level rules with infrequent changes
2. **Redis** - For conversation-level rules that need fast access
3. **Hybrid** - DynamoDB for config, cached in Redis per conversation

---

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPC                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Private Subnets                               │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐     ┌──────────────────────────────────────┐   │   │
│  │  │  ElastiCache    │     │  Lambda Functions                    │   │   │
│  │  │  Serverless     │◀───▶│                                      │   │   │
│  │  │  (Redis/Valkey) │     │  - IngestFunction                    │   │   │
│  │  │                 │     │  - ProcessorFunction                 │   │   │
│  │  │                 │     │  - ConversationProcessorFunction     │   │   │
│  │  │                 │     │  - WatchdogFunction                  │   │   │
│  │  └─────────────────┘     └──────────────────────────────────────┘   │   │
│  │                                   │                                  │   │
│  └───────────────────────────────────┼──────────────────────────────────┘   │
│                                      │                                      │
│  ┌───────────────────────────────────▼──────────────────────────────────┐   │
│  │                        NAT Gateway                                   │   │
│  │                        (for external API calls)                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────────┐                    ┌─────────────────────────────────┐
│  API Gateway        │                    │  EventBridge                    │
│  (webhook endpoint) │                    │  - Rule: rate(30s) → Watchdog   │
└─────────────────────┘                    │  - Bus: messages.batch.ready    │
                                           └─────────────────────────────────┘
```

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NORMAL FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Message 1 ──► Ingest ──► Buffer in Redis                                  │
│                    │                                                        │
│                    └──► Check: Processor running? NO                       │
│                              └──► Invoke Processor (async)                 │
│                                                                             │
│  Message 2 ──► Ingest ──► Buffer in Redis                                  │
│                    │                                                        │
│                    └──► Check: Processor running? YES (skip)               │
│                                                                             │
│  (silence threshold reached)                                                │
│                                                                             │
│  Processor ──► Check pending ──► Found conv_123                            │
│       │                                                                     │
│       └──► Invoke ConversationProcessor(conv_123) ──► AI ──► Response      │
│                                                                             │
│  (10 seconds of no activity)                                                │
│                                                                             │
│  Processor ──► Idle threshold reached ──► Exit gracefully                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECOVERY FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Processor crashes (or times out ungracefully)                              │
│       │                                                                     │
│       └──► Heartbeat becomes stale (>30s old)                              │
│       └──► Lease expires (TTL)                                             │
│                                                                             │
│  Watchdog (every 30s) ──► Check heartbeat: STALE                           │
│       │                   Check lease: EXPIRED                             │
│       │                   Check pending: HAS WORK                          │
│       │                                                                     │
│       └──► Invoke new Processor (async)                                    │
│                                                                             │
│  New Processor ──► Acquires lease ──► Resumes processing                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONVERSATION RECOVERY FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ConversationProcessor crashes (or times out)                               │
│       │                                                                     │
│       └──► processing:{convId} lock remains (with startedAt timestamp)     │
│                                                                             │
│  Watchdog (every 30s) ──► Scan processing:* keys                           │
│       │                   Found: processing:conv_123, age > 5min           │
│       │                                                                     │
│       └──► Re-queue: ZADD debounce:pending {now} conv_123                  │
│       └──► Delete stale lock                                               │
│                                                                             │
│  Processor ──► Picks up conv_123 ──► Retries processing                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SST Configuration Example

```typescript
// services/message-buffer/sst.config.ts
import { SSTConfig } from 'sst';
import { MessageBufferStack } from './infra/Main';

export default {
  config(_input) {
    return {
      name: 'message-buffer',
      region: 'ap-southeast-1',
    };
  },
  stacks(app) {
    app.stack(MessageBufferStack);
  },
} satisfies SSTConfig;
```

```typescript
// services/message-buffer/infra/Main.ts
import { StackContext, Function, Api } from 'sst/constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export function MessageBufferStack({ stack }: StackContext) {
  // VPC for ElastiCache access
  const vpc = new ec2.Vpc(stack, 'BufferVpc', {
    maxAzs: 2,
    natGateways: 1,
  });

  // Security group for Redis access
  const redisSecurityGroup = new ec2.SecurityGroup(
    stack,
    'RedisSecurityGroup',
    {
      vpc,
      allowAllOutbound: true,
    }
  );

  redisSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(6379),
    'Allow Redis access from VPC'
  );

  // ElastiCache Serverless
  const cache = new elasticache.CfnServerlessCache(stack, 'MessageBuffer', {
    serverlessCacheName: `msg-buffer-${stack.stage}`,
    engine: 'valkey',
    subnetIds: vpc.privateSubnets.map((s) => s.subnetId),
    securityGroupIds: [redisSecurityGroup.securityGroupId],
    cacheUsageLimits: {
      dataStorage: { maximum: 2, unit: 'GB' },
      ecpuPerSecond: { maximum: 5000 },
    },
  });

  // Lambda security group
  const lambdaSecurityGroup = new ec2.SecurityGroup(
    stack,
    'LambdaSecurityGroup',
    {
      vpc,
      allowAllOutbound: true,
    }
  );

  // Shared Lambda environment
  const lambdaEnvironment = {
    REDIS_URL: cache.attrEndpointAddress,
  };

  // Conversation Processor Lambda (per-conversation AI processing)
  const conversationProcessorFunction = new Function(
    stack,
    'ConversationProcessorFunction',
    {
      handler: 'functions/src/conversation-processor.handler',
      vpc,
      securityGroups: [lambdaSecurityGroup],
      environment: lambdaEnvironment,
      timeout: '5 minutes', // Allow time for AI processing
      memorySize: 512,
    }
  );

  // Processor Lambda (self-sustaining loop)
  const processorFunction = new Function(stack, 'ProcessorFunction', {
    handler: 'functions/src/processor.handler',
    vpc,
    securityGroups: [lambdaSecurityGroup],
    environment: {
      ...lambdaEnvironment,
      CONVERSATION_PROCESSOR_FUNCTION_NAME:
        conversationProcessorFunction.functionName,
    },
    timeout: '15 minutes', // Max Lambda timeout - will exit gracefully before
    memorySize: 256,
  });

  // Grant Processor permission to invoke ConversationProcessor
  conversationProcessorFunction.grantInvoke(processorFunction);

  // Ingest Lambda
  const ingestFunction = new Function(stack, 'IngestFunction', {
    handler: 'functions/src/ingest.handler',
    vpc,
    securityGroups: [lambdaSecurityGroup],
    environment: {
      ...lambdaEnvironment,
      PROCESSOR_FUNCTION_NAME: processorFunction.functionName,
    },
    timeout: '10 seconds',
  });

  // Grant Ingest permission to invoke Processor
  processorFunction.grantInvoke(ingestFunction);

  // Watchdog Lambda (crash recovery)
  const watchdogFunction = new Function(stack, 'WatchdogFunction', {
    handler: 'functions/src/watchdog.handler',
    vpc,
    securityGroups: [lambdaSecurityGroup],
    environment: {
      ...lambdaEnvironment,
      PROCESSOR_FUNCTION_NAME: processorFunction.functionName,
    },
    timeout: '30 seconds',
  });

  // Grant Watchdog permission to invoke Processor
  processorFunction.grantInvoke(watchdogFunction);

  // EventBridge rule to trigger Watchdog every 30 seconds
  new events.Rule(stack, 'WatchdogSchedule', {
    schedule: events.Schedule.rate(cdk.Duration.seconds(30)),
    targets: [new targets.LambdaFunction(watchdogFunction)],
  });

  // API for webhooks
  const api = new Api(stack, 'WebhookApi', {
    routes: {
      'POST /webhook/{platform}': ingestFunction,
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
    CacheEndpoint: cache.attrEndpointAddress,
  });
}
```

---

## Cost Estimation

### Self-Sustaining Processor Model

The key cost advantage of this design: **no polling when idle**. The Processor only runs when there are messages to process.

| Component                          | Usage (100K messages/day)               | Calculation               | Monthly Cost      |
| ---------------------------------- | --------------------------------------- | ------------------------- | ----------------- |
| **ElastiCache Serverless**         | ~100MB storage, light ECPU              | Base + usage              | ~$10-15           |
| **Lambda (Ingest)**                | 100K invocations × 100ms × 256MB        | Standard pricing          | ~$0.20            |
| **Lambda (Processor)**             | ~30 invocations/day × 10min avg × 256MB | Only runs during activity | ~$0.40            |
| **Lambda (ConversationProcessor)** | ~30K invocations × 5s avg × 512MB       | 1 per conversation batch  | ~$0.80            |
| **Lambda (Watchdog)**              | 86,400 invocations × 500ms × 128MB      | Every 30s                 | ~$0.11            |
| **API Gateway**                    | 100K requests                           | Standard pricing          | ~$0.35            |
| **NAT Gateway**                    | ~1GB data transfer                      | Data processing           | ~$5-10            |
| **EventBridge**                    | ~30K events emitted                     | Event publishing          | ~$0.03            |
| **Total**                          |                                         |                           | **~$17-27/month** |

### Watchdog Cost Breakdown

Running every 30 seconds:

```
Invocations: 2/min × 60 min × 24 hr × 30 days = 86,400/month
Duration:    86,400 × 500ms × 128MB = 5,400 GB-seconds
Cost:        ~$0.11/month
```

**Verdict**: Watchdog is essentially free (~$0.11/month) and provides critical fault tolerance.

### Cost Comparison: Polling vs Self-Sustaining

| Approach                          | Processor Cost/Month | Notes                            |
| --------------------------------- | -------------------- | -------------------------------- |
| **Constant polling (500ms)**      | ~$15-20              | 5.2M invocations, running 24/7   |
| **Self-sustaining (this design)** | ~$0.40               | Only runs during active periods  |
| **Savings**                       | **~97%**             | Processor cost nearly eliminated |

### Scaling Considerations

| Traffic Level | Messages/Day | Estimated Cost  |
| ------------- | ------------ | --------------- |
| Low           | 10K          | ~$12-18/month   |
| Medium        | 100K         | ~$17-27/month   |
| High          | 1M           | ~$35-50/month   |
| Very High     | 10M          | ~$150-200/month |

The main cost drivers at scale are:

1. **ElastiCache ECPU** - scales with Redis operations
2. **ConversationProcessor Lambda** - scales with conversation volume
3. **NAT Gateway** - scales with external API calls

---

## Considerations & Trade-offs

### Pros

1. **Sub-second debounce** - Can respond within 1-2 seconds of silence
2. **True debounce** - New messages reset the timer
3. **Dynamic rules** - Different behavior per conversation/agent
4. **Typing inference** - Detects rapid typing patterns
5. **Atomic operations** - Lua scripts prevent race conditions
6. **Scalable** - Redis handles high throughput easily
7. **Cost efficient** - No polling when idle, ~97% savings vs constant polling
8. **Fault tolerant** - Automatic recovery from crashes via Watchdog
9. **Parallel processing** - Fan-out ensures conversations don't block each other

### Cons

1. **VPC required** - ElastiCache needs VPC, adds NAT Gateway cost
2. **Additional service** - Adds operational complexity
3. **Cold starts** - VPC Lambda cold starts are slower (~1-2s) for first message after idle
4. **Cost floor** - ElastiCache Serverless has minimum cost (~$6/month)
5. **Complexity** - More moving parts than simple polling approach

### Alternatives Considered

| Approach              | Verdict                                             |
| --------------------- | --------------------------------------------------- |
| DynamoDB + Polling    | Higher latency, but no VPC needed                   |
| Step Functions        | Can't cancel wait states, expensive at scale        |
| SQS Delay             | Can't reschedule, not true debounce                 |
| EventBridge Scheduler | 60-second minimum, too slow for real-time chat      |
| Constant polling      | Works but wasteful (~$15-20/month for idle polling) |

---

## State Diagram

### Processor Lifecycle

```
                                    ┌─────────────────┐
                                    │   No Processor  │
                                    │    Running      │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
           │  New Message   │      │   Watchdog     │      │  Pending Work  │
           │  (Ingest)      │      │  Detects Dead  │      │  + Stale State │
           └───────┬────────┘      └───────┬────────┘      └───────┬────────┘
                   │                       │                       │
                   └───────────────────────┼───────────────────────┘
                                           │
                                           ▼
                                ┌─────────────────────┐
                                │  Acquire Lease      │
                                │  (atomic, with TTL) │
                                └──────────┬──────────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌──────────────────┐      ┌──────────────────┐
                    │  Lease Acquired  │      │  Lease Held by   │
                    │  Start Loop      │      │  Another → Exit  │
                    └────────┬─────────┘      └──────────────────┘
                             │
                             ▼
              ┌────────────────────────┐
              │  Processing Loop       │◄─────────────────────┐
              │  - Update heartbeat    │                      │
              │  - Check ready convs   │                      │
              │  - Fan out to workers  │                      │
              │  - Sleep 500ms         │                      │
              └────────────┬───────────┘                      │
                           │                                  │
          ┌────────────────┼────────────────┐                │
          │                │                │                │
          ▼                ▼                ▼                │
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
  │ Near Timeout │ │ Idle > 10s   │ │ More Work    │        │
  │ (30s buffer) │ │ No Activity  │ │ Continue     │────────┘
  └──────┬───────┘ └──────┬───────┘ └──────────────┘
         │                │
         ▼                ▼
  ┌─────────────────────────────────────────────────┐
  │  Graceful Exit                                  │
  │  - Release lease                                │
  │  - Clear heartbeat                              │
  │  → Back to "No Processor Running"               │
  └─────────────────────────────────────────────────┘
```

### Conversation Processing Lifecycle

```
┌─────────────────┐
│ Message Arrives │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Buffer in Redis             │
│ Update debounce:pending     │
│ (processAt = now + silence) │
└────────┬────────────────────┘
         │
         │ (more messages arrive)
         │
         ▼
┌─────────────────────────────┐
│ Update processAt            │◄──── Timer resets on each message
│ (now + silence)             │
└────────┬────────────────────┘
         │
         │ (silence threshold reached)
         │
         ▼
┌─────────────────────────────┐
│ Processor picks up          │
│ Invokes ConversationProc    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Acquire processing lock     │
│ Fetch messages              │
│ Call AI                     │
│ Send response               │
│ Cleanup                     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Done - Ready for next batch │
└─────────────────────────────┘
```

---

## Future Enhancements

1. **Smart silence detection** - Use ML to predict when user is done typing based on message length, time of day, historical patterns
2. **Platform-specific optimization** - WhatsApp vs Messenger have different typing patterns; tune thresholds per platform
3. **Priority lanes** - VIP conversations get shorter debounce, or skip debounce entirely
4. **Metrics & observability** - Track debounce effectiveness, average wait times, message aggregation rates
5. **Provisioned concurrency** - Eliminate cold starts for first message after idle period
6. **Multi-region** - Redis Global Datastore for cross-region conversation continuity
7. **Adaptive thresholds** - Automatically tune silence thresholds based on observed user behavior
8. **Graceful degradation** - Fall back to immediate processing if Redis is unavailable

---

## Configuration Reference

### Default Values

```typescript
const DEFAULT_CONFIG = {
  // Debounce settings
  silenceMs: 1000, // Wait 1s after last message
  typingInferenceMs: 3000, // Extend to 3s if rapid messages
  maxWaitMs: 30000, // Process within 30s regardless
  maxMessages: 20, // Process immediately at 20 messages

  // Processor settings
  pollIntervalMs: 500, // Check for ready conversations every 500ms
  idleThresholdMs: 10000, // Exit after 10s of no activity
  timeoutBufferMs: 30000, // Exit 30s before Lambda timeout

  // Health check settings
  heartbeatIntervalMs: 5000, // Update heartbeat every 5s
  leaseTtlMs: 60000, // Lease expires after 60s
  heartbeatStaleMs: 30000, // Heartbeat older than 30s = stale
  processingStuckMs: 300000, // Processing lock older than 5min = stuck
};
```

### Environment Variables

| Variable                               | Description                         | Required         |
| -------------------------------------- | ----------------------------------- | ---------------- |
| `REDIS_URL`                            | ElastiCache endpoint URL            | Yes              |
| `PROCESSOR_FUNCTION_NAME`              | ARN of Processor Lambda             | Ingest, Watchdog |
| `CONVERSATION_PROCESSOR_FUNCTION_NAME` | ARN of ConversationProcessor Lambda | Processor        |

---

## Related Documents

- [AI Agents Service Architecture](./ai-agents-service-architecture.md)
- [Conversations Service Architecture](./conversations-service-architecture.md)
- [WhatsApp Platform Integration](./whatsapp-platform-integration.md)
- [Integrations Service Architecture](./integrations-service-architecture.md)
