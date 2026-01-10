# MoMo Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `payment-momo`
> **Category**: Payment

## Overview

MoMo is Vietnam's largest mobile wallet and payment platform with over 31 million users. It provides a comprehensive payment gateway for merchants to accept payments via QR codes, the MoMo wallet, and various banking methods.

**API Documentation**: [https://developers.momo.vn/v3/](https://developers.momo.vn/v3/)
**Test Portal**: [https://test-payment.momo.vn](https://test-payment.momo.vn)

---

## Authentication Model

MoMo uses **triple-credential HMAC** authentication:

| Credential    | Description                               | Obtained From        |
| ------------- | ----------------------------------------- | -------------------- |
| `partnerCode` | Merchant/Partner identifier               | MoMo Business Portal |
| `accessKey`   | API access key for request authentication | MoMo Business Portal |
| `secretKey`   | Secret key for HMAC-SHA256 signature      | MoMo Business Portal |

### Key Characteristics

- **No OAuth**: HMAC-SHA256 signature-based authentication
- **Single Key**: Same `secretKey` used for both signing requests and verifying IPNs
- **Request Signing**: Each request requires `signature` field with HMAC-SHA256
- **Keys Don't Expire**: Unless manually rotated in portal

### Request Signature Format

```
signature = HMAC_SHA256(secretKey, rawSignature)
```

Raw signature string is composed of sorted key-value pairs (documented per API).

---

## Environments

| Environment | API Gateway                    | Portal                         |
| ----------- | ------------------------------ | ------------------------------ |
| Test        | `https://test-payment.momo.vn` | `https://test-payment.momo.vn` |
| Production  | `https://payment.momo.vn`      | MoMo Business Portal           |

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "payment-momo",
  "category": "payment",
  "name": "MoMo Payment Gateway",
  "description": "Accept payments via MoMo wallet, QR codes, and banking methods",
  "provider": "M_Service JSC",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["partnerCode", "accessKey", "secretKey"],
    "properties": {
      "partnerCode": {
        "type": "string",
        "title": "Partner Code",
        "description": "Your MoMo merchant/partner code"
      },
      "accessKey": {
        "type": "string",
        "title": "Access Key",
        "description": "API access key for authentication",
        "format": "password"
      },
      "secretKey": {
        "type": "string",
        "title": "Secret Key",
        "description": "Secret key for signing requests and verifying callbacks",
        "format": "password"
      },
      "environment": {
        "type": "string",
        "title": "Environment",
        "enum": ["test", "production"],
        "default": "test",
        "description": "API environment to use"
      },
      "ipnUrl": {
        "type": "string",
        "title": "IPN URL",
        "description": "URL to receive instant payment notifications",
        "format": "uri"
      }
    }
  },
  "credentialFields": ["accessKey", "secretKey"],
  "configFields": ["partnerCode", "environment", "ipnUrl"]
}
```

### Customer Connection Flow

To connect their MoMo merchant account, tenants need to:

1. **Create MoMo Business Account**:
   - Test: Register at MoMo test portal for sandbox credentials
   - Production: Apply for merchant account via MoMo Business

2. **Get API Credentials**:
   - Login to business portal
   - Navigate to API settings / Integration section
   - Copy `Partner Code`, `Access Key`, and `Secret Key`

3. **Configure IPN URL**:
   - Set the IPN (Instant Payment Notification) URL in portal
   - Our system provides a unique IPN URL per tenant

4. **Enter in Our System**: Input credentials in our connection setup UI

### Credential Storage

| Field         | Storage Location  | Notes                               |
| ------------- | ----------------- | ----------------------------------- |
| `partnerCode` | DynamoDB (config) | Non-sensitive, used in API calls    |
| `accessKey`   | Secrets Manager   | Encrypted, for API authentication   |
| `secretKey`   | Secrets Manager   | Encrypted, for signing/verification |
| `environment` | DynamoDB (config) | Determines API endpoint             |
| `ipnUrl`      | DynamoDB (config) | Webhook endpoint                    |

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

**API Endpoint:** `POST /v2/gateway/api/create`

**Use Case:** AI agent creating a payment request for customer to pay. Returns QR code, payment URL, and deeplink.

**Tool Definition:**

```json
{
  "actionId": "create_payment_order",
  "name": "Create MoMo Payment Order",
  "description": "Create a new payment order and get QR code/payment URL. Use when customer wants to pay for an order. IMPORTANT: This creates a real payment request - confirm amount with customer before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["amount", "orderId", "orderInfo"],
    "properties": {
      "amount": {
        "type": "integer",
        "description": "Payment amount in VND (min 1,000 - max 50,000,000)",
        "minimum": 1000,
        "maximum": 50000000
      },
      "orderId": {
        "type": "string",
        "description": "Unique order ID from your system (max 50 chars, alphanumeric + - _ .)",
        "maxLength": 50,
        "pattern": "^[a-zA-Z0-9\\-_.]+$"
      },
      "orderInfo": {
        "type": "string",
        "description": "Order description shown to customer (max 400 chars)",
        "maxLength": 400
      },
      "redirectUrl": {
        "type": "string",
        "description": "URL to redirect customer after payment on web",
        "format": "uri"
      },
      "extraData": {
        "type": "string",
        "description": "Additional data (base64 encoded, returned in IPN)"
      },
      "lang": {
        "type": "string",
        "enum": ["vi", "en"],
        "default": "vi",
        "description": "Language for payment page"
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
      "orderId": { "type": "string", "description": "Your order ID" },
      "requestId": { "type": "string", "description": "MoMo request ID" },
      "payUrl": {
        "type": "string",
        "description": "URL for web payment (redirect customer here)"
      },
      "deeplink": {
        "type": "string",
        "description": "Deep link to open MoMo app directly"
      },
      "qrCodeUrl": {
        "type": "string",
        "description": "QR code data string (generate QR image from this)"
      },
      "amount": { "type": "integer", "description": "Payment amount in VND" },
      "resultCode": {
        "type": "integer",
        "description": "MoMo result code (0 = success)"
      },
      "message": { "type": "string", "description": "Result message" }
    }
  }
}
```

**API Request Details:**

```json
POST /v2/gateway/api/create
Content-Type: application/json

{
  "partnerCode": "{partner_code}",
  "partnerName": "Your Business Name",
  "storeId": "{store_id}",
  "requestId": "{unique_request_id}",
  "amount": 50000,
  "orderId": "{your_order_id}",
  "orderInfo": "Payment for order #12345",
  "redirectUrl": "https://yoursite.com/payment/result",
  "ipnUrl": "https://yoursite.com/payment/ipn",
  "requestType": "captureWallet",
  "extraData": "",
  "lang": "vi",
  "signature": "{hmac_sha256_signature}"
}
```

**Signature Calculation:**

```javascript
// Raw signature string (alphabetically sorted keys)
const rawSignature =
  `accessKey=${accessKey}` +
  `&amount=${amount}` +
  `&extraData=${extraData}` +
  `&ipnUrl=${ipnUrl}` +
  `&orderId=${orderId}` +
  `&orderInfo=${orderInfo}` +
  `&partnerCode=${partnerCode}` +
  `&redirectUrl=${redirectUrl}` +
  `&requestId=${requestId}` +
  `&requestType=captureWallet`;

const signature = crypto
  .createHmac('sha256', secretKey)
  .update(rawSignature)
  .digest('hex');
```

---

### 2. Query Payment Status (High Priority)

**API Endpoint:** `POST /v2/gateway/api/query`

**Use Case:** AI agent checking if customer has completed payment.

**Tool Definition:**

```json
{
  "actionId": "query_payment_status",
  "name": "Query MoMo Payment Status",
  "description": "Check the status of a payment order. Use when customer asks about payment status or to verify payment was received.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Your order ID to check"
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
      "requestId": { "type": "string", "description": "MoMo request ID" },
      "transId": {
        "type": "integer",
        "description": "MoMo transaction ID (if paid)"
      },
      "status": {
        "type": "string",
        "enum": ["pending", "success", "failed", "refunded"],
        "description": "Payment status"
      },
      "resultCode": {
        "type": "integer",
        "description": "MoMo result code (0=success, 9000=authorized, others=failed)"
      },
      "amount": { "type": "integer", "description": "Payment amount in VND" },
      "paidAt": {
        "type": "string",
        "description": "Payment completion time (if paid)",
        "format": "date-time"
      },
      "payType": {
        "type": "string",
        "description": "Payment method used (qr, webApp, credit, napas)"
      },
      "message": { "type": "string", "description": "Result message" }
    }
  }
}
```

**API Request Details:**

```json
POST /v2/gateway/api/query
Content-Type: application/json

{
  "partnerCode": "{partner_code}",
  "requestId": "{unique_request_id}",
  "orderId": "{your_order_id}",
  "lang": "vi",
  "signature": "{hmac_sha256_signature}"
}
```

**Signature Calculation:**

```javascript
const rawSignature =
  `accessKey=${accessKey}` +
  `&orderId=${orderId}` +
  `&partnerCode=${partnerCode}` +
  `&requestId=${requestId}`;

const signature = crypto
  .createHmac('sha256', secretKey)
  .update(rawSignature)
  .digest('hex');
```

---

### 3. Create Refund (Medium Priority)

**API Endpoint:** `POST /v2/gateway/api/refund`

**Use Case:** AI agent processing refund for a completed payment.

**Tool Definition:**

```json
{
  "actionId": "create_refund",
  "name": "Create MoMo Refund",
  "description": "Process a refund for a completed payment. Can do full or partial refund. IMPORTANT: This processes a real refund - confirm with customer before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["transId", "amount", "orderId", "description"],
    "properties": {
      "transId": {
        "type": "integer",
        "description": "MoMo transaction ID (transId) from the original payment"
      },
      "amount": {
        "type": "integer",
        "description": "Refund amount in VND (can be partial, must be <= original amount)",
        "minimum": 1000
      },
      "orderId": {
        "type": "string",
        "description": "NEW unique order ID for this refund transaction (not original order ID)"
      },
      "description": {
        "type": "string",
        "description": "Reason for refund",
        "maxLength": 400
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
      "orderId": { "type": "string", "description": "Refund order ID" },
      "requestId": { "type": "string", "description": "MoMo request ID" },
      "transId": { "type": "integer", "description": "Refund transaction ID" },
      "status": {
        "type": "string",
        "enum": ["processing", "success", "failed"],
        "description": "Refund status"
      },
      "resultCode": {
        "type": "integer",
        "description": "MoMo result code (0=success)"
      },
      "amount": { "type": "integer", "description": "Refund amount in VND" },
      "message": { "type": "string", "description": "Result message" }
    }
  }
}
```

**API Request Details:**

```json
POST /v2/gateway/api/refund
Content-Type: application/json

{
  "partnerCode": "{partner_code}",
  "orderId": "{new_refund_order_id}",
  "requestId": "{unique_request_id}",
  "amount": 50000,
  "transId": 123456789,
  "lang": "vi",
  "description": "Refund for order #12345",
  "signature": "{hmac_sha256_signature}"
}
```

**Signature Calculation:**

```javascript
const rawSignature =
  `accessKey=${accessKey}` +
  `&amount=${amount}` +
  `&description=${description}` +
  `&orderId=${orderId}` +
  `&partnerCode=${partnerCode}` +
  `&requestId=${requestId}` +
  `&transId=${transId}`;

const signature = crypto
  .createHmac('sha256', secretKey)
  .update(rawSignature)
  .digest('hex');
```

---

### 4. Query Refund Status (Low Priority)

**API Endpoint:** `POST /v2/gateway/api/refund/query`

**Use Case:** AI agent checking refund processing status.

**Tool Definition:**

```json
{
  "actionId": "query_refund_status",
  "name": "Query MoMo Refund Status",
  "description": "Check the status of a refund request. Use when customer asks about refund status.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Refund order ID from create_refund response"
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
      "orderId": { "type": "string", "description": "Refund order ID" },
      "transId": { "type": "integer", "description": "Refund transaction ID" },
      "status": {
        "type": "string",
        "enum": ["processing", "success", "failed"],
        "description": "Refund status"
      },
      "resultCode": {
        "type": "integer",
        "description": "MoMo result code"
      },
      "amount": { "type": "integer", "description": "Refund amount" },
      "processedAt": {
        "type": "string",
        "description": "When refund was processed (if completed)",
        "format": "date-time"
      },
      "message": { "type": "string", "description": "Result message" }
    }
  }
}
```

---

## Result Codes Reference

### Common Result Codes

| Code | Status         | Description                              |
| ---- | -------------- | ---------------------------------------- |
| 0    | Success        | Transaction successful                   |
| 9000 | Authorized     | Transaction authorized, awaiting capture |
| 10   | System Error   | System maintenance                       |
| 11   | Access Denied  | Invalid partner credentials              |
| 12   | Unsupported    | API version not supported                |
| 13   | Invalid Params | Missing or invalid parameters            |
| 20   | Bad Format     | Wrong request format                     |
| 21   | Invalid Amount | Amount out of range (1K - 50M VND)       |
| 22   | Invalid Trans  | Transaction not found                    |
| 40   | Duplicate      | Duplicate requestId                      |
| 41   | Order Exists   | Order ID already used                    |
| 42   | Order Invalid  | Order not found                          |
| 43   | Order Failed   | Order processing failed                  |
| 1001 | User Denied    | User cancelled payment                   |
| 1002 | Insufficient   | User has insufficient balance            |
| 1003 | Auth Failed    | User authentication failed               |
| 1004 | Expired        | Transaction timeout                      |
| 1005 | Limit Exceeded | Transaction limit exceeded               |
| 1006 | User Blocked   | User account blocked                     |
| 4001 | Duplicate Ref  | Duplicate refund request                 |

---

## IPN (Instant Payment Notification) Support

MoMo sends POST callbacks (IPN) when payment status changes.

### IPN Configuration

- Set `ipnUrl` when creating payment order
- Our service provides a tenant-specific IPN URL
- MoMo expects HTTP 204 response within 15 seconds
- MoMo retries if response not received

### IPN Payload

```json
{
  "partnerCode": "MOMO",
  "orderId": "order12345",
  "requestId": "req123456",
  "amount": 50000,
  "orderInfo": "Payment for order #12345",
  "orderType": "momo_wallet",
  "transId": 123456789,
  "resultCode": 0,
  "message": "Thành công",
  "payType": "qr",
  "responseTime": 1610240100000,
  "extraData": "",
  "signature": "abc123def456..."
}
```

### IPN Verification

```javascript
// Reconstruct raw signature from IPN fields
const rawSignature =
  `accessKey=${accessKey}` +
  `&amount=${ipnData.amount}` +
  `&extraData=${ipnData.extraData}` +
  `&message=${ipnData.message}` +
  `&orderId=${ipnData.orderId}` +
  `&orderInfo=${ipnData.orderInfo}` +
  `&orderType=${ipnData.orderType}` +
  `&partnerCode=${ipnData.partnerCode}` +
  `&payType=${ipnData.payType}` +
  `&requestId=${ipnData.requestId}` +
  `&responseTime=${ipnData.responseTime}` +
  `&resultCode=${ipnData.resultCode}` +
  `&transId=${ipnData.transId}`;

const calculatedSignature = crypto
  .createHmac('sha256', secretKey)
  .update(rawSignature)
  .digest('hex');

if (ipnData.signature !== calculatedSignature) {
  // Invalid IPN - reject
  return res.status(400).send();
}

// Valid IPN - process based on resultCode
if (ipnData.resultCode === 0) {
  // Payment successful - update order status
}

// Return 204 No Content
return res.status(204).send();
```

### IPN Response

- **Success**: Return HTTP 204 No Content
- **Failure**: Return HTTP 4xx/5xx (MoMo will retry)

---

## Payment Types

MoMo supports various payment methods via `requestType`:

| Request Type    | Description                       |
| --------------- | --------------------------------- |
| `captureWallet` | One-time payment from MoMo wallet |
| `payWithATM`    | Pay via domestic ATM/bank card    |
| `payWithCC`     | Pay via international credit card |

### Pay Types (in IPN response)

| Pay Type | Description                |
| -------- | -------------------------- |
| `qr`     | QR code payment            |
| `webApp` | Web or app payment         |
| `credit` | Credit card payment        |
| `napas`  | Domestic bank card payment |

---

## Amount Limits

| Limit Type | Value          |
| ---------- | -------------- |
| Minimum    | 1,000 VND      |
| Maximum    | 50,000,000 VND |

---

## Error Handling

| Error Scenario       | Detection         | Recommended Action                  |
| -------------------- | ----------------- | ----------------------------------- |
| Invalid credentials  | resultCode = 11   | Ask tenant to verify credentials    |
| Invalid signature    | resultCode = 20   | Check secretKey and signature logic |
| Order already exists | resultCode = 41   | Use unique order ID per transaction |
| Payment timeout      | resultCode = 1004 | Create new payment order            |
| User cancelled       | resultCode = 1001 | Offer to create new payment         |
| Insufficient balance | resultCode = 1002 | Ask customer to top up MoMo balance |
| Network timeout      | HTTP timeout      | Retry with exponential backoff      |
| Amount out of range  | resultCode = 21   | Check amount limits (1K - 50M VND)  |

---

## Rate Limiting

MoMo doesn't publish specific rate limits, but recommended limits:

| Action               | Recommended Limit          |
| -------------------- | -------------------------- |
| Create payment order | 60 requests/minute/tenant  |
| Query payment status | 120 requests/minute/tenant |
| Create refund        | 30 requests/minute/tenant  |
| Query refund status  | 60 requests/minute/tenant  |

---

## Example AI Agent Conversations

### Scenario 1: Create Payment with QR

```
Customer: "I want to pay 250,000 VND for my order #ORD789"

AI Agent: I'll create a payment request for your order. Let me confirm:
- Order: #ORD789
- Amount: 250,000 VND

Should I proceed with generating the MoMo payment?

Customer: "Yes"

AI Agent: [Uses create_payment_order tool with confirmation]

Response: "Your MoMo payment request is ready! Choose how to pay:

📱 **Scan QR Code**: [QR Code Image]
🔗 **Pay on web**: [Payment Link]
📲 **Open MoMo app**: [Deep Link Button]

Amount: 250,000 VND

The payment link expires in 15 minutes. I'll let you know once your payment is confirmed!"
```

### Scenario 2: Check Payment Status - Success

```
Customer: "Has my payment gone through yet?"

AI Agent: [Uses query_payment_status tool]

Response: "Yes! Your payment has been received successfully!

✅ **Status**: Paid
💰 **Amount**: 250,000 VND
⏰ **Paid at**: 2:45 PM today
💳 **Method**: MoMo QR Scan
🔢 **Transaction ID**: 2456789123

Your order is now confirmed and being processed!"
```

### Scenario 3: Payment Pending

```
Customer: "Did my payment work? I'm not sure if it went through"

AI Agent: [Uses query_payment_status tool]

Response: "I checked your payment status. It's still pending - we haven't received payment yet.

⏳ **Status**: Waiting for payment
💰 **Amount**: 250,000 VND

Would you like to:
1. Try paying again (I'll generate a new QR code)
2. Check if you have enough balance in your MoMo wallet

How would you like to proceed?"
```

### Scenario 4: Process Refund

```
Customer: "I need to return the item I bought. Can I get my money back?"

AI Agent: Let me look up your order and payment...

[Checks order and payment status]

I found your payment:
- Order: #ORD789
- Amount: 250,000 VND
- Paid via: MoMo Wallet
- Transaction ID: 2456789123

Would you like a full refund of 250,000 VND? This will be returned to your MoMo wallet within 1-3 business days.

Customer: "Yes please, full refund"

AI Agent: [Uses create_refund tool with confirmation]

Response: "Your refund has been submitted!

🔄 **Refund Status**: Processing
💰 **Refund Amount**: 250,000 VND
🔢 **Refund ID**: RF_ORD789_001

The money should appear in your MoMo wallet within 1-3 business days. I'll update you when it's complete. Is there anything else I can help with?"
```

### Scenario 5: User Cancelled Payment

```
Customer: "I accidentally closed the payment screen. Can I try again?"

AI Agent: [Uses query_payment_status tool to confirm status]

No problem! Your previous payment wasn't completed. Would you like me to create a new payment request for order #ORD789 (250,000 VND)?

Customer: "Yes"

AI Agent: [Uses create_payment_order tool]

Response: "Here's your new payment link! You have 15 minutes to complete it.

📱 **Scan QR Code**: [QR Code Image]
🔗 **Or click here to pay**: [Payment Link]

Let me know once you've completed the payment!"
```

---

## Security Best Practices

1. **Secure credential storage**: Store `accessKey` and `secretKey` in Secrets Manager only
2. **Validate all IPNs**: Always verify signature before processing payment notifications
3. **Use HTTPS**: All `redirectUrl` and `ipnUrl` must be HTTPS
4. **Unique identifiers**: Use unique `orderId` and `requestId` per transaction
5. **Amount validation**: Verify payment amounts match expected order totals
6. **Respond quickly**: IPN handler must respond within 15 seconds
7. **Idempotency**: Handle duplicate IPNs gracefully (same orderId)

---

## Transaction ID Formats

| ID Type     | Format                        | Example              |
| ----------- | ----------------------------- | -------------------- |
| `orderId`   | Your unique order ID (max 50) | `ORD789_20210110`    |
| `requestId` | Unique request ID (max 50)    | `REQ_1610240000_abc` |
| `transId`   | MoMo assigned (numeric)       | `2456789123`         |

**Note**:

- `orderId` must be unique per merchant
- `requestId` should be unique per API call
- For refunds, use a NEW `orderId` (not the original payment orderId)

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [ZaloPay Integration Specification](./payment-zalopay.md)
