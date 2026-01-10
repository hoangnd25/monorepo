# WhatsApp Platform Integration Guide

> **Status**: Reference Documentation
> **Last Updated**: 2026-01-10
> **Platform**: WhatsApp Business Platform (Cloud API)

## Overview

This document details the technical integration with WhatsApp Business Platform (Cloud API) for handling WhatsApp messages. WhatsApp is part of the Meta family and shares infrastructure with Facebook/Instagram but has distinct API patterns and requirements.

**Key Insight**: While WhatsApp uses the same Graph API infrastructure as Facebook/Instagram, it has a different account model (phone numbers vs Pages), different user identifiers (phone numbers vs scoped IDs), and stricter messaging rules (templates required outside customer service window).

---

## Platform Comparison with Messenger

| Aspect                  | Facebook/Instagram              | WhatsApp                            |
| ----------------------- | ------------------------------- | ----------------------------------- |
| API Base                | Graph API                       | Graph API (same)                    |
| Account Model           | Facebook Page / IG Professional | Business Phone Number               |
| User Identifier         | PSID / IGSID (scoped IDs)       | Phone number (e.g., `+16505551234`) |
| Webhook Object          | `"page"` / `"instagram"`        | `"whatsapp_business_account"`       |
| Customer Service Window | 24 hours                        | 24 hours                            |
| Proactive Messaging     | Message Tags (limited)          | Template Messages (pre-approved)    |
| Signature Validation    | `X-Hub-Signature-256`           | `X-Hub-Signature-256` (same)        |
| Webhook Retry           | Up to 1 hour                    | Up to 7 days                        |

---

## Platform Limitations

### Supported Account Types

| Account Type                     | Supported | Notes                                           |
| -------------------------------- | --------- | ----------------------------------------------- |
| WhatsApp Business Account (WABA) | Yes       | Required for API access                         |
| Business Phone Number            | Yes       | Must be registered with WABA                    |
| Personal WhatsApp Account        | **No**    | Cannot use Business Platform APIs               |
| WhatsApp Business App            | **No**    | Separate product, not compatible with Cloud API |

### Why Personal Accounts Are Not Supported

1. **Business-only API**: WhatsApp Cloud API is exclusively for WhatsApp Business accounts
2. **Phone number verification**: Business phone numbers must be verified and registered
3. **Compliance requirements**: Template messages require Meta approval for quality control
4. **Separate ecosystems**: Personal WhatsApp and WhatsApp Business are distinct products

---

## Account Structure

### Hierarchy

```
Meta Business Portfolio (formerly Business Manager)
└── WhatsApp Business Account (WABA)
    ├── Business Phone Number 1
    │   └── Messages, Templates, Quality Rating
    ├── Business Phone Number 2
    │   └── Messages, Templates, Quality Rating
    └── ...
```

### Key Concepts

| Concept                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| **Business Portfolio** | Top-level container for Meta business assets            |
| **WABA**               | WhatsApp Business Account - container for phone numbers |
| **Phone Number**       | Individual phone number used for messaging              |
| **Display Name**       | Business name shown to customers                        |
| **Quality Rating**     | Phone number health (Green/Yellow/Red)                  |

---

## App Configuration

### Meta App Setup

We use the **same Meta App** as Facebook/Instagram integration:

| Configuration | Description                                           |
| ------------- | ----------------------------------------------------- |
| App ID        | Public identifier (shared with FB/IG)                 |
| App Secret    | Used to verify webhook signatures (shared)            |
| Webhook URL   | Single endpoint: `https://api.{domain}/webhooks/meta` |
| Verify Token  | Same as FB/IG webhook verification                    |

### Required Permissions

| Permission                     | Purpose                               |
| ------------------------------ | ------------------------------------- |
| `whatsapp_business_messaging`  | Send and receive WhatsApp messages    |
| `whatsapp_business_management` | Manage WABA, phone numbers, templates |

### Access Levels

| Level           | Description                                        |
| --------------- | -------------------------------------------------- |
| Standard Access | Limited to test phone numbers                      |
| Advanced Access | Production access (requires Business Verification) |

> **Note**: Unlike Facebook Messenger, WhatsApp requires **Business Verification** (not App Review) for production access.

---

## User Identifiers

### Phone Numbers

Unlike Facebook/Instagram's scoped IDs, WhatsApp uses actual phone numbers:

- Format: E.164 international format (e.g., `+16505551234`)
- No country code prefix for display, but API uses full format
- Same phone number = same user across all WABAs

**Important differences from PSID/IGSID**:

- Phone numbers are **not scoped** - same user has same ID everywhere
- Phone numbers are **PII** - requires careful handling for privacy
- Phone numbers can be **validated** against WhatsApp directory

### Implications for Architecture

```typescript
// Channel model addition for WhatsApp
interface Channel {
  // ... existing fields ...
  platform: 'facebook' | 'instagram' | 'whatsapp';
  platformId: string; // Page ID (FB/IG) or Phone Number ID (WhatsApp)
  phoneNumber?: string; // Only for WhatsApp - the actual phone number
}

// Conversation participant - unified model works
interface Participant {
  participantId: string; // PSID, IGSID, or phone number
  // Phone numbers should be normalized to E.164 format
}
```

---

## Webhooks

> **Reference**: [WhatsApp Webhooks Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)

### Webhook Fields to Subscribe

| Field      | Description                          |
| ---------- | ------------------------------------ |
| `messages` | Incoming messages and status updates |

> **Note**: WhatsApp uses a single `messages` field for all events, unlike Messenger's multiple fields.

### Webhook Verification (GET)

**Identical to Facebook/Instagram**:

```
GET /webhooks/meta?hub.mode=subscribe
                  &hub.verify_token=<our_verify_token>
                  &hub.challenge=<random_challenge>
```

**Response**: Return `hub.challenge` value if `hub.verify_token` matches.

### Webhook Event Notification (POST)

**Signature validation is identical** to Facebook/Instagram - use `X-Hub-Signature-256` header with App Secret.

### Webhook Payload Structure

#### Incoming Message

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15551234567",
              "phone_number_id": "<PHONE_NUMBER_ID>"
            },
            "contacts": [
              {
                "profile": { "name": "Customer Name" },
                "wa_id": "16505551234"
              }
            ],
            "messages": [
              {
                "from": "16505551234",
                "id": "wamid.ABGGFlA5...",
                "timestamp": "1677721200",
                "type": "text",
                "text": { "body": "Hello!" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

#### Message Status Update (Sent/Delivered/Read)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15551234567",
              "phone_number_id": "<PHONE_NUMBER_ID>"
            },
            "statuses": [
              {
                "id": "wamid.ABGGFlA5...",
                "status": "delivered",
                "timestamp": "1677721300",
                "recipient_id": "16505551234"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Status values**: `sent`, `delivered`, `read`, `failed`

### Key Payload Differences from Messenger

| Aspect            | Messenger                 | WhatsApp                               |
| ----------------- | ------------------------- | -------------------------------------- |
| Object type       | `"page"` or `"instagram"` | `"whatsapp_business_account"`          |
| Message container | `entry[].messaging[]`     | `entry[].changes[].value.messages[]`   |
| Sender ID         | `sender.id` (PSID/IGSID)  | `from` (phone number)                  |
| Recipient ID      | `recipient.id`            | Via `metadata.phone_number_id`         |
| Message ID format | `mid.xxx`                 | `wamid.xxx`                            |
| Status updates    | Separate webhook fields   | Same `messages` field via `statuses[]` |

### Webhook Retry Behavior

| Timeline     | Action                               |
| ------------ | ------------------------------------ |
| Immediate    | WhatsApp retries failed deliveries   |
| Up to 7 days | Continues retry attempts             |
| After 7 days | Message dropped, no further attempts |

> **Important**: WhatsApp has a much longer retry window (7 days vs 1 hour for Messenger). Implement idempotency using `wamid` message IDs.

### Webhook Payload Size

- Maximum payload size: **3 MB**
- Large payloads may be split across multiple webhook calls

---

## Send API

> **Reference**: [WhatsApp Send Messages API](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)

### API Endpoint

```
POST https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages
```

### Customer Service Window (24-Hour Rule)

Similar to Messenger, WhatsApp has a **24-hour customer service window**:

**Actions that open the window**:

- Customer sends a message to the business
- Customer clicks a WhatsApp click-to-chat ad
- Customer clicks a call-to-action button

**Within the window**: Can send any type of message (text, media, interactive)

**Outside the window**: Must use **pre-approved Template Messages**

### Sending a Text Message (Within Window)

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "16505551234",
    "type": "text",
    "text": {
      "preview_url": false,
      "body": "Hello, world!"
    }
  }'
```

**Response**:

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "16505551234", "wa_id": "16505551234" }],
  "messages": [{ "id": "wamid.ABGGFlA5..." }]
}
```

### Message Types

| Type          | Description                 | Within Window | Outside Window |
| ------------- | --------------------------- | ------------- | -------------- |
| `text`        | Plain text message          | Yes           | No             |
| `image`       | Image with optional caption | Yes           | No             |
| `audio`       | Audio file                  | Yes           | No             |
| `video`       | Video with optional caption | Yes           | No             |
| `document`    | Document/file               | Yes           | No             |
| `location`    | Location coordinates        | Yes           | No             |
| `contacts`    | Contact card(s)             | Yes           | No             |
| `interactive` | Buttons, lists, CTAs        | Yes           | No             |
| `template`    | Pre-approved template       | Yes           | **Yes**        |

### Sending Template Messages (Outside Window)

Template messages must be pre-approved by Meta and are required for proactive outreach:

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "16505551234",
    "type": "template",
    "template": {
      "name": "order_confirmation",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "ORDER-12345" },
            { "type": "text", "text": "$99.99" }
          ]
        }
      ]
    }
  }'
```

### Template Categories

| Category       | Use Case              | Approval Time   |
| -------------- | --------------------- | --------------- |
| Marketing      | Promotions, offers    | Requires review |
| Utility        | Order updates, alerts | Faster approval |
| Authentication | OTPs, verification    | Auto-approved   |

> **Note**: Template management and approval is done via Meta Business Suite or API. Templates have a separate workflow from regular messages.

### Sending Media

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "16505551234",
    "type": "image",
    "image": {
      "link": "https://example.com/image.jpg",
      "caption": "Check out this image!"
    }
  }'
```

### Interactive Messages

```bash
curl -X POST "https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "16505551234",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "Would you like to continue?" },
      "action": {
        "buttons": [
          { "type": "reply", "reply": { "id": "yes", "title": "Yes" } },
          { "type": "reply", "reply": { "id": "no", "title": "No" } }
        ]
      }
    }
  }'
```

---

## Rate Limits

> **Reference**: [WhatsApp Rate Limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview#throughput)

### Throughput Limits

| Tier     | Messages/Second | Default         |
| -------- | --------------- | --------------- |
| Standard | 80              | Yes             |
| High     | 1,000+          | Request upgrade |

### Messaging Limits (Daily)

Based on phone number quality and tier:

| Tier       | Unique Conversations/Day |
| ---------- | ------------------------ |
| Unverified | 250                      |
| Tier 1     | 1,000                    |
| Tier 2     | 10,000                   |
| Tier 3     | 100,000                  |
| Tier 4     | Unlimited                |

> **Note**: Limits apply to business-initiated conversations. Customer-initiated conversations don't count against limits.

### Quality Rating

Phone number quality affects messaging limits:

| Rating | Impact               |
| ------ | -------------------- |
| Green  | No restrictions      |
| Yellow | May limit expansion  |
| Red    | Messaging restricted |

---

## Phone Number Setup

### Registration Flow

1. **Add phone number to WABA** via Meta Business Suite or API
2. **Verify phone number** via SMS or voice call
3. **Set display name** (requires Meta approval)
4. **Register with Cloud API** to enable API access

### Two-Factor Authentication (2FA)

Phone numbers can have a PIN for additional security:

```bash
# Set 2FA PIN
curl -X POST "https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -d "pin=123456"
```

---

## OAuth Flow & Credentials Management (Embedded Signup)

> **Reference**: [Embedded Signup Overview](https://developers.facebook.com/docs/whatsapp/embedded-signup/overview) | [Implementation Guide](https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation)

### Key Difference from Facebook/Instagram OAuth

**WhatsApp uses "Embedded Signup" - NOT standard OAuth redirect flow.**

| Aspect                | Facebook/Instagram           | WhatsApp                                              |
| --------------------- | ---------------------------- | ----------------------------------------------------- |
| **Onboarding Method** | Standard OAuth redirect      | Embedded Signup (JS SDK popup)                        |
| **Flow Type**         | Server-side redirect         | Client-side popup + server exchange                   |
| **Token Type**        | Long-lived Page Access Token | Business Integration System User Token                |
| **Token Lifespan**    | Never expires                | **Never expires** (default) OR 60 days (configurable) |
| **Code TTL**          | 10 minutes                   | **30 seconds** (critical!)                            |
| **Refresh Required**  | No                           | No (unless 60-day tokens)                             |
| **Returns**           | Authorization code only      | Code + WABA ID + Phone Number ID                      |

> **Critical**: The authorization code from Embedded Signup is only valid for **30 seconds** (vs 10 minutes for FB/IG). You must exchange it immediately!

### Token Types & Lifespans

| Token Type                                 | Source                       | Lifespan            | Use Case                                      |
| ------------------------------------------ | ---------------------------- | ------------------- | --------------------------------------------- |
| **Business Integration System User Token** | Embedded Signup              | **Never expires**\* | **Primary token for API calls** (recommended) |
| Business Token (60-day)                    | Embedded Signup (configured) | 60 days             | When token rotation is preferred              |
| System User Token                          | Business Portfolio manual    | Never expires       | Alternative for pre-existing System Users     |
| User Access Token                          | Graph API Explorer           | ~1-2 hours          | Testing/development only                      |

> \***Important**: Business Integration System User tokens generated via Embedded Signup **never expire by default**. They are only invalidated by specific user actions (see Token Invalidation section). You can optionally configure 60-day expiration if you prefer token rotation.

### Complete Embedded Signup Flow

Unlike Facebook/Instagram's standard OAuth redirect, WhatsApp uses **Facebook Login for Business** with a JavaScript SDK to launch a popup flow. This flow is called "Embedded Signup."

#### Prerequisites

1. **Meta App** with WhatsApp Business API enabled
2. **Facebook Login for Business** product added to your Meta App
3. **Configuration ID** from Facebook Login for Business settings
4. Valid **App ID** and **App Secret**

#### Step 1: Configure Facebook Login for Business

In your Meta App Dashboard:

1. Go to **Facebook Login for Business** product
2. Create a new **Configuration** with:
   - **Configuration name**: e.g., "WhatsApp Onboarding"
   - **Permissions**: `whatsapp_business_messaging`, `whatsapp_business_management`
   - **Token expiration**: "Never" (default) or "60 days"
3. Save and note the **Configuration ID**

```typescript
// Configuration stored in environment
interface EmbeddedSignupConfig {
  metaAppId: string;
  metaAppSecret: string;
  configurationId: string; // Facebook Login for Business configuration ID
  callbackUrl: string; // Your server endpoint to receive the code
}

const config: EmbeddedSignupConfig = {
  metaAppId: process.env.META_APP_ID!,
  metaAppSecret: process.env.META_APP_SECRET!,
  configurationId: process.env.FB_LOGIN_CONFIG_ID!,
  callbackUrl: `${process.env.API_BASE_URL}/oauth/whatsapp/callback`,
};
```

#### Step 2: Add JavaScript SDK to Your Frontend

Include the Meta SDK on your onboarding page:

```html
<!-- Meta SDK -->
<script
  async
  defer
  crossorigin="anonymous"
  src="https://connect.facebook.net/en_US/sdk.js"
></script>

<script>
  window.fbAsyncInit = function () {
    FB.init({
      appId: '{YOUR_APP_ID}',
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v24.0',
    });
  };
</script>
```

#### Step 3: Implement Launch Button and Response Handler

```typescript
// Frontend: Launch Embedded Signup popup
interface EmbeddedSignupResponse {
  authResponse: {
    code: string; // Authorization code (30 sec TTL!)
    accessToken?: string; // Only if using client token flow
  };
  waba_id: string; // WhatsApp Business Account ID
  phone_number_id: string; // Business phone number ID
}

interface SessionInfo {
  sessionInfoType: 'WA_EMBEDDED_SIGNUP';
  waba_id: string;
  phone_number_id: string;
}

function launchWhatsAppSignup(tenantId: string): void {
  // Generate state for CSRF protection
  const state = `${tenantId}:${crypto.randomUUID()}`;

  // Store state temporarily (will be validated on callback)
  sessionStorage.setItem('wa_oauth_state', state);

  FB.login(
    (response: EmbeddedSignupResponse) => {
      if (response.authResponse) {
        // CRITICAL: Code is only valid for 30 seconds!
        // Send to server immediately
        handleEmbeddedSignupResponse(response, state);
      } else {
        console.error('User cancelled or error occurred');
      }
    },
    {
      config_id: '{CONFIGURATION_ID}', // From Facebook Login for Business
      response_type: 'code', // Request authorization code
      override_default_response_type: true,
      extras: {
        setup: {
          // Optional: Pre-fill business info if known
          // business: { name: 'Customer Business Name' }
        },
        featureType: '',
        sessionInfoVersion: 2,
      },
    }
  );
}

async function handleEmbeddedSignupResponse(
  response: EmbeddedSignupResponse,
  state: string
): Promise<void> {
  const { code } = response.authResponse;
  const { waba_id, phone_number_id } = response;

  // Send to server IMMEDIATELY (30 second code TTL)
  const result = await fetch('/api/oauth/whatsapp/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      waba_id,
      phone_number_id,
      state,
    }),
  });

  if (!result.ok) {
    throw new Error('Failed to complete WhatsApp onboarding');
  }

  const data = await result.json();
  // Handle success - redirect to channel management
}
```

#### Step 4: Handle Callback and Exchange Code for Token (Server)

```typescript
// Server: /api/oauth/whatsapp/callback

interface WhatsAppCallbackParams {
  code: string; // Authorization code (30 sec TTL!)
  waba_id: string; // WhatsApp Business Account ID
  phone_number_id: string; // Phone number ID
  state: string; // CSRF state parameter
}

async function handleWhatsAppCallback(params: WhatsAppCallbackParams) {
  const { code, waba_id, phone_number_id, state } = params;

  // 1. Verify state parameter (CSRF protection)
  const [tenantId, nonce] = state.split(':');
  const storedState = await cache.get(`wa:oauth:state:${state}`);
  if (!storedState) {
    throw new Error('Invalid or expired state');
  }
  await cache.delete(`wa:oauth:state:${state}`);

  // 2. Exchange code for Business Token IMMEDIATELY (30 sec TTL!)
  const tokenResponse = await exchangeCodeForBusinessToken(code);

  // 3. Get additional WABA info (optional but recommended)
  const wabaInfo = await getWABAInfo(waba_id, tokenResponse.accessToken);

  // 4. Get phone number details
  const phoneInfo = await getPhoneNumberInfo(
    phone_number_id,
    tokenResponse.accessToken
  );

  // 5. Subscribe WABA to webhooks
  await subscribeWABAToWebhooks(waba_id, tokenResponse.accessToken);

  // 6. Register phone number for Cloud API (if not already)
  await registerPhoneNumber(phone_number_id, tokenResponse.accessToken);

  // 7. Store Channel record
  await createChannel({
    tenantId,
    platform: 'whatsapp',
    platformId: phone_number_id, // Primary identifier
    wabaId: waba_id,
    phoneNumber: phoneInfo.display_phone_number,
    name: phoneInfo.verified_name || wabaInfo.name,
    accessToken: encrypt(tokenResponse.accessToken),
    tokenExpiresAt: tokenResponse.expiresAt, // null if never expires
    businessId: tokenResponse.businessId,
    status: 'active',
    connectedAt: new Date(),
  });

  return {
    success: true,
    wabaId: waba_id,
    phoneNumberId: phone_number_id,
    displayPhoneNumber: phoneInfo.display_phone_number,
  };
}
```

#### Step 5: Exchange Code for Business Token

> **CRITICAL**: The authorization code expires in **30 seconds**. Exchange immediately!

```bash
GET https://graph.facebook.com/v24.0/oauth/access_token?
  client_id={APP_ID}
  &client_secret={APP_SECRET}
  &code={CODE}
```

**Response**:

```json
{
  "access_token": "{business-integration-system-user-token}",
  "token_type": "bearer",
  "expires_in": 0
}
```

> **Note**: `expires_in: 0` indicates a **never-expiring token** (default). If you configured 60-day tokens, this will be `5184000` (60 days in seconds).

**TypeScript Implementation**:

```typescript
interface TokenExchangeResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: Date | null; // null = never expires
  businessId?: string;
}

async function exchangeCodeForBusinessToken(
  code: string
): Promise<TokenExchangeResponse> {
  // CRITICAL: Must be called within 30 seconds of receiving code!
  const response = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        code,
      })
  );

  const data = await response.json();

  if (data.error) {
    // Check for expired code error
    if (data.error.code === 100 && data.error.message.includes('expired')) {
      throw new Error(
        'Authorization code expired (30 second limit). User must restart signup.'
      );
    }
    throw new Error(data.error.message);
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresAt:
      data.expires_in > 0
        ? new Date(Date.now() + data.expires_in * 1000)
        : null, // null = never expires
  };
}
```

#### Step 6: Subscribe WABA to Webhooks

After obtaining the token, subscribe the customer's WABA to receive webhooks:

```bash
POST https://graph.facebook.com/v24.0/{WABA_ID}/subscribed_apps
  -H "Authorization: Bearer {BUSINESS_TOKEN}"
```

**Response**:

```json
{ "success": true }
```

**TypeScript Implementation**:

```typescript
async function subscribeWABAToWebhooks(
  wabaId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v24.0/${wabaId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to subscribe WABA ${wabaId} to webhooks`);
  }
}
```

**Verify Subscription**:

```bash
GET https://graph.facebook.com/v24.0/{WABA_ID}/subscribed_apps
  -H "Authorization: Bearer {BUSINESS_TOKEN}"
```

#### Step 7: Register Phone Number for Cloud API

If the phone number isn't already registered with Cloud API, register it:

```bash
POST https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/register
  -H "Authorization: Bearer {BUSINESS_TOKEN}"
  -H "Content-Type: application/json"
  -d '{
    "messaging_product": "whatsapp",
    "pin": "123456"
  }'
```

> **Note**: The `pin` is a 6-digit two-factor authentication PIN. If 2FA isn't enabled on the number, you can omit this field.

**TypeScript Implementation**:

```typescript
async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin?: string
): Promise<void> {
  const body: Record<string, string> = {
    messaging_product: 'whatsapp',
  };

  if (pin) {
    body.pin = pin;
  }

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${phoneNumberId}/register`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (data.error) {
    // Phone may already be registered - check error code
    if (
      data.error.code === 100 &&
      data.error.message.includes('already registered')
    ) {
      return; // Already registered, that's fine
    }
    throw new Error(data.error.message);
  }
}
```

---

## Token Lifecycle & Monitoring

### Token Invalidation Scenarios

Business Integration System User tokens are invalidated when:

| Scenario                                    | Effect                  | Detection                            |
| ------------------------------------------- | ----------------------- | ------------------------------------ |
| Customer removes app from Business Settings | Token invalidated       | API error code 190                   |
| Customer revokes app permission             | Token invalidated       | API error code 190, subcode 458      |
| WABA is deleted                             | Token loses WABA access | API error on WABA operations         |
| Phone number removed from WABA              | Partial access loss     | API error on phone number operations |
| App is restricted/disabled                  | All tokens invalidated  | API error code 190                   |
| Token configured for 60-day expiry          | Token expires           | API error code 190, subcode 463      |

> **Key Insight**: Unlike Zalo tokens that expire every 25 hours, WhatsApp Business tokens **never expire by default**. However, customers can revoke access at any time from their Business Settings.

### Where Customers Revoke Access

Customers can remove your app's access via:

**Business Manager / Meta Business Suite**:

1. Go to **Business Settings**
2. Navigate to **Integrations** > **Connected apps**
3. Find your app and click **Remove**

When this happens, all tokens for that customer's WABA become invalid immediately.

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
    "type": "SYSTEM_USER",
    "application": "My WhatsApp App",
    "expires_at": 0,
    "is_valid": true,
    "issued_at": 1704067200,
    "scopes": ["whatsapp_business_messaging", "whatsapp_business_management"],
    "granular_scopes": [
      {
        "scope": "whatsapp_business_messaging",
        "target_ids": ["123456789012345"]
      }
    ]
  }
}
```

> **Note**: `expires_at: 0` indicates a never-expiring token.

**TypeScript Implementation**:

```typescript
interface TokenDebugInfo {
  isValid: boolean;
  appId: string;
  type: string;
  expiresAt: Date | null;
  scopes: string[];
  wabaIds?: string[];
}

async function debugToken(tokenToCheck: string): Promise<TokenDebugInfo> {
  const appToken = `${config.metaAppId}|${config.metaAppSecret}`;

  const response = await fetch(
    `https://graph.facebook.com/debug_token?` +
      new URLSearchParams({
        input_token: tokenToCheck,
        access_token: appToken,
      })
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const info = data.data;

  return {
    isValid: info.is_valid,
    appId: info.app_id,
    type: info.type,
    expiresAt: info.expires_at > 0 ? new Date(info.expires_at * 1000) : null,
    scopes: info.scopes || [],
    wabaIds: info.granular_scopes
      ?.filter((s: any) => s.scope === 'whatsapp_business_messaging')
      ?.flatMap((s: any) => s.target_ids),
  };
}
```

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

async function handleWhatsAppTokenError(
  channelId: string,
  error: MetaApiError
): Promise<void> {
  const { code, error_subcode } = error.error;

  // Token is invalid - mark channel as disconnected
  if (code === 190) {
    let reason: string;

    switch (error_subcode) {
      case 458: // User revoked app permission
        reason = 'Customer removed app from Business Settings';
        break;
      case 463: // Token expired (only for 60-day tokens)
        reason = 'Token expired (60-day token)';
        break;
      case 460: // Session invalidated
        reason = 'Session invalidated';
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
    detail: { channelId, reason, platform: 'whatsapp' },
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

**Customer Revoked App Access (code 190, subcode 458)**:

```json
{
  "error": {
    "message": "Error validating access token: The user has not authorized application {app-id}.",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 458,
    "fbtrace_id": "H2il2t5bn4e"
  }
}
```

**Code Expired (30 second limit)**:

```json
{
  "error": {
    "message": "This authorization code has expired.",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "AKxyz123"
  }
}
```

---

## Credentials Storage

### What to Store per Channel

| Field                | Description                                | Encrypted |
| -------------------- | ------------------------------------------ | --------- |
| `platformId`         | Phone Number ID (primary identifier)       | No        |
| `wabaId`             | WhatsApp Business Account ID               | No        |
| `phoneNumber`        | Display phone number (E.164 format)        | No        |
| `businessId`         | Customer's Business Portfolio ID           | No        |
| `accessToken`        | Business Integration System User Token     | **Yes**   |
| `tokenExpiresAt`     | null (never) or timestamp (60-day tokens)  | No        |
| `tokenStatus`        | `valid` \| `invalid` \| `unknown`          | No        |
| `connectedBy`        | User ID who completed Embedded Signup      | No        |
| `connectedAt`        | Timestamp of onboarding completion         | No        |
| `lastVerifiedAt`     | Last successful token validation           | No        |
| `disconnectedAt`     | When token was invalidated (if applicable) | No        |
| `disconnectedReason` | Why token was invalidated                  | No        |

### Channel Interface (TypeScript)

```typescript
interface WhatsAppChannel extends BaseChannel {
  platform: 'whatsapp';
  platformId: string; // Phone Number ID
  wabaId: string; // WhatsApp Business Account ID
  phoneNumber: string; // Display phone number (E.164)
  businessId?: string; // Customer's Business Portfolio ID
  accessToken: string; // Encrypted Business token
  tokenExpiresAt: Date | null; // null = never expires
  tokenStatus: 'valid' | 'invalid' | 'unknown';
  connectedBy: string;
  connectedAt: Date;
  lastVerifiedAt?: Date;
  disconnectedAt?: Date;
  disconnectedReason?: string;
}
```

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

### Optional: Proactive Token Health Checks

Since WhatsApp tokens don't expire by default, health checks are less critical than for Zalo. However, you may want to verify tokens periodically to detect customer revocations:

```typescript
// Optional: Scheduled Lambda to verify token health (e.g., daily)
async function checkWhatsAppTokenHealth(): Promise<void> {
  const channels = await db.channel.findMany({
    where: {
      platform: 'whatsapp',
      status: 'active',
    },
  });

  for (const channel of channels) {
    try {
      const token = await decryptToken(channel.accessToken);
      const debugInfo = await debugToken(token);

      if (!debugInfo.isValid) {
        await markChannelDisconnected(
          channel.channelId,
          'Token verification failed'
        );
      } else {
        await db.channel.update({
          where: { channelId: channel.channelId },
          data: {
            lastVerifiedAt: new Date(),
            tokenStatus: 'valid',
          },
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
```

---

## Platform Comparison: OAuth/Credentials Summary

| Aspect                 | Facebook/Instagram            | WhatsApp                                | Zalo                            |
| ---------------------- | ----------------------------- | --------------------------------------- | ------------------------------- |
| **Onboarding Flow**    | Standard OAuth redirect       | Embedded Signup (JS SDK popup)          | OAuth with PKCE                 |
| **Token Type**         | Long-lived Page Access Token  | Business Integration System User Token  | Official Account Access Token   |
| **Token Lifespan**     | Never expires                 | Never expires (default) or 60 days      | 25 hours                        |
| **Refresh Required**   | No                            | No (unless 60-day)                      | **Yes** (proactive, every ~19h) |
| **Code TTL**           | 10 minutes                    | **30 seconds** (critical!)              | 10 minutes                      |
| **Webhook Subscribe**  | Per-Page                      | Per-WABA                                | Auto (app-level)                |
| **Token Invalidation** | User revokes, password change | Customer removes from Business Settings | Token expired, OA admin revokes |

---

## Alternative: System User Token (Manual Setup)

For customers who already have System Users in their Business Portfolio, you can use the traditional System User token approach instead of Embedded Signup:

### Manual Setup Steps

1. **Create System User** in Business Portfolio
2. **Add System User to WABA** with appropriate role (Admin or Developer)
3. **Generate permanent token** for System User
4. **Customer provides token** to your application
5. **Store token securely** (encrypted in DynamoDB)

### Getting WABA and Phone Number IDs

```bash
# List WABAs for Business Portfolio
curl "https://graph.facebook.com/v24.0/{BUSINESS_ID}/owned_whatsapp_business_accounts" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"

# List phone numbers for WABA
curl "https://graph.facebook.com/v24.0/{WABA_ID}/phone_numbers" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

> **Note**: Embedded Signup is recommended for most use cases as it provides a streamlined onboarding experience for customers. System User tokens are better suited for enterprise customers who manage their own Business Portfolios.

---

## Architecture Compatibility

### What Works Without Changes

| Component            | Compatibility                                |
| -------------------- | -------------------------------------------- |
| Webhook endpoint     | Same `/webhooks/meta` endpoint               |
| Signature validation | Same HMAC-SHA256 with App Secret             |
| SQS queue buffering  | Works identically                            |
| DynamoDB model       | Channel, Conversation, Message entities work |
| EventBridge events   | Same event pattern                           |

### Required Adaptations

| Component        | Adaptation Needed                                 |
| ---------------- | ------------------------------------------------- |
| Webhook parser   | New parser for `whatsapp_business_account` object |
| Channel lookup   | Query by Phone Number ID instead of Page ID       |
| User ID handling | Store phone numbers, handle E.164 format          |
| Message sender   | Different API payload structure                   |
| Template support | New functionality for template messages           |

### Platform Adapter Implementation

```typescript
// platforms/whatsapp/webhook-parser.ts
interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string; // WABA ID
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<WhatsAppMessage>;
        statuses?: Array<WhatsAppStatus>;
      };
      field: 'messages';
    }>;
  }>;
}

// Platform adapter pattern
const whatsappAdapter: PlatformAdapter = {
  parseWebhook(payload: WhatsAppWebhookPayload): NormalizedMessage[] {
    // Extract phone_number_id for channel lookup
    // Normalize messages to unified format
    // Handle status updates separately
  },

  sendMessage(channel: Channel, message: OutboundMessage): Promise<SendResult> {
    // POST to /{phone_number_id}/messages
    // Handle template vs regular messages
  },

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    // Same as Messenger - HMAC-SHA256 with App Secret
  },
};
```

---

## Implementation Considerations

### Phone Number as PII

Unlike PSIDs/IGSIDs, phone numbers are personally identifiable:

- Consider encryption at rest (beyond access token encryption)
- May need data retention policies
- GDPR/privacy implications for EU customers

### Template Message Management

Templates require a separate workflow:

1. **Create template** via API or Business Suite
2. **Submit for review** (Meta approval)
3. **Store template metadata** in our system
4. **Use approved templates** for proactive messaging

> **Future consideration**: Should we build template management into the Conversations Service?

### Message ID Format

WhatsApp uses `wamid.xxx` format vs Messenger's `mid.xxx`:

```typescript
// Ensure message ID parsing handles both formats
function parseMessageId(id: string): { platform: Platform; id: string } {
  if (id.startsWith('wamid.')) {
    return { platform: 'whatsapp', id };
  }
  if (id.startsWith('mid.')) {
    return { platform: 'facebook', id }; // or 'instagram'
  }
  throw new Error(`Unknown message ID format: ${id}`);
}
```

---

## References

### Official Documentation

- [WhatsApp Business Platform Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview) - Main entry point
- [WhatsApp Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks) - Webhook setup and payloads
- [Send Messages API](https://developers.facebook.com/docs/whatsapp/cloud-api/messages) - Sending all message types
- [Message Templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates) - Template message guide
- [Phone Number Registration](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers) - Phone setup

### API Reference

- [Messages API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages) - Complete API spec
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components) - Webhook payload schemas

### Tools

- [Meta Business Suite](https://business.facebook.com/) - WABA and phone management
- [Graph API Explorer](https://developers.facebook.com/tools/explorer) - Test API calls

### Policies

- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy) - Usage guidelines
- [Commerce Policy](https://www.whatsapp.com/legal/commerce-policy) - E-commerce restrictions
