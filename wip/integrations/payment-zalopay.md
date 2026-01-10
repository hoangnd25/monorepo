# ZaloPay Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `payment-zalopay`
> **Category**: Payment

## Overview

ZaloPay is a leading e-wallet and payment platform in Vietnam, operated by VNG Corporation. It provides a comprehensive payment gateway for merchants to accept payments via QR codes, bank transfers (VietQR), credit/debit cards, and the ZaloPay wallet.

**API Documentation**: [https://docs.zalopay.vn](https://docs.zalopay.vn)
**Merchant Portal**: [https://mc.zalopay.vn](https://mc.zalopay.vn)

---

## Authentication Model

ZaloPay uses a **dual-key signing** authentication model:

| Credential | Description                                       | Obtained From                      |
| ---------- | ------------------------------------------------- | ---------------------------------- |
| `app_id`   | Application ID assigned to merchant               | ZaloPay Merchant Portal (App Info) |
| `key1`     | Secret key for signing outbound API requests      | ZaloPay Merchant Portal (App Info) |
| `key2`     | Secret key for verifying inbound webhook/callback | ZaloPay Merchant Portal (App Info) |

### Key Characteristics

- **No OAuth**: HMAC-SHA256 signature-based authentication
- **Dual Keys**: `key1` for signing requests, `key2` for verifying callbacks
- **Request Signing**: Each request requires `mac` field with HMAC-SHA256 signature
- **No Expiration**: Keys don't expire unless manually rotated

### Request Signature Format

```
mac = HMAC_SHA256(key1, data_string)
```

Data string format varies by endpoint (documented per API).

---

## Environments

| Environment | API Gateway                        | Merchant Portal           |
| ----------- | ---------------------------------- | ------------------------- |
| Sandbox     | `https://sb-openapi.zalopay.vn/v2` | `https://sbmc.zalopay.vn` |
| Production  | `https://openapi.zalopay.vn/v2`    | `https://mc.zalopay.vn`   |

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "payment-zalopay",
  "category": "payment",
  "name": "ZaloPay Payment Gateway",
  "description": "Accept payments via ZaloPay wallet, QR codes, bank transfers, and cards",
  "provider": "VNG Corporation",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["appId", "key1", "key2"],
    "properties": {
      "appId": {
        "type": "string",
        "title": "App ID",
        "description": "Your ZaloPay Application ID from the merchant portal"
      },
      "key1": {
        "type": "string",
        "title": "Key 1 (Request Signing)",
        "description": "Secret key for signing API requests",
        "format": "password"
      },
      "key2": {
        "type": "string",
        "title": "Key 2 (Callback Verification)",
        "description": "Secret key for verifying callback/webhook signatures",
        "format": "password"
      },
      "environment": {
        "type": "string",
        "title": "Environment",
        "enum": ["sandbox", "production"],
        "default": "sandbox",
        "description": "API environment to use"
      },
      "callbackUrl": {
        "type": "string",
        "title": "Callback URL",
        "description": "URL to receive payment notifications (IPN)",
        "format": "uri"
      }
    }
  },
  "credentialFields": ["key1", "key2"],
  "configFields": ["appId", "environment", "callbackUrl"]
}
```

### Customer Connection Flow

To connect their ZaloPay merchant account, tenants need to:

1. **Create ZaloPay Merchant Account**:
   - Sandbox: Register at `sbmc.zalopay.vn` for testing
   - Production: Register at `mc.zalopay.vn` (requires business verification)

2. **Get API Credentials**:
   - Login to merchant portal
   - Navigate to "App Info" or "Application" section
   - Copy `App ID`, `Key 1`, and `Key 2`

3. **Configure Callback URL**:
   - In merchant portal, set the callback URL to receive payment notifications
   - Our system will provide a unique callback URL per tenant

4. **Enter in Our System**: Input credentials in our connection setup UI

### Credential Storage

| Field         | Storage Location  | Notes                              |
| ------------- | ----------------- | ---------------------------------- |
| `appId`       | DynamoDB (config) | Non-sensitive, used in API calls   |
| `key1`        | Secrets Manager   | Encrypted, for signing requests    |
| `key2`        | Secrets Manager   | Encrypted, for verifying callbacks |
| `environment` | DynamoDB (config) | Determines API endpoint            |
| `callbackUrl` | DynamoDB (config) | Webhook endpoint                   |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                   | Use Case                                     |
| -------- | ---------------------- | -------------------------------------------- |
| High     | `create_payment_order` | Create payment request (with confirmation)   |
| High     | `query_payment_status` | Check if payment was completed               |
| Medium   | `create_refund`        | Process refund for paid order (confirmation) |
| Low      | `query_refund_status`  | Check refund processing status               |

---

### 1. Create Payment Order (High Priority)

**API Endpoint:** `POST /create`

**Use Case:** AI agent creating a payment request for customer to pay. Returns QR code and payment URLs.

**Tool Definition:**

```json
{
  "actionId": "create_payment_order",
  "name": "Create ZaloPay Payment Order",
  "description": "Create a new payment order and get QR code/payment URL. Use when customer wants to pay for an order. IMPORTANT: This creates a real payment request - confirm amount with customer before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["amount", "orderId", "orderInfo"],
    "properties": {
      "amount": {
        "type": "integer",
        "description": "Payment amount in VND (minimum 1,000 VND)",
        "minimum": 1000
      },
      "orderId": {
        "type": "string",
        "description": "Unique order ID from your system (max 40 chars, alphanumeric + _)",
        "maxLength": 40,
        "pattern": "^[a-zA-Z0-9_]+$"
      },
      "orderInfo": {
        "type": "string",
        "description": "Order description shown to customer (max 256 chars)",
        "maxLength": 256
      },
      "redirectUrl": {
        "type": "string",
        "description": "URL to redirect customer after payment (optional)",
        "format": "uri"
      },
      "embedData": {
        "type": "object",
        "description": "Additional data to embed (returned in callback)",
        "properties": {
          "promotioninfo": { "type": "string" },
          "merchantinfo": { "type": "string" }
        }
      },
      "items": {
        "type": "array",
        "description": "List of items in the order (for display purposes)",
        "items": {
          "type": "object",
          "properties": {
            "itemid": { "type": "string", "description": "Item ID/SKU" },
            "itemname": { "type": "string", "description": "Item name" },
            "itemprice": {
              "type": "integer",
              "description": "Unit price in VND"
            },
            "itemquantity": { "type": "integer", "description": "Quantity" }
          }
        }
      },
      "bankCode": {
        "type": "string",
        "description": "Force specific payment method (optional)",
        "enum": ["zalopayapp", "CC", "ATM", ""]
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Whether order was created"
      },
      "transactionId": {
        "type": "string",
        "description": "ZaloPay transaction token (zp_trans_token)"
      },
      "orderId": {
        "type": "string",
        "description": "Your order ID (app_trans_id)"
      },
      "orderUrl": {
        "type": "string",
        "description": "URL for web payment (redirect customer here)"
      },
      "qrCodeData": {
        "type": "string",
        "description": "QR code data string (use to generate QR image)"
      },
      "expiryTime": {
        "type": "string",
        "description": "Payment expiry time (15 minutes from creation)",
        "format": "date-time"
      },
      "amount": { "type": "integer", "description": "Payment amount in VND" }
    }
  }
}
```

**API Request Details:**

```
POST /v2/create
Content-Type: application/x-www-form-urlencoded

app_id={app_id}
&app_user={user_id}
&app_trans_id={YYMMDD}_{order_id}
&app_time={unix_timestamp_ms}
&amount={amount}
&item={json_items}
&description={order_info}
&embed_data={json_embed}
&bank_code={bank_code}
&callback_url={callback_url}
&redirect_url={redirect_url}
&mac={hmac_sha256}
```

MAC calculation:

```
mac = HMAC_SHA256(key1, app_id|app_trans_id|app_user|amount|app_time|embed_data|item)
```

---

### 2. Query Payment Status (High Priority)

**API Endpoint:** `POST /query`

**Use Case:** AI agent checking if customer has completed payment.

**Tool Definition:**

```json
{
  "actionId": "query_payment_status",
  "name": "Query ZaloPay Payment Status",
  "description": "Check the status of a payment order. Use when customer asks about payment status or to verify payment was received.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Your order ID (app_trans_id) to check"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Whether query was successful"
      },
      "orderId": { "type": "string", "description": "Your order ID" },
      "transactionId": {
        "type": "string",
        "description": "ZaloPay transaction ID (zp_trans_id)"
      },
      "status": {
        "type": "string",
        "enum": ["pending", "success", "failed", "refunded"],
        "description": "Payment status"
      },
      "statusCode": {
        "type": "integer",
        "description": "ZaloPay return code (1=success, 2=failed, 3=pending)"
      },
      "amount": { "type": "integer", "description": "Payment amount in VND" },
      "paidAt": {
        "type": "string",
        "description": "Payment completion time (if paid)",
        "format": "date-time"
      },
      "paymentMethod": {
        "type": "string",
        "description": "Payment method used (if paid)"
      },
      "discountAmount": {
        "type": "integer",
        "description": "Discount amount applied"
      }
    }
  }
}
```

**API Request Details:**

```
POST /v2/query
Content-Type: application/x-www-form-urlencoded

app_id={app_id}
&app_trans_id={order_id}
&mac={hmac_sha256}
```

MAC calculation:

```
mac = HMAC_SHA256(key1, app_id|app_trans_id|key1)
```

---

### 3. Create Refund (Medium Priority)

**API Endpoint:** `POST /refund`

**Use Case:** AI agent processing refund for a completed payment.

**Tool Definition:**

```json
{
  "actionId": "create_refund",
  "name": "Create ZaloPay Refund",
  "description": "Process a refund for a completed payment. Can do full or partial refund. IMPORTANT: This processes a real refund - confirm with customer before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["transactionId", "amount", "description"],
    "properties": {
      "transactionId": {
        "type": "string",
        "description": "ZaloPay transaction ID (zp_trans_id) from the original payment"
      },
      "amount": {
        "type": "integer",
        "description": "Refund amount in VND (can be partial, must be <= original amount)",
        "minimum": 1000
      },
      "description": {
        "type": "string",
        "description": "Reason for refund (max 256 chars)",
        "maxLength": 256
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Whether refund was initiated"
      },
      "refundId": {
        "type": "string",
        "description": "Refund transaction ID (m_refund_id)"
      },
      "status": {
        "type": "string",
        "enum": ["processing", "success", "failed"],
        "description": "Refund status"
      },
      "statusCode": {
        "type": "integer",
        "description": "ZaloPay return code (1=processing, 2=success, 3=failed)"
      },
      "amount": { "type": "integer", "description": "Refund amount in VND" }
    }
  }
}
```

**API Request Details:**

```
POST /v2/refund
Content-Type: application/x-www-form-urlencoded

app_id={app_id}
&m_refund_id={YYMMDD}_{app_id}_{uuid}
&timestamp={unix_timestamp_ms}
&zp_trans_id={original_transaction_id}
&amount={refund_amount}
&description={reason}
&mac={hmac_sha256}
```

MAC calculation:

```
mac = HMAC_SHA256(key1, app_id|zp_trans_id|amount|description|timestamp)
```

---

### 4. Query Refund Status (Low Priority)

**API Endpoint:** `POST /query_refund`

**Use Case:** AI agent checking refund processing status.

**Tool Definition:**

```json
{
  "actionId": "query_refund_status",
  "name": "Query ZaloPay Refund Status",
  "description": "Check the status of a refund request. Use when customer asks about refund status.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["refundId"],
    "properties": {
      "refundId": {
        "type": "string",
        "description": "Refund ID (m_refund_id) from create_refund response"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Whether query was successful"
      },
      "refundId": { "type": "string", "description": "Refund transaction ID" },
      "status": {
        "type": "string",
        "enum": ["processing", "success", "failed"],
        "description": "Refund status"
      },
      "statusCode": {
        "type": "integer",
        "description": "ZaloPay return code"
      },
      "amount": { "type": "integer", "description": "Refund amount" },
      "processedAt": {
        "type": "string",
        "description": "When refund was processed (if completed)",
        "format": "date-time"
      }
    }
  }
}
```

---

## Payment Methods

ZaloPay supports multiple payment methods that can be specified via `bank_code`:

| Bank Code    | Payment Method      | Description                      |
| ------------ | ------------------- | -------------------------------- |
| (empty)      | All Methods         | Customer chooses on ZaloPay page |
| `zalopayapp` | ZaloPay Wallet      | Pay from ZaloPay balance         |
| `CC`         | International Cards | Visa/Mastercard/JCB credit cards |
| `ATM`        | Domestic ATM Cards  | Vietnamese bank ATM/debit cards  |
| (varies)     | Specific Bank       | Direct bank transfer (VietQR)    |

### VietQR Support

ZaloPay generates VietQR-compatible QR codes. The `qr_code` field in create response contains the QR data string that can be:

- Rendered as QR image for customer to scan
- Used with banking apps that support VietQR
- Valid for 15 minutes from creation

---

## Status Codes Reference

### Payment Status (`return_code`)

| Code | Status  | Description                    |
| ---- | ------- | ------------------------------ |
| 1    | Success | Payment completed successfully |
| 2    | Failed  | Payment failed or cancelled    |
| 3    | Pending | Payment not yet completed      |

### Refund Status (`return_code`)

| Code | Status     | Description                   |
| ---- | ---------- | ----------------------------- |
| 1    | Processing | Refund is being processed     |
| 2    | Success    | Refund completed successfully |
| 3    | Failed     | Refund failed                 |

### Common Error Codes

| Code | Description           | Action                           |
| ---- | --------------------- | -------------------------------- |
| -49  | Invalid MAC signature | Check key1 and signature logic   |
| -50  | Invalid request       | Check required parameters        |
| -51  | Invalid app_id        | Verify app_id in config          |
| -52  | Invalid amount        | Amount must be >= 1000 VND       |
| -53  | Duplicate transaction | Order ID already used            |
| -54  | Order expired         | QR/payment link expired (15 min) |
| -55  | Order not found       | Invalid order ID                 |

---

## Webhook/Callback Support (Inbound)

ZaloPay sends POST callbacks when payment status changes.

### Callback Configuration

- Set `callback_url` when creating payment order
- Our service provides a tenant-specific callback URL
- ZaloPay retries up to 5 times with exponential backoff

### Callback Payload

```json
{
  "data": "{\"app_id\":123,\"app_trans_id\":\"210110_order123\",\"app_time\":1610240000000,\"app_user\":\"user\",\"amount\":50000,\"embed_data\":\"{}\",\"item\":\"[]\",\"zp_trans_id\":123456789,\"server_time\":1610240100000,\"channel\":36,\"merchant_user_id\":\"user123\"}",
  "mac": "abc123def456...",
  "type": 1
}
```

### Callback Verification

```javascript
const dataStr = callbackBody.data;
const reqMac = callbackBody.mac;

// Verify signature using key2
const calculatedMac = crypto
  .createHmac('sha256', key2)
  .update(dataStr)
  .digest('hex');

if (reqMac !== calculatedMac) {
  // Invalid callback - reject
  return { return_code: -1, return_message: 'mac not equal' };
}

// Valid callback - process payment
const data = JSON.parse(dataStr);
// Update order status based on data.zp_trans_id
return { return_code: 1, return_message: 'success' };
```

### Callback Response

Return JSON response:

```json
{
  "return_code": 1,
  "return_message": "success"
}
```

| return_code | Meaning                                  |
| ----------- | ---------------------------------------- |
| 1           | Success - ZaloPay will stop retrying     |
| 2           | Failed - ZaloPay will retry              |
| -1          | Invalid MAC - ZaloPay will stop retrying |

---

## Error Handling

| Error Scenario       | Detection             | Recommended Action                  |
| -------------------- | --------------------- | ----------------------------------- |
| Invalid credentials  | return_code = -51     | Ask tenant to verify app_id/keys    |
| Invalid signature    | return_code = -49     | Check key1 and signature algorithm  |
| Order already exists | return_code = -53     | Use unique order ID per transaction |
| Payment expired      | return_code = -54     | Create new payment order            |
| Insufficient balance | Payment failed status | Ask customer to add funds           |
| Network timeout      | HTTP timeout          | Retry with exponential backoff      |
| Amount too low       | return_code = -52     | Minimum 1,000 VND                   |

---

## Rate Limiting

ZaloPay doesn't publish specific rate limits, but recommended limits:

| Action               | Recommended Limit          |
| -------------------- | -------------------------- |
| Create payment order | 60 requests/minute/tenant  |
| Query payment status | 120 requests/minute/tenant |
| Create refund        | 30 requests/minute/tenant  |
| Query refund status  | 60 requests/minute/tenant  |

---

## Example AI Agent Conversations

### Scenario 1: Create Payment for Order

```
Customer: "I want to pay for my order #12345, total is 150,000 VND"

AI Agent: I'll create a payment request for your order. Let me confirm:
- Order: #12345
- Amount: 150,000 VND

Should I proceed with generating the payment QR code?

Customer: "Yes, please"

AI Agent: [Uses create_payment_order tool with confirmation]

Response: "I've created your payment request! You have 15 minutes to complete payment.

📱 **Scan QR Code**: [QR Code Image]
🔗 **Or click to pay**: [Payment Link]

Payment methods accepted:
- ZaloPay wallet
- Bank transfer (VietQR)
- Credit/Debit cards

I'll notify you once payment is received!"
```

### Scenario 2: Check Payment Status

```
Customer: "Did my payment for order #12345 go through?"

AI Agent: [Uses query_payment_status tool]

Response: "Great news! Your payment for order #12345 has been completed successfully!

✅ **Status**: Paid
💰 **Amount**: 150,000 VND
⏰ **Paid at**: 10:35 AM today
💳 **Method**: ZaloPay Wallet

Your order is now being processed. Is there anything else I can help with?"
```

### Scenario 3: Payment Still Pending

```
Customer: "What's the status of my payment?"

AI Agent: [Uses query_payment_status tool]

Response: "Your payment for order #12345 is still pending.

⏳ **Status**: Waiting for payment
💰 **Amount**: 150,000 VND
⏰ **Expires**: 10:50 AM (5 minutes remaining)

Would you like me to:
1. Generate a new QR code (if this one expired)
2. Help you complete the payment

Let me know how I can assist!"
```

### Scenario 4: Process Refund

```
Customer: "I need a refund for order #12345, I ordered the wrong item"

AI Agent: I understand you'd like a refund. Let me check your order...

[Checks order status]

I found your payment:
- Order: #12345
- Amount: 150,000 VND
- Paid via: ZaloPay Wallet

Do you want a full refund of 150,000 VND? This will be returned to your ZaloPay wallet.

Customer: "Yes, full refund please"

AI Agent: [Uses create_refund tool with confirmation]

Response: "Your refund has been initiated!

🔄 **Refund ID**: RF_210110_001
💰 **Amount**: 150,000 VND
📊 **Status**: Processing

The refund typically takes 1-3 business days to appear in your ZaloPay wallet. I'll update you when it's complete. Anything else I can help with?"
```

---

## Transaction ID Formats

ZaloPay uses specific formats for transaction identifiers:

| ID Type        | Format                     | Example              |
| -------------- | -------------------------- | -------------------- |
| `app_trans_id` | `{YYMMDD}_{your_order_id}` | `210110_order12345`  |
| `zp_trans_id`  | ZaloPay assigned (numeric) | `210110000012345`    |
| `m_refund_id`  | `{YYMMDD}_{app_id}_{uuid}` | `210110_123_uuid123` |

**Note**: `app_trans_id` must be unique per merchant. ZaloPay recommends prefixing with date to ensure uniqueness.

---

## Security Best Practices

1. **Never expose keys**: Store `key1` and `key2` in Secrets Manager only
2. **Validate callbacks**: Always verify MAC signature using `key2` before processing
3. **Use HTTPS**: All redirect and callback URLs must be HTTPS
4. **Unique order IDs**: Generate unique `app_trans_id` to prevent duplicate payments
5. **Amount validation**: Validate payment amounts match order totals
6. **Timeout handling**: Handle 15-minute QR expiry gracefully

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [MoMo Integration Specification](./payment-momo.md)
