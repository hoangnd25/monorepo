# GHTK (Giao Hang Tiet Kiem) Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `shipping-ghtk`
> **Category**: Shipping

## Overview

GHTK (Giao Hang Tiet Kiem) is one of Vietnam's leading express delivery services with nationwide coverage. This document specifies the integration details for connecting GHTK to our Integrations Service.

**API Documentation**: [https://docs.giaohangtietkiem.vn/](https://docs.giaohangtietkiem.vn/)

---

## Authentication Model

GHTK uses a **static API token** authentication model:

| Credential     | Description                                        | Obtained From                                                          |
| -------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `API_TOKEN`    | API token for authenticating requests              | GHTK Customer Portal: `khachhang.giaohangtietkiem.vn/web/cau-hinh-api` |
| `PARTNER_CODE` | Shop code or partner secret code (X-Client-Source) | Assigned when registering as GHTK partner                              |

### Key Characteristics

- **No OAuth**: Simple token-based auth, no refresh flow needed
- **Token Management**: Tokens can be created/revoked from GHTK customer portal
- **Permission Scoping**: Each token can have specific permissions (create order, calculate fee, etc.)
- **Expiration**: Tokens have configurable expiration dates set at creation time
- **No Auto-Refresh**: Tokens do not auto-refresh; must be manually renewed before expiry

### Required Headers

```
Token: {API_TOKEN}
X-Client-Source: {PARTNER_CODE}
Content-Type: application/json
```

---

## Environments

| Environment | API Endpoint                           | Customer Portal                         |
| ----------- | -------------------------------------- | --------------------------------------- |
| Staging     | `https://services-staging.ghtklab.com` | `https://khachhang-staging.ghtklab.com` |
| Production  | `https://services.giaohangtietkiem.vn` | `https://khachhang.giaohangtietkiem.vn` |

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "shipping-ghtk",
  "category": "shipping",
  "name": "GHTK (Giao Hang Tiet Kiem)",
  "description": "Vietnam's express delivery service with nationwide coverage",
  "provider": "Giao Hang Tiet Kiem JSC",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["apiToken", "partnerCode"],
    "properties": {
      "apiToken": {
        "type": "string",
        "title": "API Token",
        "description": "Your GHTK API token from the customer portal (Cấu hình API)",
        "format": "password"
      },
      "partnerCode": {
        "type": "string",
        "title": "Partner Code (X-Client-Source)",
        "description": "Your shop code or partner secret code"
      },
      "environment": {
        "type": "string",
        "title": "Environment",
        "enum": ["staging", "production"],
        "default": "staging",
        "description": "API environment to use"
      }
    }
  },
  "credentialFields": ["apiToken"],
  "configFields": ["partnerCode", "environment"]
}
```

### Customer Connection Flow

To connect their GHTK account, tenants need to:

1. **Have a GHTK Business Account**: Register at `khachhang.giaohangtietkiem.vn`
2. **Navigate to API Configuration**: Go to "Thông tin Shop" → "Cấu hình API"
3. **Create API Token**:
   - Click "Tạo Token"
   - Set token name (for identification)
   - Set expiration date
   - Select permissions (create order, calculate fee, get status, etc.)
4. **Copy Credentials**: Copy the generated API Token and Partner Code
5. **Enter in Our System**: Paste credentials in our connection setup UI

### Credential Storage

| Field         | Storage Location  | Notes                          |
| ------------- | ----------------- | ------------------------------ |
| `apiToken`    | Secrets Manager   | Encrypted, never logged        |
| `partnerCode` | DynamoDB (config) | Non-sensitive, used in headers |
| `environment` | DynamoDB (config) | Determines API endpoint        |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                    | Use Case                                     |
| -------- | ----------------------- | -------------------------------------------- |
| High     | `calculate_fee`         | Customer asking about shipping costs         |
| High     | `track_order`           | Customer checking delivery status            |
| Medium   | `create_order`          | Creating new shipment (with confirmation)    |
| Medium   | `cancel_order`          | Cancelling pending order (with confirmation) |
| Low      | `list_pickup_addresses` | Selecting warehouse                          |
| Low      | `get_shipping_label`    | Getting printable label                      |

---

### 1. Calculate Shipping Fee (High Priority)

**API Endpoint:** `GET /services/shipment/fee`

**Use Case:** AI agent helping customer estimate shipping costs before order placement.

**Tool Definition:**

```json
{
  "actionId": "calculate_fee",
  "name": "Calculate GHTK Shipping Fee",
  "description": "Calculate shipping fee for a package from origin to destination. Use this when a customer asks about shipping costs, delivery fees, or wants to compare shipping options.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": [
      "pickProvince",
      "pickDistrict",
      "province",
      "district",
      "weight"
    ],
    "properties": {
      "pickProvince": {
        "type": "string",
        "description": "Origin province/city name (e.g., 'TP. Hồ Chí Minh', 'Hà Nội')"
      },
      "pickDistrict": {
        "type": "string",
        "description": "Origin district name (e.g., 'Quận 1', 'Quận Cầu Giấy')"
      },
      "pickWard": {
        "type": "string",
        "description": "Origin ward name (optional)"
      },
      "province": {
        "type": "string",
        "description": "Destination province/city name"
      },
      "district": {
        "type": "string",
        "description": "Destination district name"
      },
      "ward": {
        "type": "string",
        "description": "Destination ward name (optional)"
      },
      "weight": {
        "type": "integer",
        "description": "Package weight in GRAMS"
      },
      "value": {
        "type": "integer",
        "description": "Package value in VND (for insurance calculation)"
      },
      "transport": {
        "type": "string",
        "enum": ["road", "fly"],
        "description": "Transport method: 'road' (ground) or 'fly' (air)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "fee": { "type": "integer", "description": "Shipping fee in VND" },
      "insuranceFee": {
        "type": "integer",
        "description": "Insurance fee in VND"
      },
      "deliverySupported": {
        "type": "boolean",
        "description": "Whether delivery is supported in this area"
      },
      "deliveryType": { "type": "string", "description": "Delivery zone type" },
      "extraFees": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "amount": { "type": "integer" },
            "type": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### 2. Track Shipment (High Priority)

**API Endpoint:** `GET /services/shipment/v2/{TRACKING_ORDER}`

**Use Case:** AI agent helping customer check order delivery status.

**Tool Definition:**

```json
{
  "actionId": "track_order",
  "name": "Track GHTK Shipment",
  "description": "Get current status and details of a shipment. Use this when a customer asks about their order status, delivery progress, or tracking information.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["trackingNumber"],
    "properties": {
      "trackingNumber": {
        "type": "string",
        "description": "GHTK tracking number (e.g., 'S1.A1.17373471') or partner order ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "labelId": { "type": "string", "description": "GHTK tracking number" },
      "partnerId": { "type": "string", "description": "Partner's order ID" },
      "status": { "type": "string", "description": "Status code" },
      "statusText": {
        "type": "string",
        "description": "Human-readable status"
      },
      "pickDate": { "type": "string", "description": "Pickup date" },
      "deliverDate": {
        "type": "string",
        "description": "Expected/actual delivery date"
      },
      "customerName": { "type": "string", "description": "Recipient name" },
      "address": { "type": "string", "description": "Delivery address" },
      "shipMoney": { "type": "integer", "description": "Shipping fee" },
      "pickMoney": { "type": "integer", "description": "COD amount" },
      "weight": { "type": "integer", "description": "Package weight in grams" }
    }
  }
}
```

---

### 3. Create Shipping Order (Medium Priority)

**API Endpoint:** `POST /services/shipment/order`

**Use Case:** AI agent creating shipping order on behalf of seller (requires careful confirmation).

**Tool Definition:**

```json
{
  "actionId": "create_order",
  "name": "Create GHTK Shipping Order",
  "description": "Create a new shipping order with GHTK. IMPORTANT: This action creates a real order - always confirm all details with the user before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": [
      "orderId",
      "pickName",
      "pickAddress",
      "pickProvince",
      "pickDistrict",
      "pickTel",
      "name",
      "address",
      "province",
      "district",
      "tel",
      "pickMoney",
      "value",
      "products"
    ],
    "properties": {
      "orderId": { "type": "string", "description": "Your unique order ID" },
      "pickName": {
        "type": "string",
        "description": "Sender/pickup contact name"
      },
      "pickAddress": {
        "type": "string",
        "description": "Pickup address details"
      },
      "pickProvince": {
        "type": "string",
        "description": "Pickup province/city"
      },
      "pickDistrict": { "type": "string", "description": "Pickup district" },
      "pickWard": { "type": "string", "description": "Pickup ward (optional)" },
      "pickTel": { "type": "string", "description": "Pickup contact phone" },
      "name": { "type": "string", "description": "Recipient name" },
      "address": {
        "type": "string",
        "description": "Delivery address details"
      },
      "province": { "type": "string", "description": "Delivery province/city" },
      "district": { "type": "string", "description": "Delivery district" },
      "ward": { "type": "string", "description": "Delivery ward" },
      "tel": { "type": "string", "description": "Recipient phone" },
      "pickMoney": {
        "type": "integer",
        "description": "COD amount to collect (0 if prepaid)"
      },
      "value": {
        "type": "integer",
        "description": "Declared value for insurance (VND)"
      },
      "isFreeship": {
        "type": "integer",
        "enum": [0, 1],
        "description": "1 if shop pays shipping, 0 if customer pays"
      },
      "transport": {
        "type": "string",
        "enum": ["road", "fly"],
        "description": "Transport method"
      },
      "note": {
        "type": "string",
        "description": "Delivery notes (max 120 chars)"
      },
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["name", "weight"],
          "properties": {
            "name": { "type": "string" },
            "weight": { "type": "number", "description": "Weight in KG" },
            "quantity": { "type": "integer" }
          }
        }
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "partnerId": { "type": "string", "description": "Your order ID" },
      "label": { "type": "string", "description": "GHTK tracking number" },
      "trackingId": { "type": "integer" },
      "fee": { "type": "integer", "description": "Shipping fee" },
      "insuranceFee": { "type": "integer" },
      "estimatedPickTime": { "type": "string" },
      "estimatedDeliverTime": { "type": "string" }
    }
  }
}
```

---

### 4. Cancel Order (Medium Priority)

**API Endpoint:** `POST /services/shipment/cancel/{TRACKING_ORDER}`

**Use Case:** AI agent cancelling an order that hasn't been picked up yet.

**Tool Definition:**

```json
{
  "actionId": "cancel_order",
  "name": "Cancel GHTK Order",
  "description": "Cancel a shipping order. Can only cancel orders in status: Not yet received (1), Received (2), or Picking up (12). IMPORTANT: This action is irreversible.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["trackingNumber"],
    "properties": {
      "trackingNumber": {
        "type": "string",
        "description": "GHTK tracking number or partner order ID (prefix with 'partner_id:' for partner ID)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "message": { "type": "string" }
    }
  }
}
```

---

### 5. List Pickup Addresses (Low Priority)

**API Endpoint:** `GET /services/shipment/list_pick_add`

**Use Case:** AI agent helping user select which warehouse to ship from.

**Tool Definition:**

```json
{
  "actionId": "list_pickup_addresses",
  "name": "List GHTK Pickup Addresses",
  "description": "Get list of configured pickup addresses/warehouses for the shop. Use when user needs to select which location to ship from.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "addresses": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "pickAddressId": { "type": "string" },
            "address": { "type": "string" },
            "pickTel": { "type": "string" },
            "pickName": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### 6. Get Shipping Label (Low Priority)

**API Endpoint:** `GET /services/label/{TRACKING_ORDER}`

**Use Case:** Generate shipping label PDF (typically not called by AI, but available).

**Tool Definition:**

```json
{
  "actionId": "get_shipping_label",
  "name": "Get GHTK Shipping Label",
  "description": "Get shipping label PDF for an order. Returns a URL to download the label.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["trackingNumber"],
    "properties": {
      "trackingNumber": { "type": "string" },
      "orientation": {
        "type": "string",
        "enum": ["portrait", "landscape"],
        "default": "portrait"
      },
      "pageSize": { "type": "string", "enum": ["A5", "A6"], "default": "A6" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "labelUrl": {
        "type": "string",
        "description": "URL to download PDF label"
      }
    }
  }
}
```

---

## Status Codes Reference

| Code | Status (Vietnamese)        | Status (English)                   |
| ---- | -------------------------- | ---------------------------------- |
| -1   | Hủy đơn hàng               | Order cancelled                    |
| 1    | Chưa tiếp nhận             | Not yet received                   |
| 2    | Đã tiếp nhận               | Received                           |
| 3    | Đã lấy hàng/Đã nhập kho    | Picked up / In warehouse           |
| 4    | Đã điều phối giao hàng     | Out for delivery                   |
| 5    | Đã giao hàng/Chưa đối soát | Delivered (pending reconciliation) |
| 6    | Đã đối soát                | Reconciled                         |
| 7    | Không lấy được hàng        | Failed to pick up                  |
| 8    | Hoãn lấy hàng              | Pickup delayed                     |
| 9    | Không giao được hàng       | Delivery failed                    |
| 10   | Delay giao hàng            | Delivery delayed                   |
| 20   | Đang trả hàng              | Returning package                  |
| 21   | Đã trả hàng                | Package returned                   |

---

## Webhook Support (Inbound)

GHTK supports webhooks to push status updates to our system. This enables real-time order tracking without polling.

### Webhook Payload

```json
{
  "partner_id": "1234567",
  "label_id": "S1.A1.17373471",
  "status_id": 5,
  "action_time": "2016-11-02T12:18:39+07:00",
  "reason_code": "",
  "reason": "",
  "weight": 2.4,
  "fee": 15000,
  "pick_money": 100000,
  "return_part_package": 0
}
```

**Future Enhancement:** Accept GHTK webhooks to update order status in real-time and potentially trigger AI agent notifications.

---

## Error Handling

| Error Code          | Description                   | Recommended Action             |
| ------------------- | ----------------------------- | ------------------------------ |
| HTTP 403            | Invalid or expired token      | Ask user to update credentials |
| `ORDER_ID_EXIST`    | Duplicate order ID            | Use existing order or new ID   |
| Area not supported  | Delivery not available        | Suggest alternative carrier    |
| Order already taken | Cannot cancel picked-up order | Explain limitation to user     |

---

## Rate Limiting

GHTK doesn't document specific rate limits, but recommended limits:

| Action        | Recommended Limit          |
| ------------- | -------------------------- |
| Calculate fee | 100 requests/minute/tenant |
| Create order  | 30 requests/minute/tenant  |
| Track order   | 60 requests/minute/tenant  |

---

## Example AI Agent Conversations

### Scenario 1: Shipping Cost Inquiry

```
Customer: "How much to ship a 2kg package from District 1, HCMC to Cau Giay, Hanoi?"

AI Agent: [Uses calculate_fee tool]
Response: "Shipping a 2kg package from District 1, HCMC to Cau Giay, Hanoi via GHTK costs:
- Ground shipping: 35,000 VND (3-4 days)
- Air shipping: 52,000 VND (1-2 days)
Would you like me to create a shipping order?"
```

### Scenario 2: Order Tracking

```
Customer: "Where is my order S1.A1.17373471?"

AI Agent: [Uses track_order tool]
Response: "Your order S1.A1.17373471 is currently 'Out for delivery'.
- Status: Being delivered
- Expected delivery: Today (afternoon)
- Recipient: Nguyen Van A
- Address: 123 Nguyen Chi Thanh, District 1, HCMC
The shipper should contact you soon!"
```

---

## Related Documents

- [Integrations Service Architecture](./integrations-service-architecture.md)
- [GHN Integration Specification](./integrations/shipping-ghn.md)
