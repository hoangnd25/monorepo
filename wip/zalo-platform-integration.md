# Zalo Platform Integration Guide

> **Status**: Reference Documentation
> **Last Updated**: 2026-01-10
> **Platform**: Zalo Official Account API (OA API)

## Overview

This document details the technical integration with Zalo Official Account API for handling Zalo messages. Zalo is Vietnam's largest messaging platform with 75+ million users. Unlike Meta platforms, Zalo has distinct message types with different conditions, a **7-day messaging window** (vs 24 hours for Meta), and uses scoped User IDs (similar to Facebook PSID).

**Key Insight**: Zalo's messaging rules are more permissive than Meta's 24-hour window but have a tiered pricing model - free within 48 hours of user interaction, paid after 48 hours (up to 7 days). Template messages (ZBS) are required for proactive outreach outside the 7-day window.

---

## Platform Comparison

| Aspect                  | Meta (FB/IG/WhatsApp)            | Zalo                                      |
| ----------------------- | -------------------------------- | ----------------------------------------- |
| API Base                | Graph API                        | OpenAPI (`openapi.zalo.me`)               |
| Account Model           | Page / Phone Number              | Official Account (OA)                     |
| User Identifier         | PSID / IGSID / Phone Number      | User ID (UID) - scoped per OA             |
| Webhook Response Time   | 5 seconds                        | **2 seconds** (stricter)                  |
| Customer Service Window | 24 hours                         | **7 days** (with 48h free tier)           |
| Proactive Messaging     | Templates / Message Tags         | ZBS Template Message                      |
| Signature Validation    | HMAC-SHA256 with App Secret      | MAC validation with OA Secret Key         |
| Webhook Retry           | 1 hour (Messenger) / 7 days (WA) | ~1 hour (30s, 5m, 15m, 30m, 1h intervals) |

---

## Platform Limitations

### Supported Account Types

| Account Type                   | Supported | Notes                      |
| ------------------------------ | --------- | -------------------------- |
| Zalo Official Account (OA)     | Yes       | Required for API access    |
| Personal Zalo Account          | **No**    | Cannot use OA APIs         |
| Zalo Business Account (legacy) | Partial   | Deprecated since June 2023 |

### Why Personal Accounts Are Not Supported

1. **Business-only API**: Zalo OA API is exclusively for Official Accounts
2. **OA verification required**: Business must be verified to create OA
3. **User consent required**: Users must follow OA or initiate conversation first
4. **Compliance requirements**: Template messages require Zalo approval

---

## Account Structure

### Hierarchy

```
Zalo Cloud Account (ZCA)
└── Zalo Official Account (OA)
    ├── App Connection 1
    │   └── Webhook, Access Token, Permissions
    ├── App Connection 2
    │   └── Webhook, Access Token, Permissions
    └── ...
```

### Key Concepts

| Concept                      | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| **Zalo Cloud Account (ZCA)** | Billing account for OA services and ZNS                      |
| **Official Account (OA)**    | Business account on Zalo (like Facebook Page)                |
| **Zalo App**                 | Application created on developers.zalo.me to manage OA       |
| **OA ID**                    | Unique identifier for the Official Account                   |
| **User ID (UID)**            | Scoped user identifier (unique per OA, not globally)         |
| **Official Account Token**   | Access token for API calls (`Official_Account_Access_Token`) |

---

## App Configuration

### Zalo App Setup

| Configuration | Description                                      |
| ------------- | ------------------------------------------------ |
| App ID        | Public identifier for the application            |
| Secret Key    | Used for OAuth and webhook MAC validation        |
| OA Secret Key | Per-OA secret for webhook signature verification |
| Webhook URL   | HTTPS endpoint for receiving events              |
| Callback URL  | OAuth redirect URL                               |

### Required Permissions (Quyền)

| Permission Group   | Vietnamese Name      | Purpose                            |
| ------------------ | -------------------- | ---------------------------------- |
| `send_message`     | Gửi tin nhắn         | Send consultation messages         |
| `manage_quota`     | Quản lý hạn mức      | Check message quotas               |
| `send_transaction` | Gửi tin giao dịch    | Send transaction template messages |
| `send_broadcast`   | Gửi tin truyền thông | Send broadcast messages            |

### Access Levels

| Level       | Description                       |
| ----------- | --------------------------------- |
| Development | Limited testing, sandbox OA       |
| Production  | Full access after OA verification |

---

## User Identifiers

### User ID (UID)

Unlike WhatsApp's phone numbers, Zalo uses scoped User IDs similar to Facebook PSID:

- Format: Numeric string (e.g., `1234567890123456`)
- Scoped per OA: Same user has different UID for different OAs
- Not PII: Cannot identify user across OAs
- Obtained when user interacts with OA (follows, sends message, etc.)

**Important characteristics**:

- User IDs are **scoped** - same user has different ID per OA (like Facebook PSID)
- User IDs are **not phone numbers** - no PII concerns like WhatsApp
- User IDs are **stable** - don't change for the same user-OA relationship

### Implications for Architecture

```typescript
// Channel model for Zalo
interface Channel {
  // ... existing fields ...
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'zalo';
  platformId: string; // OA ID for Zalo
  oaId?: string; // Zalo Official Account ID (same as platformId)
}

// Conversation participant - unified model works
interface Participant {
  participantId: string; // UID for Zalo (scoped like PSID)
  participantIdType: 'scoped' | 'phone'; // 'scoped' for Zalo
}
```

---

## Webhooks

> **Reference**: [Zalo Webhook Documentation](https://developers.zalo.me/docs/official-account/webhook/tong-quan)

### Webhook Configuration

Configure webhook in Zalo App settings:

- **Webhook URL**: Must be HTTPS with valid domain (not host:port)
- **Event Types**: Select which events to receive (messages, follows, etc.)
- **Syntax Filter**: Optional - only receive messages starting with "#"

### Performance Requirements

| Requirement   | Value       | Notes                              |
| ------------- | ----------- | ---------------------------------- |
| Response Code | 200 OK      | Any other code triggers retry      |
| Response Time | ≤ 2 seconds | **Stricter than Meta's 5 seconds** |
| Protocol      | HTTPS       | Required, no plain HTTP            |
| URL Format    | Domain      | Must use domain, not host:port     |

### Webhook Retry Behavior

| Retry # | Delay After Previous | Cumulative Time |
| ------- | -------------------- | --------------- |
| 1       | 30 seconds           | 30 seconds      |
| 2       | 5 minutes            | 5.5 minutes     |
| 3       | 15 minutes           | 20.5 minutes    |
| 4       | 30 minutes           | 50.5 minutes    |
| 5       | 1 hour               | ~1.8 hours      |

**Retry Header**: `num_retry` in request headers indicates retry count (0 for first attempt)

> **Note**: After all retries fail, webhook is disabled and OA admin is notified. Must re-enable in app settings after fixing.

### Webhook Signature Validation

Zalo uses MAC (Message Authentication Code) for webhook validation:

```typescript
// Webhook signature validation
import crypto from 'crypto';

function verifyZaloWebhook(
  timestamp: string,
  oaId: string,
  requestBody: string,
  oaSecretKey: string,
  receivedMac: string
): boolean {
  const data = `${oaId}${requestBody}${timestamp}${oaSecretKey}`;
  const computedMac = crypto.createHash('sha256').update(data).digest('hex');

  return computedMac === receivedMac;
}
```

**Headers for validation**:

- `X-ZEvent-Signature`: MAC signature
- `timestamp`: Unix timestamp of event

### Webhook Payload Structure

#### Incoming Text Message

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "user_id_123456"
  },
  "recipient": {
    "id": "oa_id_789012"
  },
  "event_name": "user_send_text",
  "message": {
    "msg_id": "msg_abc123xyz",
    "text": "Hello, I need help!"
  },
  "timestamp": "1677721200000"
}
```

#### Incoming Image Message

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "user_id_123456"
  },
  "recipient": {
    "id": "oa_id_789012"
  },
  "event_name": "user_send_image",
  "message": {
    "msg_id": "msg_abc123xyz",
    "attachments": [
      {
        "type": "image",
        "payload": {
          "url": "https://...",
          "thumbnail": "https://..."
        }
      }
    ]
  },
  "timestamp": "1677721200000"
}
```

#### User Follow Event

```json
{
  "app_id": "1234567890",
  "follower": {
    "id": "user_id_123456"
  },
  "oa_id": "oa_id_789012",
  "event_name": "follow",
  "timestamp": "1677721200000"
}
```

#### Incoming File Message

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "user_id_123456"
  },
  "recipient": {
    "id": "oa_id_789012"
  },
  "event_name": "user_send_file",
  "message": {
    "msg_id": "msg_file123xyz",
    "attachments": [
      {
        "type": "file",
        "payload": {
          "url": "https://...",
          "name": "document.pdf",
          "size": "1024000"
        }
      }
    ]
  },
  "timestamp": "1677721200000"
}
```

#### Incoming Location Message

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "user_id_123456"
  },
  "recipient": {
    "id": "oa_id_789012"
  },
  "event_name": "user_send_location",
  "message": {
    "msg_id": "msg_loc123xyz",
    "location": {
      "latitude": "10.762622",
      "longitude": "106.660172"
    }
  },
  "timestamp": "1677721200000"
}
```

#### Message Delivery Status (Webhook)

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "oa_id_789012"
  },
  "recipient": {
    "id": "user_id_123456"
  },
  "event_name": "user_received_message",
  "message": {
    "msg_id": "msg_sent123xyz"
  },
  "timestamp": "1677721300000"
}
```

#### Message Seen Status (Webhook)

```json
{
  "app_id": "1234567890",
  "sender": {
    "id": "oa_id_789012"
  },
  "recipient": {
    "id": "user_id_123456"
  },
  "event_name": "user_seen_message",
  "message": {
    "msg_id": "msg_sent123xyz"
  },
  "timestamp": "1677721400000"
}
```

### Event Types

| Event Name                | Vietnamese           | Description                        |
| ------------------------- | -------------------- | ---------------------------------- |
| `user_send_text`          | Gửi tin nhắn văn bản | User sends text message            |
| `user_send_image`         | Gửi hình ảnh         | User sends image                   |
| `user_send_file`          | Gửi file             | User sends file attachment         |
| `user_send_sticker`       | Gửi sticker          | User sends sticker                 |
| `user_send_gif`           | Gửi GIF              | User sends animated GIF            |
| `user_send_audio`         | Gửi audio            | User sends voice message           |
| `user_send_video`         | Gửi video            | User sends video                   |
| `user_send_location`      | Gửi vị trí           | User sends location                |
| `user_send_business_card` | Gửi danh thiếp       | User sends contact card            |
| `follow`                  | Quan tâm             | User follows OA                    |
| `unfollow`                | Bỏ quan tâm          | User unfollows OA                  |
| `oa_send_text`            | OA gửi tin nhắn      | Delivery status for OA messages    |
| `user_received_message`   | Người dùng nhận tin  | User received message confirmation |
| `user_seen_message`       | Người dùng xem tin   | User seen/read message             |

### Key Payload Differences from Meta

| Aspect            | Meta (Messenger)            | Zalo                       |
| ----------------- | --------------------------- | -------------------------- |
| Event identifier  | N/A (inferred from payload) | `event_name` field         |
| Message container | `entry[].messaging[]`       | Top-level `message` object |
| Sender ID         | `sender.id`                 | `sender.id`                |
| Recipient ID      | `recipient.id`              | `recipient.id`             |
| Message ID format | `mid.xxx`                   | Alphanumeric string        |
| Timestamp format  | Unix seconds                | Unix **milliseconds**      |

---

## Message Types and Conditions

### Overview of Message Types

| Type         | Vietnamese       | Purpose                   | Window Required | Cost        |
| ------------ | ---------------- | ------------------------- | --------------- | ----------- |
| Consultation | Tin Tư vấn       | Customer support, replies | 7 days          | Free/Paid\* |
| Transaction  | Tin Giao dịch    | Order updates, alerts     | No (template)   | Per message |
| Broadcast    | Tin Truyền thông | Marketing, promotions     | Follower only   | Per message |

\*Free within 48 hours of user interaction, paid after 48 hours (still within 7-day window)

### Messaging Window (Critical Difference!)

Unlike Meta's uniform 24-hour window, Zalo has a **tiered 7-day window**:

```
User sends message
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                    0-48 HOURS                        │
│  ✅ Can send Consultation messages (FREE)            │
│  ✅ No message type restrictions                     │
└──────────────────────────────────────────────────────┘
       │
       ▼ (after 48 hours)
┌──────────────────────────────────────────────────────┐
│                  48 HOURS - 7 DAYS                   │
│  ✅ Can send Consultation messages (PAID)            │
│  💰 Charged per message                              │
└──────────────────────────────────────────────────────┘
       │
       ▼ (after 7 days)
┌──────────────────────────────────────────────────────┐
│                  OUTSIDE 7 DAYS                      │
│  ❌ Cannot send Consultation messages                │
│  ✅ Must use ZBS Template Message (paid)             │
│  ✅ Or wait for user to re-initiate                  │
└──────────────────────────────────────────────────────┘
```

### Architecture Implications

```typescript
// Messaging window logic for Zalo
interface MessagingWindowConfig {
  platform: Platform;
  freeWindowHours: number; // 48 for Zalo, 24 for Meta
  totalWindowHours: number; // 168 (7 days) for Zalo, 24 for Meta
}

const platformWindows: Record<Platform, MessagingWindowConfig> = {
  facebook: { platform: 'facebook', freeWindowHours: 24, totalWindowHours: 24 },
  instagram: {
    platform: 'instagram',
    freeWindowHours: 24,
    totalWindowHours: 24,
  },
  whatsapp: { platform: 'whatsapp', freeWindowHours: 24, totalWindowHours: 24 },
  zalo: { platform: 'zalo', freeWindowHours: 48, totalWindowHours: 168 },
};

function canSendMessage(
  conversation: Conversation,
  messageType: 'consultation' | 'template'
): { allowed: boolean; requiresPayment: boolean } {
  const config = platformWindows[conversation.platform];
  const hoursSinceLastCustomerMessage = getHoursSince(
    conversation.lastCustomerMessageAt
  );

  if (messageType === 'template') {
    return { allowed: true, requiresPayment: true }; // Templates always allowed (paid)
  }

  // Consultation message
  if (hoursSinceLastCustomerMessage <= config.freeWindowHours) {
    return { allowed: true, requiresPayment: false }; // Free window
  }

  if (hoursSinceLastCustomerMessage <= config.totalWindowHours) {
    return { allowed: true, requiresPayment: true }; // Paid window (Zalo only)
  }

  return { allowed: false, requiresPayment: false }; // Outside window
}
```

---

## Send API

> **Reference**: [Zalo Send Message API](https://developers.zalo.me/docs/official-account/tin-nhan/tin-tu-van/gui-tin-tu-van)

### API Base URL

```
https://openapi.zalo.me/v3.0/oa/message/cs
```

### Authentication

All API calls require `Official_Account_Access_Token` in the `access_token` header.

### Sending a Text Message (Consultation)

```bash
curl -X POST "https://openapi.zalo.me/v3.0/oa/message/cs" \
  -H "Content-Type: application/json" \
  -H "access_token: {ACCESS_TOKEN}" \
  -d '{
    "recipient": {
      "user_id": "user_id_123456"
    },
    "message": {
      "text": "Hello! How can I help you?"
    }
  }'
```

**Response**:

```json
{
  "error": 0,
  "message": "Success",
  "data": {
    "message_id": "msg_response_abc123"
  }
}
```

### Sending Media Messages

#### Image

```bash
curl -X POST "https://openapi.zalo.me/v3.0/oa/message/cs" \
  -H "Content-Type: application/json" \
  -H "access_token: {ACCESS_TOKEN}" \
  -d '{
    "recipient": {
      "user_id": "user_id_123456"
    },
    "message": {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "media",
          "elements": [{
            "media_type": "image",
            "url": "https://example.com/image.jpg"
          }]
        }
      }
    }
  }'
```

#### File

```bash
curl -X POST "https://openapi.zalo.me/v3.0/oa/message/cs" \
  -H "Content-Type: application/json" \
  -H "access_token: {ACCESS_TOKEN}" \
  -d '{
    "recipient": {
      "user_id": "user_id_123456"
    },
    "message": {
      "attachment": {
        "type": "file",
        "payload": {
          "token": "file_token_from_upload"
        }
      }
    }
  }'
```

### Interactive Messages (Buttons)

```bash
curl -X POST "https://openapi.zalo.me/v3.0/oa/message/cs" \
  -H "Content-Type: application/json" \
  -H "access_token: {ACCESS_TOKEN}" \
  -d '{
    "recipient": {
      "user_id": "user_id_123456"
    },
    "message": {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text": "Choose an option:",
          "buttons": [
            {
              "type": "oa.query.show",
              "title": "View Products",
              "payload": "view_products"
            },
            {
              "type": "oa.open.url",
              "title": "Visit Website",
              "payload": {
                "url": "https://example.com"
              }
            }
          ]
        }
      }
    }
  }'
```

### Button Types

| Button Type     | Description                              |
| --------------- | ---------------------------------------- |
| `oa.query.show` | Quick reply button (sends payload back)  |
| `oa.open.url`   | Opens URL in browser                     |
| `oa.open.phone` | Opens phone dialer with specified number |
| `oa.open.sms`   | Opens SMS app with pre-filled number     |

### ZBS Template Message (Outside Window)

> **Important**: ZBS templates are part of Zalo Notification Service (ZNS) and have a **different API endpoint**.

**API Endpoint**:

```
POST https://business.openapi.zalo.me/message/template
```

**Request**:

```bash
curl -X POST "https://business.openapi.zalo.me/message/template" \
  -H "Content-Type: application/json" \
  -H "access_token: {ACCESS_TOKEN}" \
  -d '{
    "phone": "84901234567",
    "template_id": "template_123",
    "template_data": {
      "customer_name": "Nguyen Van A",
      "order_id": "ORD-12345",
      "amount": "500,000 VND",
      "status": "Đã giao hàng"
    },
    "tracking_id": "unique_tracking_id_123"
  }'
```

**Response**:

```json
{
  "error": 0,
  "message": "Success",
  "data": {
    "msg_id": "a4d0243feee163bd3af2",
    "sent_time": "1626926349402",
    "quota": {
      "dailyQuota": "500",
      "remainingQuota": "499"
    }
  }
}
```

**Alternative - Send via User ID (UID)** - receives discounted pricing:

```json
{
  "user_id": "zalo_user_id",
  "template_id": "template_123",
  "template_data": {
    "customer_name": "Nguyen Van A",
    "order_id": "ORD-12345"
  },
  "tracking_id": "unique_tracking_id_123"
}
```

> **Note**: ZBS templates can use either phone numbers OR User IDs. Sending via UID receives **subsidized/discounted pricing**.

---

## ZBS Template System (Zalo Notification Service)

### Overview

ZBS (Zalo Business Solutions) Template Messages are pre-approved rich message templates for proactive customer outreach. They are part of ZNS (Zalo Notification Service).

### Template Categories (Tags)

| Tag | Category          | Vietnamese          | Use Cases                                                    |
| --- | ----------------- | ------------------- | ------------------------------------------------------------ |
| 1   | Transaction       | Giao dịch           | OTP, order confirmation, payment notifications, appointments |
| 2   | Customer Care     | Chăm sóc khách hàng | Loyalty points, service updates, policy changes, surveys     |
| 3   | After-sales/Promo | Hậu mãi             | Promotions, discount codes, new service announcements        |

### Template Types

| Template Type     | Description                   | Base Price (VND) |
| ----------------- | ----------------------------- | ---------------- |
| Custom Template   | Flexible format               | 200              |
| Authentication    | OTP/verification codes        | 300              |
| Service Rating    | Customer feedback collection  | 200              |
| Payment Request   | Invoice/payment notifications | 300              |
| Voucher           | Discount codes                | 300              |
| Government/Public | Public service messages       | 120              |

### Pricing Model

**Base Pricing (per message, excluding VAT)**:

| Component                      | Price (VND) |
| ------------------------------ | ----------- |
| Standard template              | 200         |
| Authentication/Payment/Voucher | 300         |
| Government/Public service      | 120         |
| Image attachment               | +200        |
| CTA to Zalo ecosystem (1st)    | FREE        |
| Additional Zalo CTAs           | +100 each   |

**Sending Method Discount**:

- Via Phone Number: Standard price
- Via User ID (UID): **Discounted price** (subsidized by Zalo)

### Template Creation Process

1. **Setup ZBS Account** at https://account.zalo.solutions
2. **Link OA and App** to ZBS account
3. **Create Template** via ZBS Portal:
   - Template name (10-60 characters)
   - Select OA and AppID
   - Choose template type and tag
   - Design content with parameters
   - Add CTA buttons (max 2-3)
4. **Submit for Review** (1-2 business days)
5. **Use Approved Template** via API

### Template Parameter Rules

- No Vietnamese diacritics in parameter names
- No spaces or hyphens (use underscore `_`)
- Format: `<parameter_name>` (e.g., `<customer_name>`, `<order_code>`)

### Template Limits

| Component   | Min | Max | Notes                          |
| ----------- | --- | --- | ------------------------------ |
| Title       | 9   | 65  | Max 4 parameters               |
| Text blocks | 1   | 4   | Max 10 params, 400 chars each  |
| Table rows  | 2   | 8   | 35 chars label, 90 chars value |
| CTA buttons | 0   | 2   | 5-30 chars per button          |
| Image       | -   | 1   | 16:9 ratio, ≤500KB             |
| Logo        | 1   | 1   | 400x96px PNG                   |

### Template Delivery Webhook

When user receives a ZBS template message:

```json
{
  "sender": "oa_id",
  "recipient": "84987654321",
  "event_name": "user_received_message",
  "delivery_time": "1626926350000",
  "msg_id": "a4d0243feee163bd3af2",
  "tracking_id": "unique_tracking_id_123",
  "app_id": "your_app_id",
  "timestamp": "1626926350000"
}
```

### Message Types Supported

| Type         | API Endpoint                                | Within Window | Outside Window |
| ------------ | ------------------------------------------- | ------------- | -------------- |
| Text         | `/v3.0/oa/message/cs`                       | Yes           | No             |
| Image        | `/v3.0/oa/message/cs`                       | Yes           | No             |
| File         | `/v3.0/oa/message/cs`                       | Yes           | No             |
| Audio        | `/v3.0/oa/message/cs`                       | Yes           | No             |
| GIF          | `/v3.0/oa/message/cs`                       | Yes           | No             |
| Sticker      | `/v3.0/oa/message/cs`                       | Yes           | No             |
| Interactive  | `/v3.0/oa/message/cs`                       | Yes           | No             |
| ZBS Template | `business.openapi.zalo.me/message/template` | Yes           | **Yes**        |

---

## Rate Limits

### API Rate Limits

| Endpoint Type | Rate Limit         |
| ------------- | ------------------ |
| Send Message  | 20 requests/second |
| Get User Info | 10 requests/second |
| Upload Media  | 5 requests/second  |

### Messaging Quotas

Message quotas are managed per OA and depend on OA tier:

| OA Type       | Consultation Quota | Transaction Quota |
| ------------- | ------------------ | ----------------- |
| Standard OA   | Based on followers | Based on purchase |
| Verified OA   | Higher limits      | Higher limits     |
| Enterprise OA | Custom             | Custom            |

> **Check quota**: Use `GET /v3.0/oa/quota/message` to check remaining message quota.

---

## OAuth Flow & Credentials Management

> **Reference**: [Zalo OAuth Documentation](https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new)

### Token Types & Lifespans

| Token Type                      | Source         | Lifespan        | Use Case                                     |
| ------------------------------- | -------------- | --------------- | -------------------------------------------- |
| `Authorization Code`            | OAuth redirect | **10 minutes**  | Exchange for tokens (single-use)             |
| `Official_Account_Access_Token` | OAuth flow     | **25 hours**    | API calls on behalf of OA                    |
| `Refresh Token`                 | OAuth flow     | **3 months**    | Refresh access token (single-use, rotates)   |
| `App Secret Key`                | App settings   | Does not expire | OAuth header, token exchange                 |
| `OA Secret Key`                 | OA settings    | Does not expire | Webhook signature verification (per-channel) |

> **Critical Difference from Meta**: Unlike Meta's long-lived Page tokens that **never expire**, Zalo access tokens expire in **25 hours**. You **MUST** implement automatic token refresh logic. However, Zalo's 25-hour window is more generous than the ~1 hour initially documented.

### Key OAuth Concepts (Terminology)

| Term                 | Vietnamese           | Description                                                              |
| -------------------- | -------------------- | ------------------------------------------------------------------------ |
| `Authorization Code` | Mã ủy quyền          | One-time code from OA admin, valid 10 minutes                            |
| `Access Token`       | Mã truy cập          | Token for API calls, valid 25 hours                                      |
| `Refresh Token`      | Mã làm mới           | Token to get new access token, valid 3 months, single-use                |
| `code_verifier`      | Mã xác minh          | Random 43-char string for PKCE (uppercase, lowercase, numbers)           |
| `code_challenge`     | Mã thách thức        | `Base64.encode(SHA-256.hash(ASCII(code_verifier)))` - without padding    |
| `App Secret Key`     | Khóa bí mật ứng dụng | Used in `secret_key` header for token requests                           |
| `OA Secret Key`      | Khóa bí mật của OA   | Per-OA secret for webhook MAC validation (different from App Secret Key) |

### Complete OAuth Flow (PKCE Required)

Zalo uses **PKCE (Proof Key for Code Exchange)** for enhanced security. Unlike Meta's simple OAuth flow, you must generate and store `code_verifier` and `code_challenge`.

#### Step 1: Generate Code Verifier and Code Challenge

```typescript
import crypto from 'crypto';

interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

function generatePKCE(): PKCEPair {
  // Generate code_verifier: 43 chars, uppercase, lowercase, numbers
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let codeVerifier = '';
  const randomBytes = crypto.randomBytes(43);
  for (let i = 0; i < 43; i++) {
    codeVerifier += chars[randomBytes[i] % chars.length];
  }

  // Generate code_challenge: Base64(SHA-256(ASCII(code_verifier))) without padding
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Remove padding

  return { codeVerifier, codeChallenge };
}
```

> **Important PKCE Rules**:
>
> - Use a **different** code_verifier for each authorization request
> - Code verifier must be exactly 43 characters with uppercase, lowercase, and numbers
> - **Never share** code_verifier with third parties - it proves ownership of the authorization code
> - Use `state` parameter or custom `redirect_uri` param to map authorization code back to correct code_verifier

#### Step 2: Generate Authorization URL

```typescript
async function generateZaloAuthUrl(tenantId: string): Promise<string> {
  // Generate PKCE pair
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Generate state for CSRF protection
  const state = `${tenantId}:${crypto.randomUUID()}`;

  // Store code_verifier and state for later verification (10 min TTL)
  await cache.set(
    `zalo:oauth:${state}`,
    {
      tenantId,
      codeVerifier,
    },
    { ttl: 600 }
  ); // 10 minutes (matches authorization code validity)

  const params = new URLSearchParams({
    app_id: config.zaloAppId,
    redirect_uri: config.zaloOAuthCallbackUrl,
    code_challenge: codeChallenge,
    state,
  });

  return `https://oauth.zaloapp.com/v4/oa/permission?${params}`;
}
```

**Authorization URL format**:

```
https://oauth.zaloapp.com/v4/oa/permission?
  app_id={APP_ID}
  &redirect_uri={CALLBACK_URL}
  &code_challenge={CODE_CHALLENGE}
  &state={TENANT_ID}:{NONCE}
```

**User sees**: OA selection screen where they choose which Official Account to authorize and which permissions to grant.

#### Step 3: Handle OAuth Callback

```
GET /oauth/zalo/callback?code={AUTHORIZATION_CODE}&oa_id={OA_ID}&state={STATE}
```

> **Note**: Zalo includes `oa_id` in the callback URL, identifying which OA was authorized.

```typescript
interface ZaloOAuthCallbackParams {
  code: string; // Authorization code (single-use, valid 10 minutes)
  oa_id: string; // OA ID that was authorized
  state: string; // State parameter for CSRF verification
}

async function handleZaloOAuthCallback(params: ZaloOAuthCallbackParams) {
  const { code, oa_id, state } = params;

  // 1. Verify state and retrieve code_verifier
  const stored = await cache.get(`zalo:oauth:${state}`);
  if (!stored) throw new Error('Invalid or expired state');
  await cache.delete(`zalo:oauth:${state}`);

  const { tenantId, codeVerifier } = stored;

  // 2. Exchange authorization code for tokens
  const tokens = await exchangeCodeForTokens(code, codeVerifier);

  // 3. Get OA info for channel name
  const oaInfo = await getOAInfo(tokens.accessToken);

  // 4. Get OA Secret Key for webhook validation
  // Note: OA Secret Key is obtained from Zalo App settings, not API
  // It must be configured manually or retrieved during app setup

  // 5. Store Channel record
  await createChannel({
    tenantId,
    platform: 'zalo',
    platformId: oa_id,
    oaId: oa_id,
    name: oaInfo.name,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    // oaSecretKey: encrypt(oaSecretKey), // From manual configuration
    status: 'active',
  });

  return { success: true, oaId: oa_id, oaName: oaInfo.name };
}
```

#### Step 4: Exchange Authorization Code for Tokens

```bash
curl -X POST "https://oauth.zaloapp.com/v4/oa/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "secret_key: {APP_SECRET_KEY}" \
  --data-urlencode "code={AUTHORIZATION_CODE}" \
  --data-urlencode "app_id={APP_ID}" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code_verifier={CODE_VERIFIER}"
```

**Response** (success):

```json
{
  "access_token": "RfBh5NdqsWzhcX8bDDe_1A463Z34Fhy1GVi63AoTU1InwujqF",
  "refresh_token": "L2Y2BO9Prn_I1SkM08T4J99bZQYVbOBPfTVeRgrLdPK4ZqGX9G",
  "expires_in": "90000"
}
```

> **Note**: `expires_in` is **90000 seconds (25 hours)**, not ~1 hour as previously documented.

**TypeScript Implementation**:

```typescript
interface ZaloTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<ZaloTokenResponse> {
  const response = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: config.zaloAppSecretKey,
    },
    body: new URLSearchParams({
      code,
      app_id: config.zaloAppId,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  // Check for error response
  if (data.error) {
    throw new ZaloOAuthError(data.error, data.message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: parseInt(data.expires_in, 10), // 90000 seconds = 25 hours
  };
}
```

#### Step 5: Use Access Token for API Calls

```typescript
async function sendZaloMessage(
  accessToken: string,
  userId: string,
  text: string
): Promise<string> {
  const response = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: accessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text },
    }),
  });

  const data = await response.json();

  if (data.error !== 0) {
    throw new ZaloApiError(data.error, data.message);
  }

  return data.data.message_id;
}
```

---

## Token Refresh Strategy (Critical!)

### Why Token Refresh is Critical

Unlike Meta's never-expiring Page tokens, Zalo tokens **expire every 25 hours**. Without automatic refresh:

- API calls will fail with error `-216` (invalid token) or `-220` (expired token)
- Customer messages won't be delivered
- Webhooks can still be received but responses can't be sent

### Refresh Token Mechanics

| Aspect                 | Behavior                                                     |
| ---------------------- | ------------------------------------------------------------ |
| Refresh token lifespan | 3 months from issue                                          |
| Single-use             | **Yes** - each refresh returns a NEW refresh token           |
| Access token returned  | New access token (25 hours)                                  |
| Refresh token returned | New refresh token (3 months from NEW issue date)             |
| Chain continuation     | Can continue indefinitely as long as refreshed before expiry |

> **Critical**: Refresh tokens are **single-use**. After a successful refresh, you receive a NEW refresh token that replaces the old one. Store it immediately!

### Refresh Token API

```bash
curl -X POST "https://oauth.zaloapp.com/v4/oa/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "secret_key: {APP_SECRET_KEY}" \
  --data-urlencode "refresh_token={REFRESH_TOKEN}" \
  --data-urlencode "app_id={APP_ID}" \
  --data-urlencode "grant_type=refresh_token"
```

**Response**:

```json
{
  "access_token": "E5sPAxHWmF9aYZeZzPczEcNRtdVIPCD3XyGXw1uLBZ3npsF-MUW",
  "refresh_token": "DCcFKjWctu458dAU2FRbaNRPCcQGZ34zCmUF9aYEcNRtdVIaq",
  "expires_in": "90000"
}
```

### Automatic Token Refresh Implementation

```typescript
interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function refreshZaloTokens(
  currentRefreshToken: string
): Promise<TokenRefreshResult> {
  const response = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: config.zaloAppSecretKey,
    },
    body: new URLSearchParams({
      refresh_token: currentRefreshToken,
      app_id: config.zaloAppId,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new ZaloTokenRefreshError(data.error, data.message);
  }

  const expiresIn = parseInt(data.expires_in, 10);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // NEW refresh token - must store!
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}
```

### Proactive Token Refresh Scheduler

Implement a scheduled job to refresh tokens **before** they expire:

```typescript
// Lambda function triggered by EventBridge every 6 hours
export async function refreshExpiringZaloTokens() {
  // Find channels with tokens expiring in the next 6 hours
  const expiringChannels = await channelRepo.findExpiringTokens({
    platform: 'zalo',
    expiresWithinHours: 6,
  });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const channel of expiringChannels) {
    try {
      const refreshToken = decrypt(channel.refreshToken);
      const newTokens = await refreshZaloTokens(refreshToken);

      // Update channel with new tokens
      await channelRepo.updateTokens(channel.channelId, {
        accessToken: encrypt(newTokens.accessToken),
        refreshToken: encrypt(newTokens.refreshToken),
        tokenExpiresAt: newTokens.expiresAt,
        lastRefreshedAt: new Date(),
      });

      results.success++;

      console.log(`Refreshed Zalo token for channel ${channel.channelId}`);
    } catch (error) {
      results.failed++;
      results.errors.push(`${channel.channelId}: ${error.message}`);

      // Mark channel as requiring reauthorization if refresh fails
      if (isRefreshTokenExpiredError(error)) {
        await channelRepo.updateStatus(channel.channelId, 'requires_reauth');
        // Notify tenant admin
        await notifyChannelReauthRequired(channel);
      }
    }
  }

  return results;
}

function isRefreshTokenExpiredError(error: any): boolean {
  // Refresh token expired or invalid
  return error.code === -216 || error.code === -220;
}
```

### Token Refresh Timeline

```
Day 0: User authorizes OA
       ├── Access Token issued (expires Day 1 + 1h)
       └── Refresh Token issued (expires Day 90)

Day 1: Proactive refresh (6h before expiry)
       ├── NEW Access Token issued (expires Day 2 + 1h)
       └── NEW Refresh Token issued (expires Day 91)

Day 2: Proactive refresh
       ├── NEW Access Token issued (expires Day 3 + 1h)
       └── NEW Refresh Token issued (expires Day 92)

... continues indefinitely as long as refreshed before expiry ...

Day 90: If NO refresh since Day 0
        └── Refresh Token EXPIRED - user must re-authorize!
```

---

## Token Lifecycle & Monitoring

### Token Debugging

Zalo provides a Token Debugger tool:

**URL**: https://developers.zalo.me/tools/token-debugger

Use this tool to:

- Check if a token is valid
- See token permissions (scopes)
- Identify why a token might be failing

### Proactive Token Health Checks

```typescript
interface TokenHealthStatus {
  isValid: boolean;
  expiresIn: number | null;
  requiresRefresh: boolean;
  requiresReauth: boolean;
  error?: string;
}

async function checkZaloTokenHealth(
  channel: Channel
): Promise<TokenHealthStatus> {
  const accessToken = decrypt(channel.accessToken);

  try {
    // Make a lightweight API call to verify token
    const response = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
      headers: { access_token: accessToken },
    });

    const data = await response.json();

    if (data.error === 0) {
      const hoursUntilExpiry = Math.floor(
        (channel.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
      );

      return {
        isValid: true,
        expiresIn: hoursUntilExpiry,
        requiresRefresh: hoursUntilExpiry < 6, // Refresh if less than 6 hours
        requiresReauth: false,
      };
    }

    // Token invalid or expired
    if (data.error === -216 || data.error === -220) {
      return {
        isValid: false,
        expiresIn: null,
        requiresRefresh: true,
        requiresReauth: false, // Try refresh first
        error: data.message,
      };
    }

    return {
      isValid: false,
      expiresIn: null,
      requiresRefresh: false,
      requiresReauth: true, // Unknown error - might need reauth
      error: data.message,
    };
  } catch (error) {
    return {
      isValid: false,
      expiresIn: null,
      requiresRefresh: false,
      requiresReauth: true,
      error: error.message,
    };
  }
}
```

### Token Invalidation Scenarios

Zalo tokens can become invalid in these scenarios:

| Scenario                         | Effect                      | Detection        | Recovery                  |
| -------------------------------- | --------------------------- | ---------------- | ------------------------- |
| Access token expired (25h)       | API calls fail              | Error -220       | Use refresh token         |
| Refresh token expired (3 months) | Cannot get new access token | Refresh fails    | User must re-authorize    |
| OA admin revokes app permission  | All tokens invalidated      | Error -216, -220 | User must re-authorize    |
| App disabled/removed             | All tokens invalidated      | Error -219       | Fix app settings          |
| OA disabled/deleted              | Tokens unusable             | Error -204, -205 | N/A - OA no longer exists |
| User changed Zalo password       | May invalidate tokens       | API errors       | Try refresh, then reauth  |

---

## Error Handling Strategy

### Token-Related Error Codes

| Error Code | Message                                      | Description                                | Recovery Action                        |
| ---------- | -------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| -216       | Access token is invalid                      | Token malformed, revoked, or never valid   | Try refresh token, else re-authorize   |
| -220       | access_token is expired or removed           | Token expired (past 25h) or was revoked    | Use refresh token to get new one       |
| -219       | App is removed or disabled                   | Zalo App is disabled in developer settings | Re-enable app, check admin permissions |
| -223       | Official Account has not authorized this API | OA hasn't granted required permission      | Request re-authorization with scope    |

### Graceful Error Handling Implementation

```typescript
class ZaloApiClient {
  private channel: Channel;
  private onTokenRefreshed: (tokens: TokenRefreshResult) => Promise<void>;

  async callApi<T>(endpoint: string, options: RequestInit): Promise<T> {
    let accessToken = decrypt(this.channel.accessToken);

    // Attempt API call
    let response = await this.makeRequest(endpoint, accessToken, options);
    let data = await response.json();

    // Handle token expiration with automatic retry
    if (data.error === -216 || data.error === -220) {
      console.log(
        `Zalo token expired for channel ${this.channel.channelId}, refreshing...`
      );

      try {
        // Attempt token refresh
        const refreshToken = decrypt(this.channel.refreshToken);
        const newTokens = await refreshZaloTokens(refreshToken);

        // Notify caller to persist new tokens
        await this.onTokenRefreshed(newTokens);

        // Update local token reference
        accessToken = newTokens.accessToken;

        // Retry the original request with new token
        response = await this.makeRequest(endpoint, accessToken, options);
        data = await response.json();

        if (data.error !== 0) {
          throw new ZaloApiError(data.error, data.message);
        }
      } catch (refreshError) {
        // Refresh failed - channel needs re-authorization
        throw new ZaloReauthorizationRequired(
          this.channel.channelId,
          refreshError.message
        );
      }
    }

    if (data.error !== 0) {
      throw new ZaloApiError(data.error, data.message);
    }

    return data;
  }

  private async makeRequest(
    endpoint: string,
    accessToken: string,
    options: RequestInit
  ): Promise<Response> {
    return fetch(`https://openapi.zalo.me${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        access_token: accessToken,
      },
    });
  }
}
```

---

## Credentials Storage

### What to Store Per Channel

```typescript
interface ZaloChannel extends Channel {
  platform: 'zalo';
  platformId: string; // OA ID
  oaId: string; // Same as platformId (for clarity)

  // OAuth Credentials (KMS Encrypted)
  accessToken: string; // Encrypted Official_Account_Access_Token
  refreshToken: string; // Encrypted refresh token (CRITICAL - rotates!)
  tokenExpiresAt: Date; // When access token expires (25h from issue)

  // Webhook Security (KMS Encrypted)
  oaSecretKey: string; // Encrypted OA Secret Key for MAC validation

  // Metadata
  lastRefreshedAt?: Date; // When tokens were last refreshed
  refreshFailureCount?: number; // Track consecutive refresh failures
}
```

### KMS Encryption Implementation

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({});
const KMS_KEY_ID = process.env.KMS_KEY_ID!;

async function encryptToken(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext),
  });
  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

async function decryptToken(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  });
  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}
```

### Obtaining OA Secret Key

The OA Secret Key is required for webhook signature validation and is different from the App Secret Key:

| Key Type       | Purpose                          | Scope    | Where to Find                     |
| -------------- | -------------------------------- | -------- | --------------------------------- |
| App Secret Key | OAuth token requests (header)    | App-wide | Zalo App Settings > Basic Info    |
| OA Secret Key  | Webhook MAC signature validation | Per-OA   | Zalo App Settings > OA Connection |

**Steps to obtain OA Secret Key**:

1. Go to https://developers.zalo.me/app/{APP_ID}/oa/settings
2. Link your Zalo App to the Official Account
3. After linking, the OA Secret Key is displayed
4. Copy and store encrypted in your database (per-channel)

> **Important**: Each OA has its own unique secret key. Store it per-channel, not app-wide.

---

## Error Codes

### Complete Error Code Reference

| Error Code | Message                                              | Description (Vietnamese)                            | Recovery Action                               |
| ---------- | ---------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| 0          | Success                                              | Request thành công                                  | N/A                                           |
| -32        | Your application reached limit call api              | Vượt quá giới hạn tốc độ request/phút               | Implement rate limiting, back off             |
| -100       | attachment_id was expired                            | attachment_id đã hết hạn                            | Re-upload attachment                          |
| -200       | Send message failed                                  | Gửi tin nhắn thất bại                               | Check message format and recipient            |
| -201       | \<data_field\> is invalid!                           | Tham số không hợp lệ                                | Check request parameters                      |
| -204       | Official Account is disable                          | Official Account đã bị xóa                          | OA no longer exists                           |
| -205       | Official Account is not exist                        | Official Account không tồn tại                      | Check OA ID                                   |
| -209       | Not supported this api                               | API không được hỗ trợ (app chưa kích hoạt)          | Activate app in settings                      |
| -210       | Parameter exceeds allowable limit                    | Tham số vượt quá giới hạn cho phép                  | Check parameter limits                        |
| -211       | Out of quota                                         | Vượt quá quota sử dụng                              | Check message quota, wait or upgrade          |
| -212       | App has not registered this api                      | OA chưa đăng ký API này                             | Register API in app settings                  |
| -213       | User has not followed OA                             | Người dùng chưa quan tâm OA                         | User must follow OA first                     |
| -214       | Article is being processed                           | Bài viết đang được xử lý                            | Wait and retry                                |
| **-216**   | **Access token is invalid**                          | **Access token không hợp lệ**                       | **Try refresh token, else re-authorize**      |
| -217       | User has blocked invitation from OA                  | Người dùng đã chặn tin mời quan tâm                 | Cannot send invitations to this user          |
| -218       | Out of quota receive                                 | Đã quá giới hạn gửi đến người dùng này              | User receiving limit reached                  |
| -219       | App is removed or disabled                           | Ứng dụng đã bị gỡ bỏ hoặc vô hiệu hóa               | Re-enable app in developer settings           |
| **-220**   | **access_token is expired or removed**               | **access_token đã hết hạn hoặc không còn khả dụng** | **Use refresh token to get new access token** |
| -221       | The OA needs to be verified to use this feature      | OA chưa xác thực                                    | Submit OA verification                        |
| -223       | Official Account has not authorized this API         | OA chưa cấp quyền cho ứng dụng                      | Request re-authorization with required scopes |
| -224       | The OA needs to upgrade OA Tier Package              | OA chưa mua gói dịch vụ                             | Upgrade OA tier package                       |
| -227       | User is banned or inactive for more than 45 days     | Tài khoản người dùng bị khóa hoặc không online >45d | Cannot reach this user                        |
| -230       | User has not interacted with OA in past 7 days       | Người dùng không tương tác với OA trong 7 ngày      | Outside messaging window - use ZBS template   |
| -232       | User has not interacted, or last interaction expired | Người dùng chưa phát sinh tương tác                 | Outside messaging window - use ZBS template   |
| -233       | message type is invalid or not support               | Loại tin nhắn không được hỗ trợ                     | Check message type                            |
| -234       | Message cannot be sent at night (10PM - 6AM)         | Tin nhắn truyền thông không được gửi ban đêm        | Send during allowed hours                     |
| -235       | This API does not support this type of OA            | API không hỗ trợ loại OA này                        | Check OA type and API requirements            |
| -237       | The group is disabled                                | Nhóm chat GMF đã hết hạn                            | Renew GMF group service                       |
| -238       | asset_id is already used / disabled                  | asset_id đã được sử dụng hoặc không còn khả dụng    | Check asset_id availability                   |
| -240       | MessageV2 API has been shut down                     | API gửi tin V2 đã ngừng hoạt động                   | Migrate to V3 API                             |
| -241       | asset_id is already used (free tier)                 | asset_id miễn phí đã được sử dụng                   | Use different asset_id                        |
| -242       | Invalid appsecret_proof provided                     | appsecret_proof không hợp lệ                        | Fix appsecret_proof generation                |
| -244       | User has restricted this message type from your OA   | Người dùng đã hạn chế nhận loại tin này             | Cannot send this message type to user         |
| -248       | Violates platform standards                          | Vi phạm tiêu chuẩn nền tảng                         | Review content policy                         |
| -320       | App needs Zalo Cloud Account connection              | Ứng dụng cần kết nối với ZCA                        | Link app to Zalo Cloud Account                |
| -321       | Zalo Cloud Account out of money                      | ZCA hết tiền hoặc không thể trả phí                 | Top up ZCA balance                            |
| -403       | OA is not in group                                   | OA không sở hữu nhóm chat này                       | Check GMF group ownership                     |

### Error Handling by Category

#### Token Errors (Requires Immediate Action)

```typescript
const TOKEN_ERRORS = [-216, -220];

function isTokenError(errorCode: number): boolean {
  return TOKEN_ERRORS.includes(errorCode);
}

async function handleTokenError(channel: Channel, errorCode: number) {
  if (errorCode === -216 || errorCode === -220) {
    // Attempt token refresh
    try {
      const newTokens = await refreshZaloTokens(decrypt(channel.refreshToken));
      await updateChannelTokens(channel.channelId, newTokens);
      return { action: 'retry' };
    } catch (refreshError) {
      // Refresh failed - needs re-authorization
      await markChannelForReauth(channel.channelId);
      return { action: 'reauth_required' };
    }
  }
}
```

#### Messaging Window Errors

```typescript
const WINDOW_ERRORS = [-230, -232];

function isMessagingWindowError(errorCode: number): boolean {
  return WINDOW_ERRORS.includes(errorCode);
}

// When window error occurs, check if ZBS template can be used
async function handleWindowError(channel: Channel, userId: string) {
  // Cannot send consultation message - suggest ZBS template
  return {
    action: 'use_template',
    message:
      'User outside 7-day messaging window. Use ZBS Template Message instead.',
  };
}
```

---

## Architecture Compatibility

### What Works Without Changes

| Component           | Compatibility                       |
| ------------------- | ----------------------------------- |
| DynamoDB model      | Channel, Conversation, Message work |
| EventBridge events  | Same event pattern                  |
| SQS queue buffering | Works (but faster response needed)  |
| Platform adapter    | New adapter for Zalo                |

### Required Adaptations

| Component            | Adaptation Needed                                      |
| -------------------- | ------------------------------------------------------ |
| Webhook endpoint     | Separate `/webhooks/zalo` (different signature scheme) |
| Response time        | Must respond in 2s (vs 5s for Meta) - SQS critical     |
| Webhook parser       | New parser for Zalo event format                       |
| Channel lookup       | Query by OA ID                                         |
| Messaging window     | 7-day window with 48h free tier                        |
| Signature validation | MAC validation (different from HMAC-SHA256)            |
| Template support     | ZBS templates (different from WhatsApp templates)      |

### Platform Adapter Implementation

```typescript
// platforms/zalo/adapter.ts
const zaloAdapter: PlatformAdapter = {
  platform: 'zalo',

  parseWebhook(payload: ZaloWebhookPayload): NormalizedMessage[] {
    // Extract event_name to determine message type
    // Normalize to unified format
  },

  sendMessage(channel: Channel, message: OutboundMessage): Promise<SendResult> {
    // POST to openapi.zalo.me/v3.0/oa/message/cs
    // Handle consultation vs ZBS template
  },

  verifyWebhook(rawBody: Buffer, headers: Headers): boolean {
    // MAC validation with OA Secret Key
    const signature = headers.get('X-ZEvent-Signature');
    const timestamp = headers.get('timestamp');
    // Verify MAC
  },

  // Messaging window - KEY DIFFERENCE
  canSendRegularMessage(conversation: Conversation): boolean {
    const hoursSince = getHoursSince(conversation.lastCustomerMessageAt);
    return hoursSince <= 168; // 7 days for Zalo
  },

  getMessagingWindowHours(): number {
    return 168; // 7 days (vs 24 for Meta platforms)
  },

  getFreeWindowHours(): number {
    return 48; // 48 hours free, then paid until 7 days
  },

  supportsTemplates(): boolean {
    return true; // ZBS templates
  },

  supportsMessageTags(): boolean {
    return false; // Zalo doesn't have message tags like Messenger
  },
};
```

---

## Implementation Considerations

### 2-Second Webhook Response

Zalo requires webhook responses within 2 seconds (stricter than Meta's 5 seconds). This makes SQS buffering even more critical:

```typescript
// Webhook handler - respond immediately
export async function handleZaloWebhook(event: APIGatewayEvent) {
  // 1. Verify signature (fast)
  if (!verifyZaloSignature(event)) {
    return { statusCode: 403 };
  }

  // 2. Send to SQS immediately (don't process)
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: WEBHOOK_QUEUE_URL,
      MessageBody: JSON.stringify({
        platform: 'zalo',
        payload: event.body,
        headers: event.headers,
      }),
    })
  );

  // 3. Return 200 immediately
  return { statusCode: 200 };
}
```

### 7-Day Messaging Window

The longer window simplifies customer service but adds complexity:

1. **Track window state**: Need to know if in free (0-48h) or paid (48h-7d) period
2. **Cost awareness**: UI should indicate when messages will incur charges
3. **Template fallback**: After 7 days, must use ZBS templates (different API)

### Idempotency

Zalo's retry window is shorter (~1.8 hours max), but still need idempotency:

```typescript
// Use msg_id for idempotency
async function processZaloMessage(payload: ZaloWebhookPayload) {
  const msgId = payload.message?.msg_id;
  if (!msgId) return; // Not a message event

  const existing = await messageRepo.getByPlatformMsgId(msgId);
  if (existing) {
    console.log(`Duplicate Zalo message ${msgId}, skipping`);
    return;
  }

  // Process message...
}
```

### ZBS Template Management

ZBS (Zalo Business Services) templates are the equivalent of WhatsApp's HSM templates:

1. **Create template** via ZBS Portal (https://account.zalo.solutions)
2. **Submit for review** (1-2 business days for approval)
3. **Use for proactive messaging** outside 7-day window
4. **Templates support both phone numbers AND User IDs** (UID gets discounted pricing)

**Key Differences from WhatsApp Templates**:

| Aspect       | WhatsApp Templates | Zalo ZBS Templates                  |
| ------------ | ------------------ | ----------------------------------- |
| API Endpoint | Same Graph API     | Separate `business.openapi.zalo.me` |
| Identifier   | Phone number only  | Phone OR User ID (UID)              |
| Pricing      | Per conversation   | Per message + components            |
| Review Time  | Up to 24 hours     | 1-2 business days                   |
| CTA Support  | Limited            | Rich (call, URL, SMS, Mini App)     |

> **Note**: ZBS templates are part of ZNS (Zalo Notification Service) and may require a separate ZBS account and contract.

---

## References

### Official Documentation

- [Zalo OA API Overview](https://developers.zalo.me/docs/official-account/bat-dau/kham-pha) - Main entry point
- [Webhook Documentation](https://developers.zalo.me/docs/official-account/webhook/tong-quan) - Webhook setup
- [Messaging Overview](https://developers.zalo.me/docs/official-account/tin-nhan/tong-quan) - Message types
- [Authentication Guide](https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new) - OAuth flow

### API Reference

- [Send Consultation Message](https://developers.zalo.me/docs/official-account/tin-nhan/tin-tu-van/gui-tin-tu-van) - CS message API
- [ZNS Template API](https://developers.zalo.me/docs/zalo-notification-service) - Template message API

### Tools

- [API Explorer](https://developers.zalo.me/tools/explorer) - Test API calls
- [Token Debugger](https://developers.zalo.me/tools/token-debugger) - Debug access tokens

### Support

- [Zalo Developer Community](https://developers.zalo.me/community) - Q&A forum
- [Zalo FAQs](https://developers.zalo.me/faq) - Common questions
