# Sapo Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `ecommerce-sapo`
> **Category**: E-commerce

## Overview

Sapo is one of Vietnam's leading e-commerce and POS platforms, serving over 100,000 merchants. It provides comprehensive tools for online stores, retail management, and omnichannel commerce.

**API Documentation**: [https://support.sapo.vn/gioi-thieu-api](https://support.sapo.vn/gioi-thieu-api)
**Partner Portal**: [https://developers.sapo.vn](https://developers.sapo.vn)
**App Store**: [https://apps.sapo.vn](https://apps.sapo.vn)

---

## Authentication Model

Sapo supports **two authentication methods**:

### Option A: OAuth 2.0 (For Public/Partner Apps)

| Credential      | Description            | Obtained From       |
| --------------- | ---------------------- | ------------------- |
| `api_key`       | Application client ID  | Partner Dashboard   |
| `client_secret` | Application secret key | Partner Dashboard   |
| `access_token`  | Token for API requests | OAuth flow response |

### Option B: Private Apps (For Direct Integration)

| Credential   | Description                       | Obtained From             |
| ------------ | --------------------------------- | ------------------------- |
| `api_key`    | Private app API key               | Sapo Admin > Private Apps |
| `api_secret` | Private app password (Basic Auth) | Sapo Admin > Private Apps |

### Key Characteristics

- **Permanent Tokens**: Access tokens do not expire unless app is uninstalled
- **No Refresh Needed**: Unlike Shopify, tokens remain valid indefinitely
- **HMAC Verification**: Requests from Sapo include HMAC signature for verification
- **Store-Specific**: Each connection is tied to a specific store domain

---

## Environments

| Environment | API Base URL                        | Portal                       |
| ----------- | ----------------------------------- | ---------------------------- |
| Production  | `https://{store}.mysapo.net/admin/` | `https://developers.sapo.vn` |

**Note**: Sapo does not offer a separate sandbox environment. Testing is done on production stores with test data.

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "ecommerce-sapo",
  "category": "ecommerce",
  "name": "Sapo E-commerce",
  "description": "Connect to Sapo stores for orders, products, customers, and inventory management",
  "provider": "Sapo Technology JSC",
  "version": "1.0.0",
  "authType": "oauth2",
  "configSchema": {
    "type": "object",
    "required": ["storeDomain", "accessToken"],
    "properties": {
      "storeDomain": {
        "type": "string",
        "title": "Store Domain",
        "description": "Your Sapo store domain (e.g., mystore.mysapo.net)",
        "pattern": "^[a-z0-9-]+\\.mysapo\\.net$"
      },
      "accessToken": {
        "type": "string",
        "title": "Access Token",
        "description": "API access token from OAuth flow or private app",
        "format": "password"
      },
      "apiKey": {
        "type": "string",
        "title": "API Key (Optional)",
        "description": "Required only for private apps using Basic Auth"
      },
      "apiSecret": {
        "type": "string",
        "title": "API Secret (Optional)",
        "description": "Required only for private apps using Basic Auth",
        "format": "password"
      }
    }
  },
  "credentialFields": ["accessToken", "apiSecret"],
  "configFields": ["storeDomain", "apiKey"],
  "oauthConfig": {
    "authorizationUrl": "https://{store}.mysapo.net/admin/oauth/authorize",
    "tokenUrl": "https://{store}.mysapo.net/admin/oauth/access_token",
    "scopes": [
      "read_products",
      "write_products",
      "read_orders",
      "write_orders",
      "read_customers",
      "write_customers",
      "read_inventory"
    ]
  }
}
```

### Customer Connection Flow

#### Option A: OAuth Flow (Recommended)

1. **Initiate Connection**:
   - Customer enters their store domain (e.g., `mystore.mysapo.net`)
   - We redirect to Sapo authorization page

2. **Authorization URL**:

   ```
   GET https://{store}.mysapo.net/admin/oauth/authorize
     ?client_id={api_key}
     &scope=read_products,write_products,read_orders,write_orders,read_customers
     &redirect_uri={our_callback_url}
   ```

3. **Customer Approves**: Customer logs into Sapo and approves permissions

4. **Callback with Code**: Sapo redirects to our callback with authorization code

5. **Exchange for Token**:

   ```
   POST https://{store}.mysapo.net/admin/oauth/access_token
   Content-Type: application/json

   {
     "client_id": "{api_key}",
     "client_secret": "{client_secret}",
     "code": "{authorization_code}"
   }
   ```

6. **Store Token**: Save access token in Secrets Manager (permanent, no refresh needed)

#### Option B: Private App (Manual Setup)

1. **Customer Creates Private App in Sapo Admin**:
   - Login to Sapo Web Admin
   - Navigate to "Ung dung" (Applications)
   - Click "Ung dung rieng" (Private Apps)
   - Click "Tao ung dung rieng" (Create Private App)
   - Set app name and configure permissions
   - Copy API Key and API Secret

2. **Customer Enters Credentials**: Paste API Key and Secret in our connection UI

3. **We Validate**: Test connection by calling `/admin/shop.json`

### Credential Storage

| Field         | Storage Location  | Notes                      |
| ------------- | ----------------- | -------------------------- |
| `storeDomain` | DynamoDB (config) | Store identifier           |
| `accessToken` | Secrets Manager   | Encrypted, permanent token |
| `apiKey`      | DynamoDB (config) | For private apps only      |
| `apiSecret`   | Secrets Manager   | For private apps only      |

### Token Lifecycle

| Aspect           | Value                                    |
| ---------------- | ---------------------------------------- |
| Token Expiry     | **Never** (permanent)                    |
| Refresh Required | **No**                                   |
| Revocation       | When app is uninstalled or token revoked |

---

## Available Scopes

| Scope                | Resources                                  |
| -------------------- | ------------------------------------------ |
| `read_products`      | Products, variants, images, collections    |
| `write_products`     | Create/update/delete products              |
| `read_orders`        | Orders, transactions, fulfillments         |
| `write_orders`       | Create/update orders, process fulfillments |
| `read_customers`     | Customer profiles, addresses               |
| `write_customers`    | Create/update customer records             |
| `read_inventory`     | Inventory levels                           |
| `write_inventory`    | Adjust inventory quantities                |
| `read_content`       | Articles, blogs, pages                     |
| `write_content`      | Create/update content                      |
| `read_themes`        | Theme assets                               |
| `write_themes`       | Modify theme files                         |
| `read_price_rules`   | Discounts, price rules                     |
| `write_price_rules`  | Create/modify discounts                    |
| `read_draft_orders`  | Draft orders                               |
| `write_draft_orders` | Create/update draft orders                 |
| `read_script_tags`   | Script tags                                |
| `write_script_tags`  | Add/remove script tags                     |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                  | Use Case                                 |
| -------- | --------------------- | ---------------------------------------- |
| High     | `get_order`           | Look up order details by ID              |
| High     | `list_orders`         | Search/filter orders                     |
| High     | `get_product`         | Get product information                  |
| Medium   | `list_products`       | Browse product catalog                   |
| Medium   | `update_order_status` | Update fulfillment status (confirmation) |
| Medium   | `get_customer`        | Look up customer information             |
| Medium   | `check_inventory`     | Check stock levels                       |
| Low      | `list_customers`      | Search customers                         |
| Low      | `create_order`        | Create new order (confirmation)          |

---

### 1. Get Order Details (High Priority)

**API Endpoint:** `GET /admin/orders/{order_id}.json`

**Use Case:** AI agent looking up specific order details for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_order",
  "name": "Get Sapo Order Details",
  "description": "Retrieve detailed information about a specific order including items, customer info, payment status, and fulfillment status. Use when customer asks about their order.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "Sapo order ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "Order ID" },
      "orderNumber": {
        "type": "string",
        "description": "Order number (e.g., #1001)"
      },
      "status": {
        "type": "string",
        "enum": ["open", "closed", "cancelled"],
        "description": "Order status"
      },
      "financialStatus": {
        "type": "string",
        "enum": [
          "pending",
          "authorized",
          "paid",
          "partially_paid",
          "refunded",
          "voided"
        ],
        "description": "Payment status"
      },
      "fulfillmentStatus": {
        "type": "string",
        "enum": ["unfulfilled", "partial", "fulfilled"],
        "description": "Shipping status"
      },
      "totalPrice": { "type": "number", "description": "Total order amount" },
      "currency": { "type": "string", "description": "Currency code (VND)" },
      "customer": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "email": { "type": "string" },
          "firstName": { "type": "string" },
          "lastName": { "type": "string" },
          "phone": { "type": "string" }
        }
      },
      "shippingAddress": {
        "type": "object",
        "properties": {
          "address1": { "type": "string" },
          "city": { "type": "string" },
          "province": { "type": "string" },
          "phone": { "type": "string" }
        }
      },
      "lineItems": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "productId": { "type": "integer" },
            "variantId": { "type": "integer" },
            "title": { "type": "string" },
            "quantity": { "type": "integer" },
            "price": { "type": "number" },
            "sku": { "type": "string" }
          }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" },
      "note": { "type": "string", "description": "Order notes" },
      "tags": { "type": "string", "description": "Order tags" }
    }
  }
}
```

---

### 2. List Orders (High Priority)

**API Endpoint:** `GET /admin/orders.json`

**Use Case:** AI agent searching for orders based on criteria.

**Tool Definition:**

```json
{
  "actionId": "list_orders",
  "name": "List Sapo Orders",
  "description": "Search and list orders with optional filters. Use to find orders by status, date range, or customer.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["any", "open", "closed", "cancelled"],
        "description": "Filter by order status"
      },
      "financialStatus": {
        "type": "string",
        "enum": [
          "any",
          "pending",
          "authorized",
          "paid",
          "partially_paid",
          "refunded",
          "voided"
        ],
        "description": "Filter by payment status"
      },
      "fulfillmentStatus": {
        "type": "string",
        "enum": ["any", "unfulfilled", "partial", "fulfilled"],
        "description": "Filter by fulfillment status"
      },
      "createdAtMin": {
        "type": "string",
        "format": "date-time",
        "description": "Show orders created after this date"
      },
      "createdAtMax": {
        "type": "string",
        "format": "date-time",
        "description": "Show orders created before this date"
      },
      "customerId": {
        "type": "integer",
        "description": "Filter by customer ID"
      },
      "limit": {
        "type": "integer",
        "description": "Number of results (max 250, default 50)",
        "default": 50,
        "maximum": 250
      },
      "page": {
        "type": "integer",
        "description": "Page number",
        "default": 1
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "orders": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "orderNumber": { "type": "string" },
            "status": { "type": "string" },
            "financialStatus": { "type": "string" },
            "fulfillmentStatus": { "type": "string" },
            "totalPrice": { "type": "number" },
            "customerName": { "type": "string" },
            "createdAt": { "type": "string" }
          }
        }
      },
      "totalCount": {
        "type": "integer",
        "description": "Total orders matching criteria"
      }
    }
  }
}
```

---

### 3. Get Product Details (High Priority)

**API Endpoint:** `GET /admin/products/{product_id}.json`

**Use Case:** AI agent retrieving product information for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_product",
  "name": "Get Sapo Product Details",
  "description": "Retrieve detailed information about a product including variants, pricing, and inventory. Use when customer asks about a specific product.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "integer",
        "description": "Sapo product ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "Product ID" },
      "title": { "type": "string", "description": "Product name" },
      "description": {
        "type": "string",
        "description": "Product description (HTML)"
      },
      "vendor": { "type": "string", "description": "Product vendor/brand" },
      "productType": { "type": "string", "description": "Product category" },
      "status": {
        "type": "string",
        "enum": ["active", "draft", "archived"],
        "description": "Product status"
      },
      "tags": { "type": "string", "description": "Product tags" },
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "title": { "type": "string" },
            "sku": { "type": "string" },
            "price": { "type": "number" },
            "compareAtPrice": { "type": "number" },
            "inventoryQuantity": { "type": "integer" },
            "option1": { "type": "string" },
            "option2": { "type": "string" },
            "option3": { "type": "string" }
          }
        }
      },
      "images": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "src": { "type": "string" },
            "position": { "type": "integer" }
          }
        }
      },
      "options": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "values": { "type": "array", "items": { "type": "string" } }
          }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" }
    }
  }
}
```

---

### 4. List Products (Medium Priority)

**API Endpoint:** `GET /admin/products.json`

**Use Case:** AI agent browsing or searching product catalog.

**Tool Definition:**

```json
{
  "actionId": "list_products",
  "name": "List Sapo Products",
  "description": "Search and list products with optional filters. Use to browse catalog or find products by criteria.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Filter by product title (partial match)"
      },
      "vendor": {
        "type": "string",
        "description": "Filter by vendor/brand"
      },
      "productType": {
        "type": "string",
        "description": "Filter by product type/category"
      },
      "collectionId": {
        "type": "integer",
        "description": "Filter by collection ID"
      },
      "status": {
        "type": "string",
        "enum": ["active", "draft", "archived"],
        "description": "Filter by product status"
      },
      "limit": {
        "type": "integer",
        "description": "Number of results (max 250, default 50)",
        "default": 50,
        "maximum": 250
      },
      "page": {
        "type": "integer",
        "description": "Page number",
        "default": 1
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "title": { "type": "string" },
            "vendor": { "type": "string" },
            "productType": { "type": "string" },
            "status": { "type": "string" },
            "price": { "type": "number", "description": "Starting price" },
            "inventoryTotal": { "type": "integer" },
            "imageUrl": { "type": "string" }
          }
        }
      },
      "totalCount": { "type": "integer" }
    }
  }
}
```

---

### 5. Update Order Fulfillment Status (Medium Priority)

**API Endpoint:** `POST /admin/orders/{order_id}/fulfillments.json`

**Use Case:** AI agent updating shipping status when order is shipped.

**Tool Definition:**

```json
{
  "actionId": "update_order_status",
  "name": "Update Sapo Order Fulfillment",
  "description": "Update the fulfillment/shipping status of an order. Use when marking order as shipped or adding tracking information. IMPORTANT: This modifies the order - confirm before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "Sapo order ID"
      },
      "trackingNumber": {
        "type": "string",
        "description": "Shipping tracking number"
      },
      "trackingCompany": {
        "type": "string",
        "description": "Shipping carrier (e.g., GHN, GHTK, Viettel Post)"
      },
      "trackingUrl": {
        "type": "string",
        "description": "Tracking URL",
        "format": "uri"
      },
      "notifyCustomer": {
        "type": "boolean",
        "description": "Send notification email to customer",
        "default": true
      },
      "lineItems": {
        "type": "array",
        "description": "Specific items to fulfill (optional, defaults to all)",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer", "description": "Line item ID" },
            "quantity": {
              "type": "integer",
              "description": "Quantity to fulfill"
            }
          }
        }
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "fulfillmentId": { "type": "integer" },
      "status": { "type": "string" },
      "trackingNumber": { "type": "string" },
      "trackingCompany": { "type": "string" },
      "trackingUrl": { "type": "string" },
      "createdAt": { "type": "string", "format": "date-time" }
    }
  }
}
```

---

### 6. Get Customer Details (Medium Priority)

**API Endpoint:** `GET /admin/customers/{customer_id}.json`

**Use Case:** AI agent looking up customer information.

**Tool Definition:**

```json
{
  "actionId": "get_customer",
  "name": "Get Sapo Customer Details",
  "description": "Retrieve detailed customer information including contact details, addresses, and order history summary.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["customerId"],
    "properties": {
      "customerId": {
        "type": "integer",
        "description": "Sapo customer ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "email": { "type": "string" },
      "firstName": { "type": "string" },
      "lastName": { "type": "string" },
      "phone": { "type": "string" },
      "ordersCount": {
        "type": "integer",
        "description": "Number of orders placed"
      },
      "totalSpent": { "type": "number", "description": "Total amount spent" },
      "tags": { "type": "string" },
      "note": { "type": "string" },
      "defaultAddress": {
        "type": "object",
        "properties": {
          "address1": { "type": "string" },
          "address2": { "type": "string" },
          "city": { "type": "string" },
          "province": { "type": "string" },
          "country": { "type": "string" },
          "zip": { "type": "string" },
          "phone": { "type": "string" }
        }
      },
      "addresses": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "address1": { "type": "string" },
            "city": { "type": "string" },
            "province": { "type": "string" },
            "default": { "type": "boolean" }
          }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" }
    }
  }
}
```

---

### 7. Check Inventory (Medium Priority)

**API Endpoint:** `GET /admin/products/{product_id}/variants/{variant_id}.json`

**Use Case:** AI agent checking stock availability.

**Tool Definition:**

```json
{
  "actionId": "check_inventory",
  "name": "Check Sapo Inventory",
  "description": "Check inventory/stock levels for a product or specific variant. Use when customer asks about product availability.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "integer",
        "description": "Sapo product ID"
      },
      "variantId": {
        "type": "integer",
        "description": "Specific variant ID (optional, returns all variants if not provided)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "productId": { "type": "integer" },
      "productTitle": { "type": "string" },
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "variantId": { "type": "integer" },
            "title": { "type": "string" },
            "sku": { "type": "string" },
            "inventoryQuantity": { "type": "integer" },
            "inventoryPolicy": {
              "type": "string",
              "enum": ["deny", "continue"],
              "description": "deny=stop selling when 0, continue=allow overselling"
            },
            "inStock": { "type": "boolean" }
          }
        }
      },
      "totalInventory": {
        "type": "integer",
        "description": "Total stock across all variants"
      }
    }
  }
}
```

---

## Webhook Support

Sapo provides comprehensive webhook support for real-time notifications.

### Webhook Topics

| Category         | Events                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **App**          | `app/uninstalled`, `app/charge`                                                                                                         |
| **Orders**       | `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`, `orders/partially_fulfilled`, `orders/delete` |
| **Products**     | `products/create`, `products/update`, `products/delete`                                                                                 |
| **Customers**    | `customers/create`, `customers/update`, `customers/delete`, `customers/enable`, `customers/disable`                                     |
| **Fulfillments** | `fulfillments/create`, `fulfillments/update`                                                                                            |
| **Refunds**      | `refunds/create`                                                                                                                        |
| **Collections**  | `collections/create`, `collections/update`, `collections/delete`                                                                        |
| **Carts**        | `carts/create`, `carts/update`                                                                                                          |
| **Store**        | `store/update`                                                                                                                          |

### Webhook Configuration

```json
POST /admin/webhooks.json
{
  "webhook": {
    "topic": "orders/create",
    "address": "https://your-domain.com/webhooks/sapo",
    "format": "json"
  }
}
```

### Webhook Verification

Sapo webhooks include HMAC signature for verification:

```javascript
const crypto = require('crypto');

function verifyWebhook(body, hmacHeader, secretKey) {
  const calculatedHmac = crypto
    .createHmac('sha256', secretKey)
    .update(body, 'utf8')
    .digest('base64');

  return hmacHeader === calculatedHmac;
}
```

---

## Error Handling

| HTTP Status | Description          | Action                            |
| ----------- | -------------------- | --------------------------------- |
| 200         | Success              | Process response                  |
| 400         | Bad Request          | Check request parameters          |
| 401         | Unauthorized         | Invalid or expired token          |
| 403         | Forbidden            | Insufficient permissions (scopes) |
| 404         | Not Found            | Resource doesn't exist            |
| 422         | Unprocessable Entity | Validation errors                 |
| 429         | Too Many Requests    | Rate limited, implement backoff   |
| 500         | Server Error         | Retry with exponential backoff    |

---

## Rate Limiting

Sapo doesn't publish specific rate limits, but recommended limits:

| Action           | Recommended Limit          |
| ---------------- | -------------------------- |
| Read operations  | 120 requests/minute/tenant |
| Write operations | 60 requests/minute/tenant  |
| Bulk operations  | 20 requests/minute/tenant  |

### Pagination

- Default `limit`: 50
- Maximum `limit`: 250
- Use `page` parameter or `since_id` for cursor-based pagination

---

## Example AI Agent Conversations

### Scenario 1: Order Status Inquiry

```
Customer: "What's the status of my order #1234?"

AI Agent: [Uses get_order tool]

Response: "I found your order #1234! Here are the details:

📦 **Order Status**: Processing
💳 **Payment**: Paid (2,450,000 VND)
🚚 **Shipping**: Pending fulfillment

**Items:**
- iPhone 15 Case (x1) - 450,000 VND
- AirPods Pro (x1) - 2,000,000 VND

**Shipping Address:**
123 Nguyen Hue, District 1, Ho Chi Minh City

Your order is being prepared for shipping. Would you like me to notify you when it ships?"
```

### Scenario 2: Product Availability Check

```
Customer: "Do you have the Nike Air Max 90 in size 42?"

AI Agent: [Uses list_products with title filter, then check_inventory]

Response: "Let me check our inventory for Nike Air Max 90...

✅ **In Stock!**
- Nike Air Max 90 - Size 42 (White): 3 available
- Nike Air Max 90 - Size 42 (Black): 1 available

**Price**: 3,200,000 VND

Would you like me to help you place an order?"
```

### Scenario 3: Customer Order History

```
Customer: "Can you show me my recent orders?"

AI Agent: [Uses list_orders filtered by customer]

Response: "Here are your recent orders:

1. **Order #1234** (Jan 8, 2026)
   - Status: Delivered
   - Total: 2,450,000 VND

2. **Order #1198** (Dec 20, 2025)
   - Status: Delivered
   - Total: 850,000 VND

3. **Order #1156** (Dec 5, 2025)
   - Status: Delivered
   - Total: 1,200,000 VND

Would you like details on any of these orders?"
```

### Scenario 4: Update Shipping Status

```
Staff: "Mark order #1234 as shipped with GHN tracking number GHN123456"

AI Agent: Let me confirm before updating:
- Order: #1234
- Carrier: GHN
- Tracking: GHN123456
- Notify customer: Yes

Should I proceed?

Staff: "Yes"

AI Agent: [Uses update_order_status with confirmation]

Response: "Order #1234 has been marked as shipped!

📦 **Fulfillment Created**
🚚 **Carrier**: GHN
🔢 **Tracking**: GHN123456
📧 **Customer Notified**: Yes

The customer will receive an email with tracking information."
```

---

## Security Best Practices

1. **Secure token storage**: Store access tokens in Secrets Manager only
2. **Verify webhooks**: Always validate HMAC signature before processing
3. **Use HTTPS**: All callback URLs must be HTTPS
4. **Minimal scopes**: Request only necessary permissions
5. **Handle uninstalls**: Listen to `app/uninstalled` webhook to clean up data
6. **Log access**: Track API usage for security auditing

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [Haravan Integration Specification](./ecommerce-haravan.md)
- [Shopify Integration Specification](./ecommerce-shopify.md)
