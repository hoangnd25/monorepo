# Conversations Service Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-10

## Context & Problem Statement

### Business Need

Tenants need a unified way to manage customer conversations across multiple communication channels. Currently, businesses juggle separate tools for:

- Facebook Messenger (Page messages)
- Instagram Direct Messages
- (Future) Email, support tickets, chat widgets, social interactions (short videos)

This fragmentation leads to:

- Missed messages and slow response times
- Inconsistent customer experience
- Operational overhead managing multiple platforms
- No unified view of customer interactions

### Solution

Build a **Conversations Service** that:

1. **Receives messages** on behalf of tenants from connected platforms
2. **Normalizes** messages into a unified format
3. **Stores** conversation history with full context
4. **Enables responses** back through the original channel
5. **Exposes an internal API** for other services (main-ui) to consume

### Initial Scope

**Phase 1**: Facebook Messenger + Instagram DM + WhatsApp + Zalo + Gmail + Internal Channel

- Webhook integration to receive real-time messages
  - Single endpoint for Meta platforms (FB/IG/WhatsApp)
  - Separate endpoint for Zalo (different signature scheme)
  - Separate endpoint for Gmail (Cloud Pub/Sub push)
  - Internal channel: Direct API + WebSocket (no webhooks)
- Platform-specific onboarding flows (OAuth, Embedded Signup, PKCE)
- Send replies through the platform APIs
- Basic conversation threading
- Platform-specific messaging window enforcement:
  - Meta platforms: 24-hour window
  - Zalo: 7-day window (48 hours free, then paid)
  - Gmail: No window (can reply anytime)
  - Internal: No window (full control)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL PLATFORMS                             │
├─────────────────────────────────────────┬───────────────────────────────────┤
│              Meta Platform              │      Zalo       │      Gmail      │   Internal    │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  │  ┌───────────┐  │  ┌───────────┐  │  ┌─────────┐  │
│  │Facebook │  │Instagram │  │WhatsApp│  │  │Zalo OA    │  │  │Gmail API  │  │  │Widget/  │  │
│  │Messenger│  │   DM     │  │Business│  │  │           │  │  │           │  │  │API      │  │
│  └────┬────┘  └────┬─────┘  └───┬────┘  │  └─────┬─────┘  │  └─────┬─────┘  │  └────┬────┘  │
│       │            │            │       │        │        │        │        │       │       │
└───────┼────────────┼────────────┼───────┴────────┼────────┴────────┼────────┴───────┼───────┘
        │            │            │                │                 │                │
        │ Webhooks   │ Webhooks   │ Webhooks       │ Webhooks        │ Pub/Sub        │ Direct
        └────────────┼────────────┘                │                 │                │ API/WS
                     │ (same endpoint)             │                 │                │
                     ▼                             ▼                 ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVERSATIONS SERVICE                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    API Gateway (Public Webhooks)                      │  │
│  │              POST /webhooks/meta (handles FB + IG + WhatsApp)         │  │
│  │              POST /webhooks/zalo (handles Zalo OA)                    │  │
│  │              POST /webhooks/gmail (handles Gmail via Pub/Sub)         │  │
│  │              GET  /webhooks/meta (verification challenge)             │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    API Gateway (Internal Channel)                     │  │
│  │              POST /v1/chat/sessions (create session)                  │  │
│  │              POST /v1/chat/sessions/:id/messages (send message)       │  │
│  │              WSS  /v1/chat/ws (real-time WebSocket)                   │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       SQS Queue (Webhook Buffer)                      │  │
│  │              Decouples webhook receipt from processing                │  │
│  │              Handles WhatsApp's 7-day retry window                    │  │
│  │              Critical for Zalo's 2-second response requirement        │  │
│  │              Gmail: Pub/Sub handles retries, SQS for internal buffer  │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Lambda: Message Processor                         │  │
│  │  1. Detect platform (page/instagram/whatsapp_business_account/zalo/   │  │
│  │     gmail/internal)                                                   │  │
│  │  2. Check idempotency (skip duplicates via platformMsgId)             │  │
│  │  3. Lookup tenant by Page ID / IG Account ID / Phone Number ID /      │  │
│  │     OA ID / Email Address                                             │  │
│  │  4. Normalize to unified message format                               │  │
│  │     (Gmail: fetch via history.list API first)                         │  │
│  │  5. Store message & update conversation                               │  │
│  │  6. Update lastCustomerMessageAt for messaging window                 │  │
│  │  7. Emit event for real-time notifications                            │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│            ┌───────────────────────┼───────────────────────┐                │
│            │                       │                       │                │
│            ▼                       ▼                       ▼                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐    │
│  │   DynamoDB      │   │  EventBridge    │   │   S3                    │    │
│  │                 │   │                 │   │                         │    │
│  │  • Channels     │   │  Events:        │   │  • Message attachments  │    │
│  │  • Conversations│   │  • message.new  │   │  • Media (images/video) │    │
│  │  • Messages     │   │  • message.sent │   │  • Thumbnails           │    │
│  │  • Sessions     │   │  • channel.*    │   │  • Email attachments    │    │
│  │  • API Keys     │   │  • session.*    │   │                         │    │
│  │  GSI for        │   │                 │   │                         │    │
│  │  idempotency    │   │                 │   │                         │    │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Scheduled Tasks (EventBridge Rules)                │  │
│  │  • Token Refresh Scheduler (Zalo: every 6 hours)                      │  │
│  │  • Gmail Watch Renewal (every 12 hours - watches expire in 7 days)    │  │
│  │  • Gmail Fallback Sync (every 10 minutes - reliability backup)        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Internal API (ORPC + IAM Auth)                     │  │
│  │                                                                       │  │
│  │  Channels:                    Conversations:                          │  │
│  │  • channels.list              • conversations.list                    │  │
│  │  • channels.connect           • conversations.get                     │  │
│  │  • channels.disconnect        • conversations.archive                 │  │
│  │                                                                       │  │
│  │  Messages:                    Templates (WhatsApp/Zalo):              │  │
│  │  • messages.list              • templates.list                        │  │
│  │  • messages.send              • templates.send                        │  │
│  │  • messages.markRead                                                  │  │
│  │                               Onboarding:                             │  │
│  │                               • oauth.{platform}.initiate             │  │
│  │                               • oauth.{platform}.callback             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                    ▲
        │ Events                             │ Internal API Calls
        ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OTHER SERVICES                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           main-ui                                   │    │
│  │  • Inbox view (list conversations)                                  │    │
│  │  • Conversation detail (message thread)                             │    │
│  │  • Compose/reply interface                                          │    │
│  │  • Messaging window status indicator                                │    │
│  │  • WhatsApp template selector                                       │    │
│  │  • Channel connection settings                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

### Resolved Questions

| Decision           | Choice                                   | Rationale                                                                                                                             |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-region       | Single region (us-west-2)                | Simpler start; can add GlobalTable later if needed                                                                                    |
| Queue strategy     | SQS between webhook and processor        | Meta requires 200 OK within 5s; SQS provides durability/retries                                                                       |
| Token storage      | Encrypted in DynamoDB (KMS)              | Keeps channel data together; easier queries by tenant                                                                                 |
| API exposure       | Shared HTTP API from shared-infra        | Consistent with auth service pattern; single API endpoint                                                                             |
| Webhook endpoint   | Separate public API Gateway              | Webhooks need public access (no IAM); signature validation only                                                                       |
| Integration module | In-service module (not separate service) | Tight coupling with channel data; module boundary approach without network overhead; 5-6 platforms doesn't justify service extraction |

---

## Core Concepts

### Channel

A **Channel** represents a connected external platform account owned by a tenant.

| Field                | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `tenantId`           | Owning tenant                                                                               |
| `channelId`          | Unique identifier (ULID)                                                                    |
| `platform`           | `facebook` \| `instagram` \| `whatsapp` \| `zalo` \| `gmail` \| `internal`                  |
| `platformId`         | External ID (Page ID, IG Account ID, Phone Number ID, OA ID, email address, or internal ID) |
| `name`               | Display name (Page name, WhatsApp display name, OA name, or email address)                  |
| `phoneNumber`        | _(WhatsApp only)_ Business phone number in E.164 format (e.g., `+15551234567`)              |
| `wabaId`             | _(WhatsApp only)_ WhatsApp Business Account ID                                              |
| `oaId`               | _(Zalo only)_ Official Account ID (same as platformId for Zalo)                             |
| `oaSecretKey`        | _(Zalo only)_ Encrypted OA Secret Key for webhook signature validation                      |
| `email`              | _(Gmail only)_ User's email address (same as platformId for Gmail)                          |
| `historyId`          | _(Gmail only)_ Last processed Gmail history ID for incremental sync                         |
| `watchExpiration`    | _(Gmail only)_ Gmail API watch expiration timestamp (max 7 days)                            |
| `accessToken`        | Encrypted access token (KMS) - Page token, Business token, OA token, or Google OAuth token  |
| `refreshToken`       | _(Zalo/Gmail)_ Encrypted refresh token for automatic renewal                                |
| `tokenExpiresAt`     | Token expiration (Meta: never expires, Zalo: 25 hours, Gmail: ~1 hour)                      |
| `tokenStatus`        | `valid` \| `invalid` \| `requires_reauth` - token health status                             |
| `connectedAt`        | Timestamp when channel was connected                                                        |
| `disconnectedAt`     | Timestamp when channel was disconnected (if applicable)                                     |
| `disconnectedReason` | Reason for disconnection (token revoked, expired, etc.)                                     |
| `status`             | `active` \| `disconnected` \| `error`                                                       |

### Conversation

A **Conversation** groups related messages between participants.

| Field                   | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `tenantId`              | Owning tenant                                                                       |
| `conversationId`        | Unique identifier (ULID)                                                            |
| `channelId`             | Which channel this conversation belongs to                                          |
| `platform`              | Denormalized: `facebook` \| `instagram` \| `whatsapp` \| `zalo` \| `gmail`          |
| `platformThreadId`      | External thread ID from platform (Gmail threadId, etc.)                             |
| `participantId`         | Customer's platform ID (PSID, IGSID, phone number, Zalo UID, email, or session ID)  |
| `participantIdType`     | `scoped` (FB/IG/Zalo), `phone` (WhatsApp), `email` (Gmail), or `session` (Internal) |
| `participantName`       | Customer display name                                                               |
| `participantAvatar`     | Customer profile picture URL                                                        |
| `subject`               | _(Gmail only)_ Email subject line                                                   |
| `status`                | `open` \| `archived` \| `snoozed`                                                   |
| `lastMessageAt`         | Timestamp of most recent message (any direction)                                    |
| `lastCustomerMessageAt` | Timestamp of last **inbound** message - for messaging window calculation            |
| `lastMessagePreview`    | Snippet for list views                                                              |
| `unreadCount`           | Number of unread messages                                                           |

> **Note**: `lastCustomerMessageAt` is critical for enforcing messaging windows. Window duration varies by platform:
>
> - **Meta platforms (FB/IG/WhatsApp)**: 24 hours
> - **Zalo**: 7 days (48 hours free, then paid)
> - **Gmail**: No messaging window (can reply anytime)
> - **Internal**: No messaging window (full control)

### Message

A **Message** is a single communication unit within a conversation.

| Field            | Description                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- |
| `conversationId` | Parent conversation                                                                   |
| `messageId`      | Unique identifier (ULID)                                                              |
| `platformMsgId`  | External message ID (`mid.xxx` for FB/IG, `wamid.xxx` for WhatsApp, Gmail message ID) |
| `direction`      | `inbound` \| `outbound`                                                               |
| `senderId`       | Platform ID of sender                                                                 |
| `content`        | Message content (text body)                                                           |
| `contentType`    | See Content Types table below                                                         |
| `attachments`    | Array of attachment references (S3 keys or external URLs)                             |
| `template`       | _(WhatsApp only)_ Template details if message was sent as template                    |
| `interactive`    | _(WhatsApp only)_ Interactive message details (buttons, lists)                        |
| `subject`        | _(Gmail only)_ Email subject line                                                     |
| `from`           | _(Gmail only)_ From email address                                                     |
| `to`             | _(Gmail only)_ To email addresses (array)                                             |
| `cc`             | _(Gmail only)_ CC email addresses (array)                                             |
| `bcc`            | _(Gmail only)_ BCC email addresses (array, outbound only)                             |
| `inReplyTo`      | _(Gmail only)_ In-Reply-To header for threading                                       |
| `references`     | _(Gmail only)_ References header for threading (array)                                |
| `htmlBody`       | _(Gmail only)_ HTML content of email                                                  |
| `sentAt`         | Platform timestamp                                                                    |
| `receivedAt`     | When we received/processed it                                                         |
| `status`         | `received` \| `sent` \| `delivered` \| `read` \| `failed`                             |
| `failureReason`  | Error details if status is `failed`                                                   |

#### Content Types

| Type          | FB/IG | WhatsApp | Zalo | Gmail | Description                   |
| ------------- | ----- | -------- | ---- | ----- | ----------------------------- |
| `text`        | Yes   | Yes      | Yes  | Yes   | Plain text message            |
| `image`       | Yes   | Yes      | Yes  | Yes   | Image with optional caption   |
| `video`       | Yes   | Yes      | Yes  | Yes   | Video with optional caption   |
| `audio`       | Yes   | Yes      | Yes  | No    | Audio file                    |
| `file`        | Yes   | Yes      | Yes  | Yes   | Document/file attachment      |
| `location`    | No    | Yes      | Yes  | No    | Location coordinates          |
| `contacts`    | No    | Yes      | No   | No    | Contact card(s)               |
| `interactive` | No    | Yes      | Yes  | No    | Buttons, lists, CTAs          |
| `template`    | No    | Yes      | Yes  | No    | Pre-approved template message |
| `sticker`     | Yes   | Yes      | Yes  | No    | Sticker                       |
| `reaction`    | Yes   | Yes      | No   | No    | Reaction to another message   |
| `html`        | No    | No       | No   | Yes   | HTML email body               |

#### Template Message Structure (WhatsApp)

```typescript
interface TemplateDetails {
  name: string; // Template name (e.g., "order_confirmation")
  language: string; // Language code (e.g., "en_US")
  category: 'marketing' | 'utility' | 'authentication';
  components: Array<{
    type: 'header' | 'body' | 'footer' | 'button';
    parameters: Array<{ type: string; value: string }>;
  }>;
}
```

---

## Platform Integrations

### Meta (Facebook Messenger + Instagram DM)

> **Detailed documentation**: [Meta Platform Integration Guide](./meta-platform-integration.md)

**Summary**:

- Single webhook endpoint handles both Facebook and Instagram
- Payloads differ by `object` field: `"page"` vs `"instagram"`
- User IDs: PSID (Facebook), IGSID (Instagram)
- 24-hour messaging window for responses
- Signature validation using `X-Hub-Signature-256` with App Secret

**Limitations**:

- Only works with Facebook Pages (not personal accounts)
- Only works with Instagram Professional accounts (not personal)
- Advanced Access required for production (App Review process)

### WhatsApp Business Platform

> **Detailed documentation**: [WhatsApp Platform Integration Guide](./whatsapp-platform-integration.md)

**Summary**:

- Same Meta Graph API infrastructure, different endpoint (`/{PHONE_NUMBER_ID}/messages`)
- Webhook object type: `"whatsapp_business_account"`
- User IDs: Phone numbers in E.164 format (e.g., `+16505551234`)
- 24-hour customer service window (same concept as Messenger)
- Template messages required for proactive messaging outside window
- Same signature validation using `X-Hub-Signature-256` with App Secret

**Key Differences from Messenger**:

- Phone numbers are not scoped (same user = same ID everywhere) - PII considerations
- Template messages must be pre-approved by Meta
- Longer webhook retry window (7 days vs 1 hour)
- Business verification required (not App Review)

**Limitations**:

- Only works with WhatsApp Business Accounts (not personal WhatsApp)
- Phone number must be registered and verified
- Template approval required for outbound messaging outside service window

### Zalo Official Account

> **Detailed documentation**: [Zalo Platform Integration Guide](./zalo-platform-integration.md)

**Summary**:

- Separate webhook endpoint (`/webhooks/zalo`) due to different signature scheme
- Webhook object includes `event_name` field to identify event type
- User IDs: Zalo UID (scoped per OA, similar to PSID)
- **7-day messaging window** (vs 24 hours for Meta):
  - 0-48 hours: Free consultation messages
  - 48 hours - 7 days: Paid consultation messages
  - After 7 days: Must use ZBS template messages
- MAC signature validation using OA Secret Key
- Must respond within **2 seconds** (stricter than Meta's 5 seconds)

**Key Differences from Meta Platforms**:

- Longer messaging window (7 days vs 24 hours)
- Tiered pricing within window (free → paid)
- Different webhook signature scheme (MAC vs HMAC-SHA256)
- Stricter response time requirement (2s vs 5s)
- Separate template system (ZBS vs WhatsApp templates)

**Limitations**:

- Only works with Zalo Official Accounts (not personal accounts)
- OA must be verified for production access
- ZBS templates require separate approval
- Vietnam-focused platform (limited international reach)

### Gmail

> **Detailed documentation**: [Gmail Platform Integration Guide](./gmail-platform-integration.md)

**Summary**:

- Notifications via **Google Cloud Pub/Sub** (not direct webhooks like other platforms)
- Webhook receives only `{emailAddress, historyId}` - must call `history.list` API to get actual changes
- Webhook endpoint: `/webhooks/gmail` with JWT token verification
- User IDs: Email addresses (PII - requires encryption at rest)
- **No messaging window** - can reply anytime (unlike messaging platforms)
- Signature validation using JWT/OIDC tokens from Cloud Pub/Sub
- Watch expires every **7 days** - requires renewal scheduler

**Key Differences from Messaging Platforms**:

- Two-phase notification: Pub/Sub notification -> API call to fetch message content
- No messaging window restrictions (can reply anytime)
- Email addresses are PII (not platform-scoped IDs)
- Requires GCP infrastructure (Cloud Pub/Sub topic + subscription)
- Watch renewal required (vs permanent webhooks for other platforms)
- OAuth tokens expire in ~1 hour (requires proactive refresh like Zalo)
- Threading via RFC 2822 headers (`In-Reply-To`, `References`) + Gmail `threadId`

**Limitations**:

- Requires Google Cloud project with Pub/Sub
- OAuth verification required for restricted scopes (gmail.readonly, gmail.modify)
- Security assessment required for production (stores user email data)
- Notifications can be delayed (implement fallback polling)
- Max 1 notification/second per user (excess dropped)

### Internal Channel

> **Detailed documentation**: [Internal Channel Integration Guide](./internal-channel-integration.md)

**Summary**:

- First-party messaging channel fully controlled by us
- **No external webhooks** - messages flow through direct API and WebSocket
- Real-time delivery via **WebSocket API Gateway**
- User IDs: Session-based (generated internally)
- **No messaging window** - can send messages anytime
- **No OAuth or token management** - API key authentication
- Supports widget embedding and tenant API access

**Use Cases**:

- **AI Agent Testing**: Tenants test AI agents in dashboard before deploying to external channels
- **Embedded Widget**: Chat widget for tenant websites (future scope)
- **Custom Chat UI**: Tenants build custom interfaces using our API
- **Fallback Channel**: Works when external channels are unavailable

**Key Differences from External Platforms**:

- No external dependencies or rate limits (except self-imposed)
- Real-time WebSocket delivery (no webhook delays)
- API key authentication (no OAuth flows)
- Session-based conversations with configurable timeouts
- Full control over customization and behavior

**Limitations**:

- Widget SDK implementation is future scope
- Requires tenants to integrate API for custom UIs

---

## Message Flows

### Idempotency Handling

> **Critical for WhatsApp**: WhatsApp retries webhooks for up to **7 days** (vs 1 hour for Messenger). We must handle duplicate deliveries gracefully.

**Strategy**:

1. **Use `platformMsgId` as idempotency key**: `mid.xxx` (FB/IG) or `wamid.xxx` (WhatsApp)
2. **Check before processing**: Query DynamoDB for existing message with same `platformMsgId`
3. **Conditional write**: Use DynamoDB condition expression to prevent duplicates
4. **GSI for lookup**: Add GSI on `platformMsgId` for efficient duplicate detection

```typescript
// Idempotency check in message processor
async function processInboundMessage(
  payload: NormalizedMessage
): Promise<void> {
  const existing = await messageRepo.getByPlatformMsgId(payload.platformMsgId);
  if (existing) {
    console.log(`Duplicate message ${payload.platformMsgId}, skipping`);
    return; // Idempotent - already processed
  }

  // Process and store with condition
  await messageRepo.create(message, {
    condition: 'attribute_not_exists(platformMsgId)',
  });
}
```

### Inbound Message (Customer → Tenant)

```
1. Customer sends message on Facebook/Instagram/WhatsApp
                    │
                    ▼
2. Meta sends webhook POST to /webhooks/meta
   (same endpoint for all Meta platforms)
                    │
                    ▼
3. Webhook Lambda verifies X-Hub-Signature-256
                    │
                    ▼
4. Send message to SQS queue
                    │
                    ▼
5. Return 200 OK immediately (within 5 seconds)
                    │
                    ▼
6. Processor Lambda picks up from SQS:
   a. Detect platform from object type (page/instagram/whatsapp_business_account)
   b. Check idempotency (skip if platformMsgId already processed)
   c. Parse payload using platform-specific parser
   d. Lookup Channel by platformId (Page ID, IG Account ID, or Phone Number ID)
   e. Find or create Conversation
   f. Normalize message format
   g. Download attachments to S3 (if any)
   h. Store Message in DynamoDB (with condition to prevent duplicates)
   i. Update Conversation metadata (lastMessageAt, lastCustomerMessageAt, unreadCount)
                    │
                    ▼
7. Emit EventBridge event: conversations.message.new
                    │
                    ▼
8. (Future) Push to WebSocket for real-time UI update
```

### Outbound Message (Tenant → Customer)

```
1. User composes reply in main-ui
                    │
                    ▼
2. main-ui calls internal API: messages.send
                    │
                    ▼
3. Lambda validates request, loads Channel and Conversation
                    │
                    ▼
4. Check messaging window:
   ┌─────────────────────────────────────────────────────────┐
   │ Platform-specific window check:                        │
   │                                                         │
   │ META (FB/IG/WhatsApp):                                 │
   │   lastCustomerMessageAt within 24 hours?              │
   │   YES → Can send regular message                       │
   │   NO  → WhatsApp: use template                        │
   │         Messenger: use HUMAN_AGENT tag (7 days)       │
   │         Instagram: cannot send                         │
   │                                                         │
   │ ZALO:                                                  │
   │   lastCustomerMessageAt within 48 hours?              │
   │   YES → Can send consultation message (FREE)          │
   │                                                         │
   │   Within 48h-7 days?                                   │
   │   YES → Can send consultation message (PAID)          │
   │                                                         │
   │   After 7 days?                                        │
   │   → Must use ZBS template message                     │
   └─────────────────────────────────────────────────────────┘
                    │
                    ▼
5. Upload any attachments to S3, get URLs
                    │
                    ▼
6. Call platform Send API
   • FB/IG: POST /{PAGE_ID}/messages (Meta Graph API)
   • WhatsApp: POST /{PHONE_NUMBER_ID}/messages (Meta Graph API)
   • Zalo: POST /v3.0/oa/message/cs (Zalo OpenAPI)
                    │
                    ▼
7. On success: store Message with status=sent
                    │
                    ▼
8. Update Conversation metadata (lastMessageAt)
                    │
                    ▼
9. Return success to main-ui
                    │
                    ▼
10. (Later) Receive delivery/read webhooks, update status
```

---

## Service Structure

```
services/conversations/
├── functions/
│   ├── src/
│   │   ├── integrations/            # Platform integration module
│   │   │   │                        # (OAuth, tokens, webhook auth - see ADR)
│   │   │   │
│   │   │   ├── oauth/               # Platform-specific OAuth flows
│   │   │   │   ├── meta.ts          # FB/IG standard OAuth
│   │   │   │   ├── whatsapp.ts      # Embedded Signup (JS SDK callback)
│   │   │   │   ├── zalo.ts          # OAuth with PKCE
│   │   │   │   ├── gmail.ts         # Google OAuth with offline access
│   │   │   │   └── types.ts         # Shared OAuth types (state, tokens)
│   │   │   │
│   │   │   ├── token-management/    # Token lifecycle management
│   │   │   │   ├── refresh.ts       # Proactive refresh (Zalo 25h, Gmail 1h)
│   │   │   │   ├── health-check.ts  # Validate tokens, detect revocation
│   │   │   │   └── encryption.ts    # KMS encrypt/decrypt helpers
│   │   │   │
│   │   │   └── webhook-auth/        # Webhook signature verification
│   │   │       ├── meta-signature.ts  # HMAC-SHA256 for FB/IG/WhatsApp
│   │   │       ├── zalo-mac.ts        # MAC validation (OA Secret Key)
│   │   │       └── gmail-jwt.ts       # JWT/OIDC for Cloud Pub/Sub
│   │   │
│   │   ├── webhooks/                # Webhook entry points
│   │   │   ├── meta.ts              # Meta webhook (verify + enqueue)
│   │   │   │                        # Handles FB, IG, WhatsApp (same endpoint)
│   │   │   │                        # Uses integrations/webhook-auth/meta-signature
│   │   │   ├── zalo.ts              # Zalo webhook (different signature)
│   │   │   │                        # Uses integrations/webhook-auth/zalo-mac
│   │   │   └── gmail.ts             # Gmail webhook (Pub/Sub push)
│   │   │                            # Uses integrations/webhook-auth/gmail-jwt
│   │   │
│   │   ├── processors/
│   │   │   └── message-processor.ts # SQS consumer (process messages)
│   │   │
│   │   ├── internal-api/
│   │   │   ├── handler.ts           # Express + ORPC setup
│   │   │   ├── router.ts            # ORPC router
│   │   │   ├── channels.ts          # Channel procedures
│   │   │   ├── conversations.ts     # Conversation procedures
│   │   │   ├── messages.ts          # Message procedures
│   │   │   ├── templates.ts         # WhatsApp/Zalo template procedures
│   │   │   ├── internal-channels.ts # Internal channel CRUD
│   │   │   ├── internal-chat.ts     # Dashboard chat procedures
│   │   │   └── onboarding.ts        # Thin orchestration layer
│   │   │                            # Calls integrations/oauth/* per platform
│   │   │
│   │   ├── public-api/              # Public API for internal channel
│   │   │   ├── handler.ts           # Express + API key auth
│   │   │   ├── sessions.ts          # Session management endpoints
│   │   │   ├── messages.ts          # Message send/receive endpoints
│   │   │   └── middleware/
│   │   │       ├── api-key-auth.ts  # API key validation
│   │   │       ├── session-auth.ts  # Session token validation
│   │   │       └── rate-limit.ts    # Per-key rate limiting
│   │   │
│   │   ├── websocket/               # WebSocket API for internal channel
│   │   │   ├── connect.ts           # $connect handler
│   │   │   ├── disconnect.ts        # $disconnect handler
│   │   │   ├── message.ts           # $default handler (send/typing/read)
│   │   │   └── authorizer.ts        # Session token authorizer
│   │   │
│   │   ├── schedulers/              # Scheduled tasks (EventBridge)
│   │   │   ├── token-refresh.ts     # Proactive token refresh (Zalo + Gmail)
│   │   │   │                        # Delegates to integrations/token-management
│   │   │   ├── gmail-watch-renewal.ts # Renew Gmail watches (every 12h)
│   │   │   └── gmail-fallback-sync.ts # Fallback polling for reliability (every 10m)
│   │   │
│   │   ├── platforms/               # Message handling per platform
│   │   │   ├── types.ts             # Unified platform types
│   │   │   ├── adapter.ts           # Platform adapter interface
│   │   │   ├── registry.ts          # Adapter registry by platform
│   │   │   │
│   │   │   ├── messenger/           # Facebook Messenger + Instagram
│   │   │   │   ├── adapter.ts       # Implements PlatformAdapter
│   │   │   │   ├── webhook-parser.ts# Parse page/instagram payloads
│   │   │   │   ├── normalizer.ts    # Convert to unified format
│   │   │   │   └── sender.ts        # Send via /{PAGE_ID}/messages
│   │   │   │
│   │   │   ├── whatsapp/            # WhatsApp Business
│   │   │   │   ├── adapter.ts       # Implements PlatformAdapter
│   │   │   │   ├── webhook-parser.ts# Parse whatsapp_business_account payloads
│   │   │   │   ├── normalizer.ts    # Convert to unified format
│   │   │   │   ├── sender.ts        # Send via /{PHONE_NUMBER_ID}/messages
│   │   │   │   └── templates.ts     # Template message helpers
│   │   │   │
│   │   │   ├── zalo/                # Zalo Official Account
│   │   │   │   ├── adapter.ts       # Implements PlatformAdapter
│   │   │   │   ├── webhook-parser.ts# Parse Zalo event payloads
│   │   │   │   ├── normalizer.ts    # Convert to unified format
│   │   │   │   ├── sender.ts        # Send via /v3.0/oa/message/cs
│   │   │   │   └── templates.ts     # ZBS template message helpers
│   │   │   │
│   │   │   ├── gmail/               # Gmail
│   │   │   │   ├── adapter.ts       # Implements PlatformAdapter
│   │   │   │   ├── webhook-parser.ts# Parse Pub/Sub notification, call history.list
│   │   │   │   ├── normalizer.ts    # Convert email to unified format
│   │   │   │   ├── sender.ts        # Send via Gmail API (MIME encoding)
│   │   │   │   ├── watch.ts         # Watch management (setup, renew, stop)
│   │   │   │   └── history.ts       # History sync utilities
│   │   │   │
│   │   │   └── internal/            # Internal Channel
│   │   │       └── adapter.ts       # Implements PlatformAdapter (no webhooks)
│   │   │
│   │   └── lib/
│   │       ├── db/
│   │       │   ├── entities.ts      # ElectroDB entity definitions
│   │       │   ├── channels.ts      # Channel repository
│   │       │   ├── conversations.ts # Conversation repository
│   │       │   ├── messages.ts      # Message repository
│   │       │   ├── sessions.ts      # Session repository (internal channel)
│   │       │   ├── connections.ts   # WebSocket connection repository
│   │       │   └── api-keys.ts      # API key repository
│   │       ├── messaging-window.ts  # Platform-specific window logic
│   │       ├── websocket/
│   │       │   └── push.ts          # Push to WebSocket connections
│   │       └── events.ts            # EventBridge helpers
│   │
│   ├── test/
│   │   └── ...                      # Unit tests
│   ├── package.json
│   └── tsconfig.json
│
├── infra/
│   └── Main.ts                      # Stack definition
│
├── sst.config.ts
├── package.json
└── tsconfig.json
```

---

## DynamoDB Table Design

### Single Table Design

All entities stored in one table with composite keys:

| Entity       | PK                      | SK                      | GSI1PK                             | GSI1SK                     | GSI2PK | GSI2SK |
| ------------ | ----------------------- | ----------------------- | ---------------------------------- | -------------------------- | ------ | ------ |
| Channel      | `TENANT#<tenantId>`     | `CHANNEL#<channelId>`   | `PLATFORM#<platform>#<platformId>` | `CHANNEL#<channelId>`      | -      | -      |
| Conversation | `TENANT#<tenantId>`     | `CONV#<conversationId>` | `CHANNEL#<channelId>`              | `CONV#<lastMessageAt>`     | -      | -      |
| Message      | `CONV#<conversationId>` | `MSG#<messageId>`       | `PMSGID#<platformMsgId>`           | `MSG#<messageId>`          | -      | -      |
| Session      | `TENANT#<tenantId>`     | `SESSION#<sessionId>`   | `CHANNEL#<channelId>`              | `SESSION#<lastActivityAt>` | -      | -      |
| ApiKey       | `TENANT#<tenantId>`     | `APIKEY#<keyId>`        | `KEYHASH#<keyHash>`                | `APIKEY#<keyId>`           | -      | -      |

**Access Patterns**:

1. Get channels by tenant: `PK = TENANT#<tenantId>, SK begins_with CHANNEL#`
2. Get channel by platform ID: `GSI1PK = PLATFORM#<platform>#<platformId>`
3. Get conversations by tenant (sorted by recent): `PK = TENANT#<tenantId>, SK begins_with CONV#` (needs GSI)
4. Get conversations by channel: `GSI1PK = CHANNEL#<channelId>` (sorted by lastMessageAt)
5. Get messages by conversation: `PK = CONV#<conversationId>, SK begins_with MSG#`
6. **Get message by platform ID (idempotency)**: `GSI1PK = PMSGID#<platformMsgId>`
7. Get sessions by channel: `GSI1PK = CHANNEL#<channelId>` (sorted by lastActivityAt)
8. **Get API key by hash (authentication)**: `GSI1PK = KEYHASH#<keyHash>`

### WebSocket Connections Table (Separate)

For real-time messaging in internal channel:

| PK                    | SK                    | Attributes                              | TTL     |
| --------------------- | --------------------- | --------------------------------------- | ------- |
| `SESSION#<sessionId>` | `CONN#<connectionId>` | `connectedAt`, `lastPingAt`, `endpoint` | 2 hours |

> **Note**: Separate table for WebSocket connections due to high write volume and TTL requirements.

### OAuth State Storage (Separate Table)

Temporary storage for OAuth flow state (CSRF tokens, PKCE code verifiers).

| PK              | Attributes                              | TTL        |
| --------------- | --------------------------------------- | ---------- |
| `STATE#<state>` | `tenantId`, `codeVerifier`, `createdAt` | 10 minutes |

**Storage Options** (pending security review):

| Option      | Storage           | Platforms   | Notes                             |
| ----------- | ----------------- | ----------- | --------------------------------- |
| Server-side | DynamoDB with TTL | All         | Server controls flow, extra table |
| Client-side | main-ui session   | Zalo (PKCE) | Simpler, requires security review |

> **Note**: Uses DynamoDB TTL for automatic cleanup. For Zalo PKCE, client-side session storage may be acceptable (pending security review) since the OAuth flow is initiated and completed by the same browser session.

---

## Open Questions

> To be resolved during iteration

### Resolved

- [x] **OAuth flow**: Self-service in main-ui (platform-specific flows - see platform docs)
- [x] **WhatsApp onboarding**: Embedded Signup flow (see [WhatsApp Integration Guide](./whatsapp-platform-integration.md))

### Data Model Decisions

- [ ] **Conversation ID**: Use Meta's thread ID or generate our own ULID?
- [ ] **Message retention**: Any TTL requirements?
- [ ] **Attachment handling**: Store in S3 or just reference external CDN URLs?
- [ ] **Phone number encryption**: Should WhatsApp participant phone numbers be encrypted at rest (beyond standard DynamoDB encryption)?

### Integration Decisions

- [ ] **Real-time updates**: WebSocket push or polling from main-ui?
- [ ] **Rate limiting**: How to handle Meta's API rate limits internally?

### Token Lifecycle Decisions

- [ ] **Token revocation notifications**: How to notify tenant admins when a channel requires re-authorization? (Future implementation)
- [ ] **Proactive health checks**: Should we verify Meta tokens periodically? (they can be silently revoked)
- [ ] **Zalo refresh retry policy**: How many retry attempts before marking channel as `requires_reauth`?

### WhatsApp-Specific Decisions

- [ ] **Template management**: Build template CRUD into Conversations Service or separate service?
- [ ] **Template syncing**: Sync templates from Meta API or let tenants manage externally?
- [ ] **Quality rating monitoring**: Should we track phone number quality ratings?

### Gmail-Specific Decisions

- [ ] **GCP project ownership**: Use our GCP project or require tenants to provide their own Pub/Sub topic?
- [ ] **Pub/Sub topic strategy**: Single topic for all tenants or per-tenant topics?
- [ ] **OAuth scopes**: Request all scopes upfront (`gmail.readonly`, `gmail.send`, `gmail.modify`) or incrementally?
- [ ] **Email thread handling**: Use Gmail `threadId` directly or generate our own conversation ID?
- [ ] **Email address encryption**: Should participant email addresses be encrypted at rest (PII)?
- [ ] **Initial sync behavior**: Sync existing emails on connection or only new emails after connection?
- [ ] **Label filtering**: Allow tenants to filter which labels to watch (INBOX only vs all)?
- [ ] **HTML rendering**: How to safely render HTML email content in main-ui (sanitization)?
- [ ] **Fallback polling frequency**: How often should fallback sync run (currently proposed 10 minutes)?

---

## Future Extensibility

### Platform Adapter Pattern

```typescript
// platforms/types.ts
type Platform =
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'zalo'
  | 'gmail'
  | 'internal';

interface NormalizedMessage {
  platformMsgId: string;
  direction: 'inbound' | 'outbound';
  senderId: string;
  content: string;
  contentType: ContentType;
  attachments?: Attachment[];
  template?: TemplateDetails; // WhatsApp or Zalo ZBS
  interactive?: InteractiveDetails; // WhatsApp or Zalo buttons
  // Gmail-specific
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  htmlBody?: string;
  inReplyTo?: string;
  references?: string[];
  timestamp: Date;
}

interface OutboundMessage {
  recipientId: string;
  content: string;
  contentType: ContentType;
  attachments?: Attachment[];
  template?: TemplateDetails; // Required for WhatsApp/Zalo outside window
  // Gmail-specific
  subject?: string;
  htmlBody?: string;
  cc?: string[];
  bcc?: string[];
  inReplyTo?: string; // For proper threading
  threadId?: string; // Gmail thread ID
}

interface SendResult {
  success: boolean;
  platformMsgId?: string;
  error?: string;
  requiresPayment?: boolean; // Zalo: true if in 48h-7d window
}

// platforms/adapter.ts
interface PlatformAdapter {
  platform: Platform;

  // Webhook handling
  parseWebhook(payload: unknown): NormalizedMessage[];
  verifyWebhook(rawBody: Buffer, signature: string, headers?: Headers): boolean;

  // Sending messages
  sendMessage(channel: Channel, message: OutboundMessage): Promise<SendResult>;

  // Messaging window - platform-specific
  canSendRegularMessage(conversation: Conversation): boolean;
  getMessagingWindowHours(): number; // 24 for Meta, 168 for Zalo, Infinity for Gmail
  getFreeWindowHours(): number; // 24 for Meta, 48 for Zalo, Infinity for Gmail

  // Platform-specific capabilities
  supportsTemplates(): boolean; // true for WhatsApp/Zalo
  supportsMessageTags(): boolean; // true for Messenger only
  supportsHtmlContent(): boolean; // true for Gmail only
  getWebhookResponseTimeoutMs(): number; // 5000 for Meta, 2000 for Zalo, 10000 for Gmail (Pub/Sub)

  // Gmail-specific (optional methods)
  renewWatch?(
    channel: Channel
  ): Promise<{ historyId: string; expiration: number }>;
  fetchHistoryChanges?(
    channel: Channel,
    startHistoryId: string
  ): Promise<NormalizedMessage[]>;
}

// platforms/registry.ts
const adapters: Record<Platform, PlatformAdapter> = {
  facebook: messengerAdapter,
  instagram: messengerAdapter, // Shared adapter, different platform value
  whatsapp: whatsappAdapter,
  zalo: zaloAdapter,
  gmail: gmailAdapter,
  internal: internalAdapter,
};

function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Unsupported platform: ${platform}`);
  return adapter;
}
```

### Potential Future Channels

| Channel      | Integration Type | Complexity | Notes                      |
| ------------ | ---------------- | ---------- | -------------------------- |
| Twitter/X DM | Twitter API v2   | Medium     | Rate limits                |
| Zendesk      | Webhooks + API   | Medium     | Enterprise use case        |
| Intercom     | Webhooks + API   | Medium     | Enterprise use case        |
| Live Chat    | Custom WebSocket | High       | Real-time requirements     |
| SMS          | Twilio/SNS       | Low        | Simple, expensive at scale |
| Telegram     | Bot API          | Low        | No messaging window        |

> **Note**: Internal Channel already provides a custom chat solution. "Live Chat" above refers to integrating with third-party live chat platforms.

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Service scaffolding (sst.config, infra)
- [ ] DynamoDB table with GSIs for idempotency
- [ ] S3 bucket for attachments
- [ ] Public webhook API (Meta verification + signature validation)
- [ ] SQS queue for webhook buffering
- [ ] Message processor Lambda with idempotency handling
- [ ] Platform adapter pattern implementation
- [ ] Basic message storage (all platforms)
- [ ] Internal API contract definition (ORPC)

### Phase 2: External Platform Integration

- [ ] Platform-specific onboarding flows:
  - [ ] Meta (FB/IG): Standard OAuth redirect
  - [ ] WhatsApp: Embedded Signup (JS SDK)
  - [ ] Zalo: OAuth with PKCE
- [ ] OAuth state storage (DynamoDB with TTL)
- [ ] Token refresh scheduler (Zalo - EventBridge + Lambda)
- [ ] Outbound message sending (all platforms)
- [ ] Messaging window enforcement
- [ ] Template message support (WhatsApp/Zalo)
- [ ] Attachment handling (download to S3)
- [ ] Delivery/read receipt handling

### Phase 3: Internal Channel

- [ ] Internal channel adapter (no webhooks)
- [ ] Session entity and repository
- [ ] API key entity and repository
- [ ] Internal API procedures for channel management
- [ ] Internal API procedures for dashboard chat (AI agent testing)
- [ ] Public REST API for widget/tenant API
- [ ] API key authentication middleware
- [ ] Session token generation and validation
- [ ] WebSocket API Gateway setup
- [ ] WebSocket connect/disconnect/message handlers
- [ ] Real-time message push to connections

### Phase 4: UI Integration

- [ ] Inbox list view in main-ui
- [ ] Conversation detail view
- [ ] Reply composer (with messaging window status indicator)
- [ ] Channel connection settings
- [ ] WhatsApp template selector (for outside-window messages)
- [ ] Internal channel dashboard chat interface

### Phase 5: Enhancements

- [ ] Conversation assignment/routing
- [ ] Canned responses
- [ ] WhatsApp template management
- [ ] Basic analytics
- [ ] Widget JavaScript SDK (future scope)

---

## Related Documentation

- [Meta Platform Integration Guide](./meta-platform-integration.md) - Detailed Facebook/Instagram API documentation
- [WhatsApp Platform Integration Guide](./whatsapp-platform-integration.md) - Detailed WhatsApp Business API documentation
- [Zalo Platform Integration Guide](./zalo-platform-integration.md) - Detailed Zalo Official Account API documentation
- [Gmail Platform Integration Guide](./gmail-platform-integration.md) - Detailed Gmail API and Cloud Pub/Sub documentation
- [Internal Channel Integration Guide](./internal-channel-integration.md) - Internal messaging channel for widget/API/dashboard
- [IAC Patterns](../docs/iac-patterns.md) - Infrastructure code patterns
- [Internal API](../docs/internal-api.md) - ORPC contract patterns
