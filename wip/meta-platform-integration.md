# Meta Platform Integration Guide

> **Status**: Reference Documentation
> **Last Updated**: 2026-01-10
> **Platforms**: Facebook Messenger, Instagram DM

## Overview

This document details the technical integration with Meta's Messenger Platform for handling Facebook Messenger and Instagram Direct Messages.

**Key Insight**: Facebook Messenger and Instagram Messaging share the same underlying platform (Meta Messenger Platform) but have slightly different webhook payloads and API nuances.

---

## Platform Limitations

### Supported Account Types

| Account Type                      | Supported | Notes                              |
| --------------------------------- | --------- | ---------------------------------- |
| Facebook Page                     | Yes       | Business Pages only                |
| Personal Facebook Account         | **No**    | Cannot use Messenger Platform APIs |
| Instagram Professional (Business) | Yes       | Must be linked to a Facebook Page  |
| Instagram Professional (Creator)  | Yes       | Must be linked to a Facebook Page  |
| Personal Instagram Account        | **No**    | Must convert to Professional       |

### Why Personal Accounts Are Not Supported

1. **Privacy by design**: Meta restricts API access to business accounts to protect personal user privacy
2. **PSID requirement**: Users only get a Page-Scoped ID (PSID) when they message a Page
3. **No webhook subscriptions**: Personal accounts cannot subscribe to webhook events
4. **No Send API access**: Only Pages with `pages_messaging` permission can use the Send API

---

## App Configuration

### Meta App Setup

We need **one Meta App** (per environment) that all tenants will connect to:

| Configuration | Description                                           |
| ------------- | ----------------------------------------------------- |
| App ID        | Public identifier for OAuth flows                     |
| App Secret    | Used to verify webhook signatures                     |
| Webhook URL   | Single endpoint: `https://api.{domain}/webhooks/meta` |
| Verify Token  | Arbitrary string we define for webhook verification   |

### Required Permissions

> **Reference**: [Messenger Platform Overview - Permissions](https://developers.facebook.com/docs/messenger-platform/overview#permissions)

#### Facebook Messenger (Pages)

| Permission              | Purpose                        |
| ----------------------- | ------------------------------ |
| `pages_show_list`       | List Pages user manages        |
| `pages_manage_metadata` | Subscribe Page to webhooks     |
| `pages_messaging`       | Send/receive messages          |
| `pages_read_engagement` | Read Page engagement data      |
| `business_management`   | Dependency for pages_messaging |

#### Instagram Messaging (additional)

| Permission                  | Purpose                       |
| --------------------------- | ----------------------------- |
| `instagram_basic`           | Access Instagram account info |
| `instagram_manage_messages` | Send/receive Instagram DMs    |

### Access Levels

| Level           | Description                                              |
| --------------- | -------------------------------------------------------- |
| Standard Access | Can only interact with people who have a role on the app |
| Advanced Access | Can interact with any user (requires App Review)         |

> **Note**: For production use with real customers, Advanced Access is required and must go through Meta's App Review process.

---

## User Identifiers

### Page-Scoped ID (PSID) - Facebook

- Assigned when a person first messages a Facebook Page
- Unique per Page (same person = different PSID on different Pages)
- Used for all Messenger API calls
- Format: Numeric string (e.g., `"1234567890123456"`)

### Instagram-Scoped ID (IGSID) - Instagram

- Assigned when a person first messages an Instagram Professional account
- Unique per Instagram account
- Used for Instagram Messaging API calls
- Format: Numeric string

> **Important**: App-scoped IDs from Facebook Login do NOT work with Messenger Platform.

---

## Webhooks

> **Reference**: [Webhooks for Messenger Platform](https://developers.facebook.com/docs/messenger-platform/webhooks)

### Webhook Fields to Subscribe

| Field                 | Description                                       | FB  | IG  |
| --------------------- | ------------------------------------------------- | --- | --- |
| `messages`            | New message received                              | Yes | Yes |
| `messaging_postbacks` | Button/menu click                                 | Yes | Yes |
| `message_deliveries`  | Message delivered to customer                     | Yes | No  |
| `message_reads`       | Message read by customer (FB)                     | Yes | No  |
| `messaging_seen`      | Message read by customer (IG)                     | No  | Yes |
| `message_echoes`      | Echo of sent messages (FB only, IG uses messages) | Yes | No  |
| `message_reactions`   | Customer reacted to message                       | Yes | Yes |
| `messaging_referrals` | User clicked m.me/ig.me link                      | Yes | Yes |
| `messaging_handovers` | Handover protocol events                          | Yes | Yes |

### Webhook Verification (GET)

When configuring webhooks in App Dashboard, Meta sends a verification request:

```
GET /webhooks/meta?hub.mode=subscribe
                  &hub.verify_token=<our_verify_token>
                  &hub.challenge=<random_challenge>
```

**Response**: Return `hub.challenge` value if `hub.verify_token` matches our configured token.

```typescript
// Example verification handler
function handleVerification(req: Request): Response {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.verifyToken) {
    console.log('WEBHOOK_VERIFIED');
    return new Response(challenge, { status: 200 });
  } else {
    return new Response('Forbidden', { status: 403 });
  }
}
```

### Webhook Event Notification (POST)

> **Reference**: [Webhook Event Reference](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events)

**Requirements**:

- Must return `200 OK` within **5 seconds**
- Must validate signature before processing

#### Signature Validation

All webhook POSTs include `X-Hub-Signature-256` header:

```
X-Hub-Signature-256: sha256=<signature>
```

**Validation**:

```typescript
import crypto from 'crypto';

function verifySignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody) // Must use raw body, not parsed JSON
    .digest('hex');

  return signature === `sha256=${expectedHash}`;
}
```

> **Important**: Generate signature using escaped unicode version of payload with lowercase hex digits.

### Webhook Payload Structure

#### Facebook Messenger

```json
{
  "object": "page",
  "entry": [
    {
      "id": "<PAGE_ID>",
      "time": 1458692752478,
      "messaging": [
        {
          "sender": { "id": "<PSID>" },
          "recipient": { "id": "<PAGE_ID>" },
          "timestamp": 1458692752478,
          "message": {
            "mid": "mid.1457764197618:41d102a3e1ae206a38",
            "text": "Hello, world!",
            "attachments": [
              {
                "type": "image",
                "payload": { "url": "https://..." }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Instagram Messaging

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "<IG_USER_ID>",
      "time": 1458692752478,
      "messaging": [
        {
          "sender": { "id": "<IGSID>" },
          "recipient": { "id": "<IG_USER_ID>" },
          "timestamp": 1458692752478,
          "message": {
            "mid": "mid.1457764197618:41d102a3e1ae206a38",
            "text": "Hey there!"
          }
        }
      ]
    }
  ]
}
```

**Key Difference**: `object` field is `"page"` for Facebook, `"instagram"` for Instagram.

### Webhook Retry Behavior

| Timeline              | Action                                     |
| --------------------- | ------------------------------------------ |
| Immediate             | Meta retries failed webhook deliveries     |
| After 15 min failures | Developer alert sent                       |
| After 1 hour failures | App unsubscribed from webhooks, alert sent |

> **Important**: Use webhook `timestamp` field to ensure chronological message ordering, as retried messages may arrive out of order.

---

## Send API

> **Reference**: [Send API Documentation](https://developers.facebook.com/docs/messenger-platform/send-messages)

### Standard Messaging Window (24-Hour Rule)

The **24-hour standard messaging window** allows responses after a user initiates contact.

**Actions that open the window**:

- Person sends a message to Page/Instagram account
- Person clicks call-to-action button (e.g., Get Started)
- Person clicks Click-to-Messenger ad
- Person sends message via plugin
- Person clicks m.me or ig.me link
- Person reacts to a message
- Person comments on Page/Instagram post

### Sending a Text Message

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PAGE-ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": { "id": "<PSID>" },
    "messaging_type": "RESPONSE",
    "message": { "text": "Hello, world!" }
  }' \
  -G --data-urlencode "access_token={PAGE_ACCESS_TOKEN}"
```

**Response**:

```json
{
  "recipient_id": "PAGE-SCOPED-ID",
  "message_id": "AG5Hz2U..."
}
```

### Messaging Types

| Type          | Use Case                         | Window Required |
| ------------- | -------------------------------- | --------------- |
| `RESPONSE`    | Reply to user message            | Yes (24h)       |
| `UPDATE`      | Proactive non-promotional update | Yes (24h)       |
| `MESSAGE_TAG` | Specific allowed use cases       | No              |

### Message Tags (Outside 24h Window)

| Tag           | Allowed Use Case                                       |
| ------------- | ------------------------------------------------------ |
| `HUMAN_AGENT` | Human agent response (7-day window after user message) |

### Sending Media Attachments

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PAGE-ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": { "id": "<PSID>" },
    "message": {
      "attachment": {
        "type": "image",
        "payload": {
          "url": "https://example.com/image.jpg",
          "is_reusable": true
        }
      }
    }
  }' \
  -G --data-urlencode "access_token={PAGE_ACCESS_TOKEN}"
```

**Supported attachment types**: `image`, `audio`, `video`, `file`

---

## Rate Limits

> **Reference**: [Rate Limiting](https://developers.facebook.com/docs/messenger-platform/overview#rate-limiting)

### Messenger API (Facebook)

| Endpoint          | Limit                     |
| ----------------- | ------------------------- |
| Send API (text)   | 300 calls/second per Page |
| Send API (media)  | 10 calls/second per Page  |
| Conversations API | 2 calls/second per Page   |
| Private Replies   | 750 calls/hour per Page   |

### Instagram Messaging API

| Endpoint          | Limit                           |
| ----------------- | ------------------------------- |
| Send API (text)   | 300 calls/second per IG account |
| Send API (media)  | 10 calls/second per IG account  |
| Conversations API | 2 calls/second per IG account   |
| Private Replies   | 750 calls/hour per IG account   |

### Overall API Limit

```
Calls within 24 hours = 200 * Number of Engaged Users
```

Where "Engaged Users" is the number of people the business can message via Messenger.

### High-Volume Limitations

| Platform  | Threshold                    | Effect                                   |
| --------- | ---------------------------- | ---------------------------------------- |
| Messenger | >40 messages/second          | New messages won't display in Page Inbox |
| Instagram | >72,000 messages (aggregate) | Inbox becomes limited until volume drops |

---

## OAuth Flow & Credentials Management

> **Reference**: [Manually Build a Login Flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)

### Token Types & Lifespans

| Token Type             | Lifespan            | Use Case                                                 |
| ---------------------- | ------------------- | -------------------------------------------------------- |
| Short-lived User Token | ~1-2 hours          | Initial OAuth callback, temporary operations             |
| Long-lived User Token  | ~60 days            | Generate Page tokens, refresh tokens before expiry       |
| **Page Access Token**  | **Never expires**\* | **Primary token for Messenger API calls**                |
| System User Token      | Never expires       | Enterprise/automated integrations (WhatsApp recommended) |
| App Access Token       | Does not expire     | Server-to-server calls (App ID + Secret)                 |

> \***Important**: Long-lived Page Access Tokens generated from a long-lived User Access Token **do not expire**. They are only invalidated by specific user actions (see Token Invalidation section).

### Complete OAuth Flow

#### Step 1: Generate Authorization URL

```typescript
function generateAuthUrl(tenantId: string): string {
  const state = `${tenantId}:${crypto.randomUUID()}`; // CSRF protection

  const params = new URLSearchParams({
    client_id: config.metaAppId,
    redirect_uri: config.oauthCallbackUrl,
    scope: [
      // Facebook Messenger permissions
      'pages_show_list',
      'pages_manage_metadata',
      'pages_messaging',
      'pages_read_engagement',
      'business_management',
      // Instagram permissions (if needed)
      'instagram_basic',
      'instagram_manage_messages',
    ].join(','),
    state,
    response_type: 'code', // Server-side flow
  });

  // Store state in session/cache for verification
  await cache.set(`oauth:state:${state}`, tenantId, { ttl: 600 }); // 10 min

  return `https://www.facebook.com/v24.0/dialog/oauth?${params}`;
}
```

**Authorization URL format**:

```
https://www.facebook.com/v24.0/dialog/oauth?
  client_id={APP_ID}
  &redirect_uri={CALLBACK_URL}
  &scope=pages_show_list,pages_manage_metadata,pages_messaging,
         pages_read_engagement,business_management,
         instagram_basic,instagram_manage_messages
  &state={TENANT_ID}:{NONCE}
  &response_type=code
```

#### Step 2: Handle OAuth Callback

```
GET /oauth/meta/callback?code={CODE}&state={STATE}
```

**Callback Handler**:

```typescript
async function handleOAuthCallback(code: string, state: string) {
  // 1. Verify state parameter (CSRF protection)
  const tenantId = await cache.get(`oauth:state:${state}`);
  if (!tenantId) throw new Error('Invalid or expired state');
  await cache.delete(`oauth:state:${state}`);

  // 2. Exchange code for short-lived User Access Token
  const shortLivedToken = await exchangeCodeForToken(code);

  // 3. Exchange for long-lived User Access Token
  const longLivedUserToken = await getLongLivedUserToken(shortLivedToken);

  // 4. Get list of Pages user manages (with Page tokens)
  const pages = await getPagesList(longLivedUserToken);

  // 5. For each Page, get long-lived Page token and subscribe to webhooks
  for (const page of pages) {
    const pageToken = page.access_token; // Already long-lived when from long-lived user token

    // 6. Subscribe Page to webhooks
    await subscribePageToWebhooks(page.id, pageToken);

    // 7. Check for connected Instagram account
    const igAccount = await getConnectedInstagramAccount(page.id, pageToken);

    // 8. Store Channel records
    await createChannel({
      tenantId,
      platform: 'facebook',
      platformId: page.id,
      name: page.name,
      accessToken: encrypt(pageToken), // KMS encrypted
      status: 'active',
    });

    if (igAccount) {
      await createChannel({
        tenantId,
        platform: 'instagram',
        platformId: igAccount.id,
        name: igAccount.username,
        accessToken: encrypt(pageToken), // Same Page token works for IG
        linkedPageId: page.id,
        status: 'active',
      });
    }
  }
}
```

#### Step 3: Exchange Code for User Access Token

```bash
GET https://graph.facebook.com/v24.0/oauth/access_token?
  client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &client_secret={APP_SECRET}
  &code={CODE}
```

**Response**:

```json
{
  "access_token": "{short-lived-user-access-token}",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

**TypeScript Implementation**:

```typescript
async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: config.metaAppId,
        redirect_uri: config.oauthCallbackUrl,
        client_secret: config.metaAppSecret,
        code,
      })
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.access_token;
}
```

#### Step 4: Exchange for Long-Lived User Token

```bash
GET https://graph.facebook.com/v24.0/oauth/access_token?
  grant_type=fb_exchange_token
  &client_id={APP_ID}
  &client_secret={APP_SECRET}
  &fb_exchange_token={SHORT_LIVED_TOKEN}
```

**Response**:

```json
{
  "access_token": "{long-lived-user-access-token}",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

**TypeScript Implementation**:

```typescript
async function getLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        fb_exchange_token: shortLivedToken,
      })
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.access_token;
}
```

#### Step 5: Get Pages and Page Access Tokens

```bash
GET https://graph.facebook.com/v24.0/me/accounts?
  access_token={LONG_LIVED_USER_TOKEN}
```

**Response**:

```json
{
  "data": [
    {
      "access_token": "{page-access-token}",
      "category": "Business",
      "name": "My Business Page",
      "id": "123456789",
      "tasks": ["MODERATE", "ADVERTISE", "ANALYZE", "CREATE_CONTENT", "MANAGE"]
    }
  ]
}
```

> **Important**: Page tokens returned when using a long-lived user token are **automatically long-lived** and **never expire**.

**TypeScript Implementation**:

```typescript
interface PageInfo {
  id: string;
  name: string;
  access_token: string;
  tasks: string[];
}

async function getPagesList(userToken: string): Promise<PageInfo[]> {
  const response = await fetch(
    `https://graph.facebook.com/v24.0/me/accounts?` +
      new URLSearchParams({
        access_token: userToken,
        fields: 'id,name,access_token,tasks',
      })
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.data;
}
```

#### Step 6: Subscribe Page to Webhooks

```bash
POST https://graph.facebook.com/{PAGE_ID}/subscribed_apps?
  subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads,message_reactions,messaging_referrals,messaging_handovers
  &access_token={PAGE_ACCESS_TOKEN}
```

**Response**:

```json
{ "success": true }
```

**TypeScript Implementation**:

```typescript
async function subscribePageToWebhooks(
  pageId: string,
  pageToken: string
): Promise<void> {
  const fields = [
    'messages',
    'messaging_postbacks',
    'message_deliveries',
    'message_reads',
    'message_reactions',
    'messaging_referrals',
    'messaging_handovers',
  ].join(',');

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: fields,
        access_token: pageToken,
      }),
    }
  );

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to subscribe Page ${pageId} to webhooks`);
  }
}
```

**Verify Subscription**:

```bash
GET https://graph.facebook.com/{PAGE_ID}/subscribed_apps?
  access_token={PAGE_ACCESS_TOKEN}
```

#### Step 7: Get Connected Instagram Account (Optional)

```bash
GET https://graph.facebook.com/v24.0/{PAGE_ID}?
  fields=instagram_business_account
  &access_token={PAGE_ACCESS_TOKEN}
```

**Response**:

```json
{
  "instagram_business_account": {
    "id": "17841400000000000"
  },
  "id": "123456789"
}
```

---

## Token Lifecycle & Monitoring

### Token Invalidation Scenarios

Long-lived Page Access Tokens are invalidated when:

| Scenario                    | Effect                        | Detection                       |
| --------------------------- | ----------------------------- | ------------------------------- |
| User changes password       | Token invalidated             | API error code 190, subcode 460 |
| User logs out of app        | Token invalidated             | API error code 190, subcode 460 |
| User revokes app permission | Token invalidated             | API error code 190, subcode 458 |
| User removes Page role      | Token loses Page access       | API error on Page operations    |
| App is restricted/disabled  | All tokens invalidated        | API error code 190              |
| 60 days of inactivity       | User token expires (not Page) | Only affects user tokens        |

> **Key Insight**: Page tokens themselves don't expire based on time, but they become invalid if the underlying user's authorization is revoked or the user loses admin access to the Page.

### Token Debugging API

Use the debug endpoint to check token validity:

```bash
GET https://graph.facebook.com/debug_token?
  input_token={TOKEN_TO_CHECK}
  &access_token={APP_TOKEN}
```

**Response**:

```json
{
  "data": {
    "app_id": "138483919580948",
    "type": "PAGE",
    "application": "My App",
    "expires_at": 0,
    "is_valid": true,
    "issued_at": 1347235328,
    "scopes": ["pages_messaging", "pages_manage_metadata"],
    "granular_scopes": [
      {
        "scope": "pages_messaging",
        "target_ids": ["123456789"]
      }
    ],
    "user_id": "1207059",
    "page_id": "123456789"
  }
}
```

> **Note**: `expires_at: 0` indicates a never-expiring token.

### Error Handling Strategy

```typescript
interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

async function handleTokenError(
  channelId: string,
  error: MetaApiError
): Promise<void> {
  const { code, error_subcode } = error.error;

  // Token is invalid - mark channel as disconnected
  if (code === 190) {
    let reason: string;

    switch (error_subcode) {
      case 458: // User de-authorized app
        reason = 'User revoked app authorization';
        break;
      case 460: // User logged out / password changed
        reason = 'User session invalidated (logout or password change)';
        break;
      case 463: // Token expired (shouldn't happen for Page tokens)
        reason = 'Token expired';
        break;
      default:
        reason = 'Token invalid';
    }

    await markChannelDisconnected(channelId, reason);
    await notifyTenantReconnectRequired(channelId, reason);
  }
}

async function markChannelDisconnected(
  channelId: string,
  reason: string
): Promise<void> {
  await db.channel.update({
    where: { channelId },
    data: {
      status: 'disconnected',
      disconnectedAt: new Date(),
      disconnectedReason: reason,
    },
  });

  // Emit event for real-time notification
  await eventBridge.putEvent({
    source: 'conversations',
    detailType: 'channel.disconnected',
    detail: { channelId, reason },
  });
}
```

### Error Response Examples

**Expired/Invalid Token (code 190)**:

```json
{
  "error": {
    "message": "Error validating access token: Session has expired...",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "fbtrace_id": "H2il2t5bn4e"
  }
}
```

**User Logged Out (code 190, subcode 460)**:

```json
{
  "error": {
    "message": "Error validating access token: The session is invalid because the user logged out.",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 460,
    "fbtrace_id": "H2il2t5bn4e"
  }
}
```

**User De-authorized App (code 190, subcode 458)**:

```json
{
  "error": {
    "message": "Error validating access token: User {user-id} has not authorized application {app-id}.",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 458,
    "fbtrace_id": "H2il2t5bn4e"
  }
}
```

---

## Credentials Storage

### What to Store per Channel

| Field                | Description                                | Encrypted |
| -------------------- | ------------------------------------------ | --------- |
| `platformId`         | Page ID or Instagram Account ID            | No        |
| `accessToken`        | Long-lived Page Access Token               | **Yes**   |
| `tokenStatus`        | `valid` \| `invalid` \| `unknown`          | No        |
| `connectedBy`        | User ID who connected the channel          | No        |
| `connectedAt`        | Timestamp of OAuth completion              | No        |
| `lastVerifiedAt`     | Last successful token validation           | No        |
| `disconnectedAt`     | When token was invalidated (if applicable) | No        |
| `disconnectedReason` | Why token was invalidated                  | No        |

### Token Encryption (KMS)

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({});
const keyId = process.env.TOKEN_ENCRYPTION_KEY_ID;

async function encryptToken(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext),
  });
  const response = await kms.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

async function decryptToken(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  });
  const response = await kms.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}
```

### Proactive Token Health Checks (Optional)

```typescript
// Scheduled Lambda to verify token health
async function checkTokenHealth(): Promise<void> {
  const channels = await db.channel.findMany({
    where: {
      platform: { in: ['facebook', 'instagram'] },
      status: 'active',
    },
  });

  for (const channel of channels) {
    try {
      const token = await decryptToken(channel.accessToken);
      const isValid = await verifyToken(token);

      if (!isValid) {
        await markChannelDisconnected(
          channel.channelId,
          'Token verification failed'
        );
      } else {
        await db.channel.update({
          where: { channelId: channel.channelId },
          data: { lastVerifiedAt: new Date() },
        });
      }
    } catch (error) {
      console.error(
        `Token check failed for channel ${channel.channelId}:`,
        error
      );
    }
  }
}

async function verifyToken(token: string): Promise<boolean> {
  const response = await fetch(
    `https://graph.facebook.com/debug_token?` +
      new URLSearchParams({
        input_token: token,
        access_token: `${config.metaAppId}|${config.metaAppSecret}`,
      })
  );

  const data = await response.json();
  return data.data?.is_valid === true;
}
```

---

## Platform Differences Summary

| Feature           | Facebook Messenger   | Instagram DM              |
| ----------------- | -------------------- | ------------------------- |
| Object type       | `"page"`             | `"instagram"`             |
| User ID type      | PSID                 | IGSID                     |
| Delivery receipts | `message_deliveries` | Not supported             |
| Read receipts     | `message_reads`      | `messaging_seen`          |
| Echo events       | `message_echoes`     | Via `messages` field      |
| Page requirement  | Facebook Page        | FB Page + IG Professional |

---

## References

### Official Documentation

- [Messenger Platform Overview](https://developers.facebook.com/docs/messenger-platform/overview) - Main entry point, permissions, rate limits
- [Messenger Platform Webhooks](https://developers.facebook.com/docs/messenger-platform/webhooks) - Webhook setup, verification, event handling
- [Send API](https://developers.facebook.com/docs/messenger-platform/send-messages) - Sending messages, attachments, templates
- [Instagram Messaging](https://developers.facebook.com/docs/messenger-platform/instagram) - Instagram-specific features and limitations
- [Webhook Event Reference](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events) - All webhook event payloads

### Sample Code

- [Meta Messenger Platform Samples (GitHub)](https://github.com/fbsamples/messenger-platform-samples) - Official sample apps

### Tools

- [Graph API Explorer](https://developers.facebook.com/tools/explorer) - Test API calls
- [Meta App Dashboard](https://developers.facebook.com/apps) - App configuration

### Policies

- [Messenger Platform Policy](https://developers.facebook.com/docs/messenger-platform/policy) - Usage guidelines and restrictions
- [App Review](https://developers.facebook.com/docs/app-review) - Process for getting Advanced Access
