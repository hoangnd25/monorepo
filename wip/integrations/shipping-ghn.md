# GHN (Giao Hang Nhanh) Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `shipping-ghn`
> **Category**: Shipping

## Overview

GHN (Giao Hang Nhanh) is Vietnam's leading express delivery service, operating since 2012. They offer nationwide coverage with a large network of sorting hubs and delivery stations.

**API Documentation**: [https://api.ghn.vn/home/docs/detail](https://api.ghn.vn/home/docs/detail)

---

## Authentication Model

GHN uses a **token + shop ID** authentication model:

| Credential | Description                                         | Obtained From                              |
| ---------- | --------------------------------------------------- | ------------------------------------------ |
| `Token`    | API token for authenticating requests               | GHN Customer Portal (Chủ cửa hàng section) |
| `ShopId`   | Shop/store identifier (required for most endpoints) | GHN Customer Portal (Quản lý cửa hàng)     |

### Key Characteristics

- **No OAuth**: Simple token-based auth, no refresh flow needed
- **Token Management**: Tokens created from GHN customer portal
- **Shop ID Required**: Most APIs require ShopId in header for authorization scope
- **No Expiration**: Tokens don't expire unless manually revoked

### Required Headers

```
Token: {API_TOKEN}
ShopId: {SHOP_ID}
Content-Type: application/json
```

---

## Environments

| Environment | API Gateway                         | Customer Portal            |
| ----------- | ----------------------------------- | -------------------------- |
| Staging     | `https://dev-online-gateway.ghn.vn` | `https://5sao.ghn.dev`     |
| Production  | `https://online-gateway.ghn.vn`     | `https://khachhang.ghn.vn` |

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "shipping-ghn",
  "category": "shipping",
  "name": "GHN Express (Giao Hang Nhanh)",
  "description": "Vietnam's leading express delivery service with nationwide coverage",
  "provider": "Giao Hang Nhanh JSC",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["token", "shopId"],
    "properties": {
      "token": {
        "type": "string",
        "title": "API Token",
        "description": "Your GHN API token from the customer portal (Chủ cửa hàng → Xem)",
        "format": "password"
      },
      "shopId": {
        "type": "integer",
        "title": "Shop ID",
        "description": "Your shop ID from GHN (found in Quản lý cửa hàng)"
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
  "credentialFields": ["token"],
  "configFields": ["shopId", "environment"]
}
```

### Customer Connection Flow

To connect their GHN account, tenants need to:

1. **Create GHN Account**:
   - Staging: Register at `5sao.ghn.dev`
   - Production: Register at `khachhang.ghn.vn`
2. **Get API Token**:
   - Login to customer portal
   - Go to "Chủ cửa hàng" tab
   - Click "Xem" button to view and copy the token
3. **Create/Get Shop ID**:
   - Go to "Quản lý cửa hàng"
   - Select or create a shop
   - Fill in shop address details
   - Click "Cập nhật" to save
   - Copy the Shop ID
4. **Enter in Our System**: Paste Token and Shop ID in our connection setup UI

### Credential Storage

| Field         | Storage Location  | Notes                          |
| ------------- | ----------------- | ------------------------------ |
| `token`       | Secrets Manager   | Encrypted, never logged        |
| `shopId`      | DynamoDB (config) | Non-sensitive, used in headers |
| `environment` | DynamoDB (config) | Determines API endpoint        |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                 | Use Case                                     |
| -------- | -------------------- | -------------------------------------------- |
| High     | `calculate_fee`      | Customer asking about shipping costs         |
| High     | `track_order`        | Customer checking delivery status            |
| Medium   | `create_order`       | Creating new shipment (with confirmation)    |
| Medium   | `cancel_order`       | Cancelling pending order (with confirmation) |
| Low      | `list_stores`        | Listing pickup stores/warehouses             |
| Low      | `get_shipping_label` | Getting printable shipping label             |

---

### 1. Calculate Shipping Fee (High Priority)

**API Endpoint:** `POST /shiip/public-api/v2/shipping-order/fee`

**Use Case:** AI agent helping customer estimate shipping costs before order placement.

**Tool Definition:**

```json
{
  "actionId": "calculate_fee",
  "name": "Calculate GHN Shipping Fee",
  "description": "Calculate shipping fee for a package from origin to destination. Use this when a customer asks about shipping costs, delivery fees, or wants to compare shipping options.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["toDistrictId", "toWardCode", "weight"],
    "properties": {
      "fromDistrictId": {
        "type": "integer",
        "description": "Origin district ID. If not provided, uses shop's default address."
      },
      "fromWardCode": {
        "type": "string",
        "description": "Origin ward code. If not provided, uses shop's default address."
      },
      "toDistrictId": {
        "type": "integer",
        "description": "Destination district ID (use Address API to get ID)"
      },
      "toWardCode": {
        "type": "string",
        "description": "Destination ward code (use Address API to get code)"
      },
      "serviceId": {
        "type": "integer",
        "description": "Service ID. If not provided, defaults to service_type_id=2 (E-commerce)"
      },
      "serviceTypeId": {
        "type": "integer",
        "description": "Service type: 2=E-Commerce Delivery, 5=Traditional Delivery. Default: 2"
      },
      "weight": {
        "type": "integer",
        "description": "Package weight in GRAMS (max 50,000g)"
      },
      "length": {
        "type": "integer",
        "description": "Package length in CM (max 200cm)"
      },
      "width": {
        "type": "integer",
        "description": "Package width in CM (max 200cm)"
      },
      "height": {
        "type": "integer",
        "description": "Package height in CM (max 200cm)"
      },
      "insuranceValue": {
        "type": "integer",
        "description": "Declared value for insurance in VND (max 5,000,000). Default: 0"
      },
      "codValue": {
        "type": "integer",
        "description": "COD amount to collect in VND (max 50,000,000). Default: 0"
      },
      "coupon": {
        "type": "string",
        "description": "Coupon code for discount (optional)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "total": {
        "type": "integer",
        "description": "Total shipping fee in VND"
      },
      "serviceFee": { "type": "integer", "description": "Base service fee" },
      "insuranceFee": { "type": "integer", "description": "Insurance fee" },
      "codFee": { "type": "integer", "description": "COD collection fee" },
      "pickStationFee": {
        "type": "integer",
        "description": "Pickup at station fee"
      },
      "couponValue": {
        "type": "integer",
        "description": "Discount from coupon"
      },
      "pickRemoteAreasFee": {
        "type": "integer",
        "description": "Remote pickup area surcharge"
      },
      "deliverRemoteAreasFee": {
        "type": "integer",
        "description": "Remote delivery area surcharge"
      }
    }
  }
}
```

---

### 2. Track Order / Get Order Info (High Priority)

**API Endpoint:** `POST /shiip/public-api/v2/shipping-order/detail`

**Use Case:** AI agent helping customer check order delivery status.

**Tool Definition:**

```json
{
  "actionId": "track_order",
  "name": "Track GHN Shipment",
  "description": "Get current status and details of a GHN shipment. Use this when a customer asks about their order status, delivery progress, or tracking information.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderCode"],
    "properties": {
      "orderCode": {
        "type": "string",
        "description": "GHN order code (tracking number, e.g., 'FFFNL9HH')"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "orderCode": { "type": "string", "description": "GHN tracking number" },
      "clientOrderCode": { "type": "string", "description": "Your order ID" },
      "status": { "type": "string", "description": "Current status code" },
      "statusText": {
        "type": "string",
        "description": "Human-readable status"
      },
      "toName": { "type": "string", "description": "Recipient name" },
      "toPhone": { "type": "string", "description": "Recipient phone" },
      "toAddress": { "type": "string", "description": "Delivery address" },
      "codAmount": { "type": "integer", "description": "COD amount" },
      "weight": { "type": "integer", "description": "Package weight in grams" },
      "leadtime": { "type": "string", "description": "Expected delivery time" },
      "finishDate": {
        "type": "string",
        "description": "Actual delivery date (if delivered)"
      },
      "currentWarehouse": {
        "type": "string",
        "description": "Current location"
      },
      "log": {
        "type": "array",
        "description": "Status history",
        "items": {
          "type": "object",
          "properties": {
            "status": { "type": "string" },
            "updatedDate": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### 3. Create Shipping Order (Medium Priority)

**API Endpoint:** `POST /shiip/public-api/v2/shipping-order/create`

**Use Case:** AI agent creating shipping order on behalf of seller (requires careful confirmation).

**Tool Definition:**

```json
{
  "actionId": "create_order",
  "name": "Create GHN Shipping Order",
  "description": "Create a new shipping order with GHN. IMPORTANT: This action creates a real order - always confirm all details with the user before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": [
      "toName",
      "toPhone",
      "toAddress",
      "toWardCode",
      "toDistrictId",
      "weight",
      "length",
      "width",
      "height",
      "serviceTypeId",
      "paymentTypeId",
      "requiredNote",
      "items"
    ],
    "properties": {
      "fromName": {
        "type": "string",
        "description": "Sender name (defaults to shop info if not provided)"
      },
      "fromPhone": { "type": "string", "description": "Sender phone number" },
      "fromAddress": { "type": "string", "description": "Pickup address" },
      "fromWardName": { "type": "string", "description": "Pickup ward name" },
      "fromDistrictName": {
        "type": "string",
        "description": "Pickup district name"
      },
      "fromProvinceName": {
        "type": "string",
        "description": "Pickup province name"
      },
      "toName": { "type": "string", "description": "Recipient name" },
      "toPhone": { "type": "string", "description": "Recipient phone number" },
      "toAddress": { "type": "string", "description": "Delivery address" },
      "toWardCode": { "type": "string", "description": "Delivery ward code" },
      "toDistrictId": {
        "type": "integer",
        "description": "Delivery district ID"
      },
      "returnPhone": {
        "type": "string",
        "description": "Return contact phone (optional)"
      },
      "returnAddress": {
        "type": "string",
        "description": "Return address (optional)"
      },
      "clientOrderCode": {
        "type": "string",
        "description": "Your unique order ID (max 50 chars)"
      },
      "codAmount": {
        "type": "integer",
        "description": "COD amount to collect (max 50,000,000 VND). Default: 0"
      },
      "content": {
        "type": "string",
        "description": "Order content description (max 2000 chars)"
      },
      "weight": {
        "type": "integer",
        "description": "Weight in grams (max 50,000)"
      },
      "length": { "type": "integer", "description": "Length in cm (max 200)" },
      "width": { "type": "integer", "description": "Width in cm (max 200)" },
      "height": { "type": "integer", "description": "Height in cm (max 200)" },
      "insuranceValue": {
        "type": "integer",
        "description": "Insurance value in VND (max 5,000,000). Default: 0"
      },
      "serviceTypeId": {
        "type": "integer",
        "description": "Service type: 2=E-Commerce, 5=Traditional. Default: 2"
      },
      "paymentTypeId": {
        "type": "integer",
        "description": "Who pays shipping: 1=Seller, 2=Buyer"
      },
      "note": {
        "type": "string",
        "description": "Delivery note for shipper (max 5000 chars)"
      },
      "requiredNote": {
        "type": "string",
        "enum": ["CHOTHUHANG", "CHOXEMHANGKHONGTHU", "KHONGCHOXEMHANG"],
        "description": "CHOTHUHANG=Allow trial, CHOXEMHANGKHONGTHU=View only, KHONGCHOXEMHANG=No viewing"
      },
      "coupon": { "type": "string", "description": "Coupon code for discount" },
      "items": {
        "type": "array",
        "description": "List of items in the order",
        "items": {
          "type": "object",
          "required": ["name", "quantity", "weight"],
          "properties": {
            "name": { "type": "string", "description": "Product name" },
            "code": { "type": "string", "description": "Product code/SKU" },
            "quantity": { "type": "integer", "description": "Quantity" },
            "price": { "type": "integer", "description": "Unit price in VND" },
            "weight": {
              "type": "integer",
              "description": "Item weight in grams"
            },
            "length": { "type": "integer", "description": "Item length in cm" },
            "width": { "type": "integer", "description": "Item width in cm" },
            "height": { "type": "integer", "description": "Item height in cm" }
          }
        }
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "orderCode": { "type": "string", "description": "GHN tracking number" },
      "sortCode": { "type": "string", "description": "Sort code for routing" },
      "transType": {
        "type": "string",
        "description": "Transport type (truck/fly)"
      },
      "totalFee": { "type": "integer", "description": "Total shipping fee" },
      "expectedDeliveryTime": {
        "type": "string",
        "description": "Expected delivery date/time"
      },
      "fee": {
        "type": "object",
        "properties": {
          "mainService": { "type": "integer" },
          "insurance": { "type": "integer" },
          "coupon": { "type": "integer" }
        }
      }
    }
  }
}
```

---

### 4. Cancel Order (Medium Priority)

**API Endpoint:** `POST /shiip/public-api/v2/switch-status/cancel`

**Use Case:** AI agent cancelling an order that hasn't been picked up yet.

**Tool Definition:**

```json
{
  "actionId": "cancel_order",
  "name": "Cancel GHN Order",
  "description": "Cancel one or more shipping orders. Can only cancel orders before pickup. IMPORTANT: This action is irreversible.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderCodes"],
    "properties": {
      "orderCodes": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Array of GHN order codes to cancel"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "orderCode": { "type": "string" },
            "result": { "type": "boolean" },
            "message": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### 5. List Stores (Low Priority)

**API Endpoint:** `POST /shiip/public-api/v2/shop/all`

**Use Case:** AI agent helping user select which warehouse/store to ship from.

**Tool Definition:**

```json
{
  "actionId": "list_stores",
  "name": "List GHN Stores",
  "description": "Get list of configured pickup stores/addresses for the account. Use when user needs to select which location to ship from.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "offset": {
        "type": "integer",
        "description": "Pagination offset. Default: 0"
      },
      "limit": {
        "type": "integer",
        "description": "Max results (max 200). Default: 50"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "shops": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "shopId": { "type": "integer" },
            "name": { "type": "string" },
            "phone": { "type": "string" },
            "address": { "type": "string" },
            "wardCode": { "type": "string" },
            "districtId": { "type": "integer" },
            "status": { "type": "integer" }
          }
        }
      },
      "lastOffset": { "type": "integer" }
    }
  }
}
```

---

### 6. Get Shipping Label (Low Priority)

**API Endpoint:** `POST /shiip/public-api/v2/a5/gen-token`

**Use Case:** Generate shipping label PDF (typically not called by AI, but available).

**Tool Definition:**

```json
{
  "actionId": "get_shipping_label",
  "name": "Get GHN Shipping Label",
  "description": "Generate a shipping label for one or more orders. Returns URLs to download/print labels in different sizes.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderCodes"],
    "properties": {
      "orderCodes": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Array of GHN order codes to generate labels for"
      },
      "size": {
        "type": "string",
        "enum": ["A5", "80x80", "52x70"],
        "default": "A5",
        "description": "Label size format"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "token": {
        "type": "string",
        "description": "Temporary token for label URL"
      },
      "labelUrlA5": {
        "type": "string",
        "description": "URL for A5 size label (expires in 30 min)"
      },
      "labelUrl80x80": {
        "type": "string",
        "description": "URL for 80x80 size label"
      },
      "labelUrl52x70": {
        "type": "string",
        "description": "URL for 52x70 size label"
      }
    }
  }
}
```

---

## Status Codes Reference

| Status                     | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `ready_to_pick`            | Order created, waiting for pickup                    |
| `picking`                  | Shipper is coming to pick up                         |
| `cancel`                   | Order has been cancelled                             |
| `money_collect_picking`    | Shipper interacting with seller (collecting payment) |
| `picked`                   | Goods picked up                                      |
| `storing`                  | Goods at GHN sorting hub                             |
| `transporting`             | Goods being transported between hubs                 |
| `sorting`                  | Goods being classified at warehouse                  |
| `delivering`               | Shipper delivering to customer                       |
| `money_collect_delivering` | Shipper interacting with buyer                       |
| `delivered`                | Successfully delivered                               |
| `delivery_fail`            | Delivery failed                                      |
| `waiting_to_return`        | Pending re-delivery (within 24/48h)                  |
| `return`                   | Returning to seller after 3 failed attempts          |
| `return_transporting`      | Return goods being transported                       |
| `return_sorting`           | Return goods being classified                        |
| `returning`                | Shipper returning to seller                          |
| `return_fail`              | Return failed                                        |
| `returned`                 | Successfully returned to seller                      |
| `exception`                | Exception handling (process deviation)               |
| `damage`                   | Goods damaged                                        |
| `lost`                     | Goods lost                                           |

---

## Webhook Support (Inbound)

GHN supports webhooks to push real-time status updates. Configuration requires contacting GHN support with:

- Client ID
- Webhook URL
- Environment (Staging/Production)
- Name

### Webhook Payload

```json
{
  "CODAmount": 3000000,
  "CODTransferDate": null,
  "ClientOrderCode": "",
  "ConvertedWeight": 200,
  "Description": "Tạo đơn hàng",
  "Fee": {
    "CODFailedFee": 0,
    "CODFee": 0,
    "Coupon": 0,
    "DeliverRemoteAreasFee": 0,
    "DocumentReturn": 0,
    "DoubleCheck": 0,
    "Insurance": 17500,
    "MainService": 53900,
    "PickRemoteAreasFee": 53900,
    "R2S": 0,
    "Return": 0,
    "StationDO": 0,
    "StationPU": 0,
    "Total": 0
  },
  "Height": 10,
  "IsPartialReturn": false,
  "Length": 10,
  "OrderCode": "Z82BS",
  "PartialReturnCode": "",
  "PaymentType": 1,
  "Reason": "",
  "ReasonCode": "",
  "ShopID": 81558,
  "Status": "ready_to_pick",
  "Time": "2021-11-11T03:52:50.158Z",
  "TotalFee": 71400,
  "Type": "create",
  "Warehouse": "Bưu Cục 229 Quan Nhân-Q.Thanh Xuân-HN",
  "Weight": 10,
  "Width": 10
}
```

### Webhook Types

| Type            | Description          |
| --------------- | -------------------- |
| `create`        | Order created        |
| `switch_status` | Order status changed |
| `update_weight` | Weight updated       |
| `update_cod`    | COD amount updated   |
| `update_fee`    | Fee updated          |

**Note:** GHN will retry webhook 10 times (5 seconds apart) if response code is not 200.

---

## Error Handling

| Error Code        | Description                | Recommended Action             |
| ----------------- | -------------------------- | ------------------------------ |
| HTTP 401          | Invalid token              | Ask user to update credentials |
| HTTP 400          | Invalid request parameters | Check input validation         |
| `USER_ERR_COMMON` | General user error         | Check error message details    |
| Order not found   | Order code doesn't exist   | Verify order code with user    |
| Cannot cancel     | Order already in transit   | Explain limitation to user     |

---

## Rate Limiting

GHN doesn't document specific rate limits, but recommended limits:

| Action        | Recommended Limit          |
| ------------- | -------------------------- |
| Calculate fee | 100 requests/minute/tenant |
| Create order  | 30 requests/minute/tenant  |
| Track order   | 60 requests/minute/tenant  |
| Cancel order  | 20 requests/minute/tenant  |

---

## Example AI Agent Conversations

### Scenario 1: Shipping Cost Inquiry

```
Customer: "How much to ship a 500g package from District 1, HCMC to Cau Giay, Hanoi?"

AI Agent: [Uses calculate_fee tool with weight=500, toDistrictId for Cau Giay]
Response: "Shipping a 500g package from District 1, HCMC to Cau Giay, Hanoi via GHN Express costs:
- E-Commerce Delivery: 36,300 VND (2-3 days)
- Insurance available for packages up to 5,000,000 VND
Would you like me to create a shipping order?"
```

### Scenario 2: Order Tracking

```
Customer: "Where is my order FFFNL9HH?"

AI Agent: [Uses track_order tool]
Response: "Your order FFFNL9HH is currently 'delivering' (out for delivery).
- Status: Shipper is delivering to customer
- Recipient: Nguyen Van A
- Address: 72 Thanh Thai, District 10, HCMC
- Expected delivery: Today by 6 PM
The shipper should contact you soon!"
```

### Scenario 3: Create Order

```
Customer: "I need to ship a phone (300g) to Nguyen Van B at 123 Hai Ba Trung, District 1, HCMC. COD 2,000,000 VND."

AI Agent: Let me confirm the details before creating the order:
- Package: Phone, 300g
- Recipient: Nguyen Van B
- Address: 123 Hai Ba Trung, District 1, HCMC
- COD Amount: 2,000,000 VND
- Estimated shipping: ~25,000 VND

Should I proceed with creating this shipping order?

Customer: "Yes, please"

AI Agent: [Uses create_order tool with confirmation]
Response: "Order created successfully!
- GHN Tracking Number: FFFNL9HH
- Expected delivery: Tomorrow afternoon
- Total shipping fee: 25,000 VND (paid by buyer)
You can track this order anytime by asking me about order FFFNL9HH."
```

---

## Address APIs (Helper Tools)

GHN requires district IDs and ward codes for orders. These helper APIs can be used internally:

| API           | Endpoint                                      | Purpose                    |
| ------------- | --------------------------------------------- | -------------------------- |
| Get Provinces | `GET /shiip/public-api/master-data/province`  | List all provinces         |
| Get Districts | `POST /shiip/public-api/master-data/district` | List districts in province |
| Get Wards     | `POST /shiip/public-api/master-data/ward`     | List wards in district     |

**Recommendation:** Cache province/district/ward data locally and provide address autocomplete to users rather than exposing these as AI tools.

---

## Related Documents

- [Integrations Service Architecture](./integrations-service-architecture.md)
- [GHTK Integration Specification](./integrations/shipping-ghtk.md)
