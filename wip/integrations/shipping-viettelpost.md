# Viettel Post Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `shipping-viettelpost`
> **Category**: Shipping

## Overview

Viettel Post (VTP) is Vietnam's largest postal and logistics service provider, operated by Viettel Group (a military-owned telecommunications conglomerate). With over 2,700 post offices and 17,000+ service points nationwide, Viettel Post offers comprehensive coverage including remote and rural areas.

**API Base URL**: `https://api.viettelpost.vn`
**Partner Portal**: `https://partner.viettelpost.vn`

---

## Authentication Model

Viettel Post uses a **username/password → JWT token** authentication model:

| Credential | Description                        | Obtained From                            |
| ---------- | ---------------------------------- | ---------------------------------------- |
| `username` | Partner account email              | Viettel Post Partner Portal registration |
| `password` | Partner account password           | Set during registration                  |
| `token`    | JWT token (obtained via login API) | Generated via `/v2/user/Login` API       |

### Key Characteristics

- **OAuth-like Flow**: Requires login API call to exchange username/password for token
- **Token Type**: JWT-style token (long string)
- **Token Expiration**: Tokens expire after a period (recommended to refresh periodically)
- **Refresh Flow**: Re-authenticate with username/password to get new token

### Login Request

```
POST https://partner.viettelpost.vn/v2/user/Login
Content-Type: application/json

{
  "USERNAME": "your_email@example.com",
  "PASSWORD": "your_password"
}
```

### Login Response

```json
{
  "status": 200,
  "error": false,
  "message": "Thành công",
  "data": {
    "userId": 123456,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "partner": 98765,
    "phone": "0901234567",
    "expired": "2026-02-10T00:00:00"
  }
}
```

### Required Headers (After Login)

```
Token: {JWT_TOKEN}
Content-Type: application/json
```

---

## Environments

| Environment | API Endpoint                 | Partner Portal                   |
| ----------- | ---------------------------- | -------------------------------- |
| Staging     | `https://api.viettelpost.vn` | `https://partner.viettelpost.vn` |
| Production  | `https://api.viettelpost.vn` | `https://partner.viettelpost.vn` |

**Note:** Viettel Post uses the same base URL for staging/production. Environment separation is typically done via account credentials.

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "shipping-viettelpost",
  "category": "shipping",
  "name": "Viettel Post (VTP)",
  "description": "Vietnam's largest postal and logistics service with nationwide coverage including rural areas",
  "provider": "Viettel Post JSC",
  "version": "1.0.0",
  "authType": "oauth_password",
  "configSchema": {
    "type": "object",
    "required": ["username", "password"],
    "properties": {
      "username": {
        "type": "string",
        "title": "Username/Email",
        "description": "Your Viettel Post partner account email"
      },
      "password": {
        "type": "string",
        "title": "Password",
        "description": "Your Viettel Post partner account password",
        "format": "password"
      },
      "token": {
        "type": "string",
        "title": "API Token (Auto-generated)",
        "description": "JWT token obtained via login - auto-managed by the system",
        "format": "password"
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
  "credentialFields": ["username", "password", "token"],
  "configFields": ["environment"]
}
```

### Customer Connection Flow

To connect their Viettel Post account, tenants need to:

1. **Register Partner Account**:
   - Go to `partner.viettelpost.vn`
   - Register for a business/partner account
   - Complete verification process
2. **Get Account Credentials**:
   - Use the registered email as username
   - Use the account password
3. **Enter in Our System**:
   - Provide username and password in our connection setup UI
   - System will automatically call login API to obtain and manage token

### Credential Storage

| Field         | Storage Location  | Notes                       |
| ------------- | ----------------- | --------------------------- |
| `username`    | Secrets Manager   | Partner email, encrypted    |
| `password`    | Secrets Manager   | Partner password, encrypted |
| `token`       | Secrets Manager   | JWT token, auto-refreshed   |
| `environment` | DynamoDB (config) | Determines API behavior     |

### Token Refresh Strategy

The Integrations Service should:

1. Store token with expiration timestamp
2. Check token validity before each API call
3. Refresh token automatically when expired or about to expire (within 1 hour)
4. Retry failed requests with fresh token on 401 errors

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                 | Use Case                                     |
| -------- | -------------------- | -------------------------------------------- |
| High     | `calculate_fee`      | Customer asking about shipping costs         |
| High     | `track_order`        | Customer checking delivery status            |
| Medium   | `create_order`       | Creating new shipment (with confirmation)    |
| Medium   | `cancel_order`       | Cancelling pending order (with confirmation) |
| Low      | `list_warehouses`    | Listing sender warehouses/addresses          |
| Low      | `get_shipping_label` | Getting printable shipping label             |

---

### 1. Calculate Shipping Fee (High Priority)

**API Endpoint:** `POST /api/tmdt/getPriceAll`

**Use Case:** AI agent helping customer estimate shipping costs before order placement.

**Tool Definition:**

```json
{
  "actionId": "calculate_fee",
  "name": "Calculate Viettel Post Shipping Fee",
  "description": "Calculate shipping fee for a package from origin to destination. Use this when a customer asks about shipping costs, delivery fees, or wants to compare shipping options.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": [
      "senderProvince",
      "senderDistrict",
      "receiverProvince",
      "receiverDistrict",
      "productWeight"
    ],
    "properties": {
      "senderProvince": {
        "type": "integer",
        "description": "Sender province ID (use Address API to get ID)"
      },
      "senderDistrict": {
        "type": "integer",
        "description": "Sender district ID"
      },
      "receiverProvince": {
        "type": "integer",
        "description": "Receiver province ID"
      },
      "receiverDistrict": {
        "type": "integer",
        "description": "Receiver district ID"
      },
      "productWeight": {
        "type": "integer",
        "description": "Package weight in GRAMS"
      },
      "productPrice": {
        "type": "integer",
        "description": "Declared product value in VND (for COD/insurance)"
      },
      "moneyCollection": {
        "type": "integer",
        "description": "COD amount to collect in VND. Default: 0"
      },
      "productType": {
        "type": "string",
        "enum": ["HH", "TH"],
        "description": "Product type: HH=Goods, TH=Documents. Default: HH"
      },
      "orderService": {
        "type": "string",
        "description": "Service code. Common values: VCN=Express, VHT=Economy, VBS=Special"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "services": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "serviceCode": {
              "type": "string",
              "description": "Service code (VCN, VHT, VBS, etc.)"
            },
            "serviceName": {
              "type": "string",
              "description": "Service name in Vietnamese"
            },
            "price": {
              "type": "integer",
              "description": "Shipping fee in VND"
            },
            "exchangeWeight": {
              "type": "integer",
              "description": "Converted weight in grams"
            },
            "estimatedDeliveryTime": {
              "type": "string",
              "description": "Estimated delivery time"
            }
          }
        }
      }
    }
  }
}
```

---

### 2. Track Order (High Priority)

**API Endpoint:** `GET /api/setting/getOrderDetailForWeb?OrderNumber={ORDER_NUMBER}`

**Use Case:** AI agent helping customer check order delivery status.

**Tool Definition:**

```json
{
  "actionId": "track_order",
  "name": "Track Viettel Post Shipment",
  "description": "Get current status and details of a Viettel Post shipment. Use this when a customer asks about their order status, delivery progress, or tracking information.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderNumber"],
    "properties": {
      "orderNumber": {
        "type": "string",
        "description": "Viettel Post tracking number (e.g., '1755979111111')"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "Internal order ID"
      },
      "orderNumber": {
        "type": "string",
        "description": "Viettel Post tracking number"
      },
      "orderStatus": {
        "type": "integer",
        "description": "Current status code"
      },
      "orderStatusText": {
        "type": "string",
        "description": "Human-readable status"
      },
      "receiverFullname": {
        "type": "string",
        "description": "Recipient name"
      },
      "receiverAddress": {
        "type": "string",
        "description": "Delivery address"
      },
      "receiverPhone": {
        "type": "string",
        "description": "Recipient phone"
      },
      "productName": {
        "type": "string",
        "description": "Product description"
      },
      "moneyCollection": {
        "type": "integer",
        "description": "COD amount"
      },
      "moneyTotal": {
        "type": "integer",
        "description": "Total shipping fee"
      },
      "orderSystemDate": {
        "type": "string",
        "description": "Order creation date"
      },
      "orderStatusDate": {
        "type": "string",
        "description": "Last status update date"
      }
    }
  }
}
```

---

### 3. Create Shipping Order (Medium Priority)

**API Endpoint:** `POST /api/tmdt/createOrder`

**Use Case:** AI agent creating shipping order on behalf of seller (requires careful confirmation).

**Tool Definition:**

```json
{
  "actionId": "create_order",
  "name": "Create Viettel Post Shipping Order",
  "description": "Create a new shipping order with Viettel Post. IMPORTANT: This action creates a real order - always confirm all details with the user before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": [
      "senderFullname",
      "senderPhone",
      "senderAddress",
      "senderProvince",
      "senderDistrict",
      "senderWards",
      "receiverFullname",
      "receiverPhone",
      "receiverAddress",
      "receiverProvince",
      "receiverDistrict",
      "receiverWards",
      "productName",
      "productWeight",
      "orderPayment"
    ],
    "properties": {
      "orderNumber": {
        "type": "string",
        "description": "Your unique order ID (optional, system generates if not provided)"
      },
      "senderFullname": {
        "type": "string",
        "description": "Sender name"
      },
      "senderPhone": {
        "type": "string",
        "description": "Sender phone number"
      },
      "senderAddress": {
        "type": "string",
        "description": "Sender street address"
      },
      "senderProvince": {
        "type": "integer",
        "description": "Sender province ID"
      },
      "senderDistrict": {
        "type": "integer",
        "description": "Sender district ID"
      },
      "senderWards": {
        "type": "integer",
        "description": "Sender ward ID"
      },
      "receiverFullname": {
        "type": "string",
        "description": "Recipient name"
      },
      "receiverPhone": {
        "type": "string",
        "description": "Recipient phone number"
      },
      "receiverAddress": {
        "type": "string",
        "description": "Recipient street address"
      },
      "receiverProvince": {
        "type": "integer",
        "description": "Recipient province ID"
      },
      "receiverDistrict": {
        "type": "integer",
        "description": "Recipient district ID"
      },
      "receiverWards": {
        "type": "integer",
        "description": "Recipient ward ID"
      },
      "productName": {
        "type": "string",
        "description": "Product description"
      },
      "productWeight": {
        "type": "integer",
        "description": "Weight in grams"
      },
      "productPrice": {
        "type": "integer",
        "description": "Declared product value in VND"
      },
      "moneyCollection": {
        "type": "integer",
        "description": "COD amount to collect (0 if prepaid)"
      },
      "orderPayment": {
        "type": "integer",
        "enum": [1, 2, 3, 4],
        "description": "Payment type: 1=Sender pays all, 2=Receiver pays all, 3=Sender pays shipping/Receiver pays COD, 4=Receiver pays shipping/Sender pays COD"
      },
      "orderService": {
        "type": "string",
        "description": "Service code: VCN=Express, VHT=Economy, VBS=Special"
      },
      "orderNote": {
        "type": "string",
        "description": "Delivery notes for shipper"
      },
      "productType": {
        "type": "string",
        "enum": ["HH", "TH"],
        "description": "Product type: HH=Goods, TH=Documents"
      },
      "listItem": {
        "type": "array",
        "description": "List of items in the order",
        "items": {
          "type": "object",
          "properties": {
            "productName": {
              "type": "string",
              "description": "Item name"
            },
            "productQuantity": {
              "type": "integer",
              "description": "Quantity"
            },
            "productPrice": {
              "type": "integer",
              "description": "Unit price in VND"
            },
            "productWeight": {
              "type": "integer",
              "description": "Item weight in grams"
            }
          }
        }
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean"
      },
      "orderId": {
        "type": "integer",
        "description": "Viettel Post internal order ID"
      },
      "orderNumber": {
        "type": "string",
        "description": "Viettel Post tracking number"
      },
      "moneyTotal": {
        "type": "integer",
        "description": "Total shipping fee"
      },
      "estimatedDeliveryTime": {
        "type": "string",
        "description": "Expected delivery date"
      }
    }
  }
}
```

---

### 4. Cancel Order (Medium Priority)

**API Endpoint:** `POST /api/tmdt/cancelOrder`

**Use Case:** AI agent cancelling an order that hasn't been picked up yet.

**Tool Definition:**

```json
{
  "actionId": "cancel_order",
  "name": "Cancel Viettel Post Order",
  "description": "Cancel a shipping order. Can only cancel orders before pickup. IMPORTANT: This action is irreversible.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderNumber"],
    "properties": {
      "orderNumber": {
        "type": "string",
        "description": "Viettel Post tracking number to cancel"
      },
      "reason": {
        "type": "string",
        "description": "Cancellation reason"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean"
      },
      "message": {
        "type": "string"
      }
    }
  }
}
```

---

### 5. List Warehouses/Addresses (Low Priority)

**API Endpoint:** `GET /api/tmdt/getWarehouse`

**Use Case:** AI agent helping user select which warehouse/address to ship from.

**Tool Definition:**

```json
{
  "actionId": "list_warehouses",
  "name": "List Viettel Post Warehouses",
  "description": "Get list of configured sender warehouses/addresses. Use when user needs to select which location to ship from.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "warehouses": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "warehouseId": {
              "type": "integer"
            },
            "name": {
              "type": "string"
            },
            "phone": {
              "type": "string"
            },
            "address": {
              "type": "string"
            },
            "provinceId": {
              "type": "integer"
            },
            "districtId": {
              "type": "integer"
            },
            "wardId": {
              "type": "integer"
            },
            "isDefault": {
              "type": "boolean"
            }
          }
        }
      }
    }
  }
}
```

---

### 6. Get Shipping Label (Low Priority)

**API Endpoint:** `GET /api/tmdt/printOrder?ORDER_NUMBER={ORDER_NUMBER}`

**Use Case:** Generate shipping label for printing.

**Tool Definition:**

```json
{
  "actionId": "get_shipping_label",
  "name": "Get Viettel Post Shipping Label",
  "description": "Get shipping label PDF for an order. Returns a URL to download/print the label.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderNumber"],
    "properties": {
      "orderNumber": {
        "type": "string",
        "description": "Viettel Post tracking number"
      },
      "format": {
        "type": "string",
        "enum": ["A5", "A6", "A7"],
        "default": "A5",
        "description": "Label size format"
      }
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

Viettel Post uses numeric status codes ranging from -110 to 570+:

### Negative Statuses (Cancelled/Failed)

| Code | Status (Vietnamese)        | Status (English)          |
| ---- | -------------------------- | ------------------------- |
| -100 | Đã hủy                     | Cancelled                 |
| -101 | Hủy do khách hàng          | Cancelled by customer     |
| -102 | Hủy do shop                | Cancelled by shop         |
| -108 | Hủy do không liên lạc được | Cancelled - unreachable   |
| -109 | Hủy do địa chỉ sai         | Cancelled - wrong address |
| -110 | Hủy do khác                | Cancelled - other reason  |

### Pre-Pickup Statuses (100-199)

| Code | Status (Vietnamese) | Status (English)   |
| ---- | ------------------- | ------------------ |
| 100  | Đã tạo đơn          | Order created      |
| 101  | Chờ lấy hàng        | Waiting for pickup |
| 102  | Đã tiếp nhận        | Order accepted     |
| 103  | Đang lấy hàng       | Picking up         |
| 104  | Đã lấy hàng         | Picked up          |
| 105  | Đang đóng gói       | Packaging          |
| 107  | Chờ gửi lại         | Waiting to resend  |

### In Transit Statuses (200-299)

| Code | Status (Vietnamese)     | Status (English) |
| ---- | ----------------------- | ---------------- |
| 200  | Đang vận chuyển         | In transit       |
| 201  | Đến kho trung chuyển    | At transit hub   |
| 202  | Đã rời kho trung chuyển | Left transit hub |

### Delivery Statuses (300-399)

| Code | Status (Vietnamese)   | Status (English)        |
| ---- | --------------------- | ----------------------- |
| 300  | Đến bưu cục phát      | At delivery post office |
| 301  | Đang giao hàng        | Out for delivery        |
| 302  | Giao không thành công | Delivery failed         |
| 303  | Giao một phần         | Partial delivery        |
| 320  | Chờ giao lại          | Waiting to redeliver    |

### Completed Statuses (400-500)

| Code | Status (Vietnamese)    | Status (English)         |
| ---- | ---------------------- | ------------------------ |
| 400  | Giao thành công        | Delivered successfully   |
| 500  | Đã đối soát            | Reconciled (COD settled) |
| 501  | Đã thanh toán cho shop | Paid to shop             |
| 502  | Chờ đối soát           | Pending reconciliation   |
| 503  | Đối soát một phần      | Partial reconciliation   |
| 504  | Đã chuyển khoản        | Bank transfer completed  |

### Return Statuses (500-570)

| Code | Status (Vietnamese)   | Status (English)    |
| ---- | --------------------- | ------------------- |
| 505  | Đang hoàn hàng        | Returning           |
| 506  | Hoàn hàng thành công  | Return completed    |
| 507  | Đang chờ hoàn         | Pending return      |
| 508  | Hoàn một phần         | Partial return      |
| 509  | Hoàn không thành công | Return failed       |
| 515  | Hàng lưu kho          | Stored at warehouse |
| 550  | Hàng thất lạc         | Package lost        |
| 551  | Hàng hư hỏng          | Package damaged     |
| 570  | Đền bù                | Compensation        |

---

## Service Codes Reference

| Code | Service Name         | Description                     |
| ---- | -------------------- | ------------------------------- |
| VCN  | Chuyển phát nhanh    | Express delivery (1-2 days)     |
| VHT  | Hàng hóa thường      | Economy delivery (3-5 days)     |
| VBS  | Chuyển phát đặc biệt | Special express (same/next day) |
| VTK  | Tiết kiệm            | Budget delivery (5-7 days)      |
| VBE  | Bưu phẩm thường      | Standard postal                 |
| V60  | Nội tỉnh 60 phút     | Intra-province 60 minutes       |
| PTN  | Phát trong ngày      | Same-day delivery               |

---

## Webhook Support (Inbound)

Viettel Post supports webhooks to push real-time status updates.

### Webhook Configuration

Contact Viettel Post support or configure via Partner Portal:

- Provide webhook URL
- Select events to subscribe (status updates, delivery confirmation, etc.)

### Webhook Payload

```json
{
  "ORDER_NUMBER": "1755979111111",
  "ORDER_STATUS": 400,
  "ORDER_STATUSDATE": "2026-01-10T14:30:00",
  "MONEY_COLLECTION": 500000,
  "MONEY_TOTAL": 25000,
  "PRODUCT_NAME": "Điện thoại Samsung",
  "RECEIVER_FULLNAME": "Nguyen Van A",
  "RECEIVER_PHONE": "0901234567",
  "REASON": ""
}
```

**Note:** Webhook retry policy and signature verification details should be confirmed with Viettel Post support.

---

## Error Handling

| Error Code      | Description                | Recommended Action                |
| --------------- | -------------------------- | --------------------------------- |
| HTTP 401        | Invalid or expired token   | Refresh token via login API       |
| HTTP 400        | Invalid request parameters | Check input validation            |
| `status: false` | API error                  | Check `message` field for details |
| Order not found | Order number doesn't exist | Verify order number with user     |
| Cannot cancel   | Order already in transit   | Explain limitation to user        |

### Error Response Format

```json
{
  "status": 500,
  "error": true,
  "message": "Error description in Vietnamese",
  "data": null
}
```

---

## Rate Limiting

Viettel Post doesn't document specific rate limits, but recommended limits:

| Action        | Recommended Limit          |
| ------------- | -------------------------- |
| Calculate fee | 100 requests/minute/tenant |
| Create order  | 30 requests/minute/tenant  |
| Track order   | 60 requests/minute/tenant  |
| Cancel order  | 20 requests/minute/tenant  |

---

## Address APIs (Helper Tools)

Viettel Post requires province/district/ward IDs for orders. These helper APIs can be used internally:

| API           | Endpoint                                           | Purpose                    |
| ------------- | -------------------------------------------------- | -------------------------- |
| Get Provinces | `GET /api/setting/listallprovince`                 | List all provinces         |
| Get Districts | `GET /api/setting/listalldistrict?provinceId={ID}` | List districts in province |
| Get Wards     | `GET /api/setting/listallwards?districtId={ID}`    | List wards in district     |

**Recommendation:** Cache province/district/ward data locally and provide address autocomplete to users rather than exposing these as AI tools.

---

## Example AI Agent Conversations

### Scenario 1: Shipping Cost Inquiry

```
Customer: "How much to ship a 1kg package from District 1, HCMC to Ba Dinh, Hanoi?"

AI Agent: [Uses calculate_fee tool]
Response: "Shipping a 1kg package from District 1, HCMC to Ba Dinh, Hanoi via Viettel Post:
- Express (VCN): 42,000 VND (1-2 days)
- Economy (VHT): 28,000 VND (3-5 days)
- Budget (VTK): 22,000 VND (5-7 days)
Would you like me to create a shipping order?"
```

### Scenario 2: Order Tracking

```
Customer: "Where is my order 1755979111111?"

AI Agent: [Uses track_order tool]
Response: "Your order 1755979111111 is currently 'Out for delivery' (status 301).
- Status: Shipper is delivering to customer
- Recipient: Nguyen Van A
- Address: 123 Nguyen Chi Thanh, Ba Dinh, Hanoi
- Last update: Today at 2:30 PM
The shipper should contact you within the next few hours!"
```

### Scenario 3: Create Order

```
Customer: "I need to ship a laptop (2kg) to Tran Van B at 456 Le Loi, District 1, HCMC. COD 5,000,000 VND."

AI Agent: Let me confirm the details before creating the order:
- Package: Laptop, 2kg
- Recipient: Tran Van B
- Address: 456 Le Loi, District 1, HCMC
- COD Amount: 5,000,000 VND
- Service: Express (VCN)
- Estimated shipping: ~45,000 VND

Should I proceed with creating this shipping order?

Customer: "Yes, please"

AI Agent: [Uses create_order tool with confirmation]
Response: "Order created successfully!
- Viettel Post Tracking Number: 1756012345678
- Expected delivery: Tomorrow afternoon
- Total shipping fee: 45,000 VND
You can track this order anytime using the tracking number 1756012345678."
```

---

## Integration Notes

### Advantages of Viettel Post

1. **Nationwide Coverage**: Best coverage in rural/remote areas due to postal network
2. **Competitive Pricing**: Often cheaper than competitors for economy services
3. **Government-backed**: Stable service backed by Viettel Group
4. **COD Support**: Strong COD collection and reconciliation system

### Limitations

1. **API Documentation**: Less comprehensive public documentation compared to GHN/GHTK
2. **Token Management**: Requires periodic token refresh
3. **Response Format**: Uses UPPERCASE field names in responses

### Data Mapping Notes

When mapping Viettel Post responses to internal Order model:

- `ORDER_ID` → `orderId`
- `ORDER_NUMBER` → `orderNumber`
- `ORDER_STATUS` → `orderStatus`
- `RECEIVER_FULLNAME` → `receiverFullname`
- `RECEIVER_ADDRESS` → `receiverAddress`
- `RECEIVER_PHONE` → `receiverPhone`
- `PRODUCT_NAME` → `productName`
- `MONEY_COLLECTION` → `moneyCollection`
- `MONEY_TOTAL` → `moneyTotal`
- `ORDER_SYSTEMDATE` → `orderSystemDate`
- `ORDER_STATUSDATE` → `orderStatusDate`

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [GHTK Integration Specification](./shipping-ghtk.md)
- [GHN Integration Specification](./shipping-ghn.md)
