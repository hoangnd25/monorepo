# Haravan Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `ecommerce-haravan`
> **Category**: E-commerce

## Overview

Haravan is Vietnam's leading e-commerce platform, powering over 50,000 online stores. Built on similar architecture to Shopify, it provides comprehensive tools for Vietnamese merchants including multi-channel selling, POS, and logistics integration.

**API Documentation**: [https://docs.haravan.com](https://docs.haravan.com)
**Developer Portal**: [https://developers.haravan.com](https://developers.haravan.com)
**App Store**: [https://apps.haravan.com](https://apps.haravan.com)

---

## Authentication Model

Haravan supports **two authentication methods**:

### Option A: OAuth 2.0 (For Public/Partner Apps)

| Credential      | Description            | Obtained From       |
| --------------- | ---------------------- | ------------------- |
| `client_id`     | Application client ID  | Partner Dashboard   |
| `client_secret` | Application secret key | Partner Dashboard   |
| `access_token`  | Token for API requests | OAuth flow response |

### Option B: Private Apps (For Direct Integration)

| Credential | Description                       | Obtained From                  |
| ---------- | --------------------------------- | ------------------------------ |
| `api_key`  | Private app API key               | Haravan Admin > Apps > Private |
| `password` | Private app password (Basic Auth) | Haravan Admin > Apps > Private |

### Key Characteristics

- **Permanent Tokens**: Access tokens do not expire unless app is uninstalled
- **No Refresh Needed**: Tokens remain valid indefinitely
- **Shopify-Compatible**: API structure very similar to Shopify
- **Vietnamese Localization**: Built-in support for Vietnamese addresses, provinces, districts, wards

---

## Environments

| Environment | API Base URL                                   | Portal                           |
| ----------- | ---------------------------------------------- | -------------------------------- |
| Production  | `https://apis.haravan.com/com/{resource}.json` | `https://developers.haravan.com` |

**Alternative URL Format:**

```
https://{store}.myharavan.com/admin/{resource}.json
```

**Note**: Haravan does not offer a separate sandbox. Testing is done on production stores with test data.

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "ecommerce-haravan",
  "category": "ecommerce",
  "name": "Haravan E-commerce",
  "description": "Connect to Haravan stores for orders, products, customers, and inventory management",
  "provider": "Haravan Company Limited",
  "version": "1.0.0",
  "authType": "oauth2",
  "configSchema": {
    "type": "object",
    "required": ["storeDomain", "accessToken"],
    "properties": {
      "storeDomain": {
        "type": "string",
        "title": "Store Domain",
        "description": "Your Haravan store domain (e.g., mystore.myharavan.com)",
        "pattern": "^[a-z0-9-]+\\.myharavan\\.com$"
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
        "description": "Required only for private apps"
      },
      "password": {
        "type": "string",
        "title": "Password (Optional)",
        "description": "Required only for private apps using Basic Auth",
        "format": "password"
      }
    }
  },
  "credentialFields": ["accessToken", "password"],
  "configFields": ["storeDomain", "apiKey"],
  "oauthConfig": {
    "authorizationUrl": "https://accounts.haravan.com/connect/authorize",
    "tokenUrl": "https://accounts.haravan.com/connect/token",
    "scopes": [
      "openid",
      "profile",
      "email",
      "org",
      "userinfo",
      "com.read_products",
      "com.write_products",
      "com.read_orders",
      "com.write_orders",
      "com.read_customers",
      "com.write_customers",
      "com.read_inventory"
    ]
  }
}
```

### Customer Connection Flow

#### Option A: OAuth Flow (Recommended)

1. **Initiate Connection**:
   - Customer clicks "Connect Haravan" in our UI
   - We redirect to Haravan authorization page

2. **Authorization URL**:

   ```
   GET https://accounts.haravan.com/connect/authorize
     ?response_type=code
     &client_id={client_id}
     &scope=openid profile email org com.read_orders com.write_orders com.read_products com.read_customers
     &redirect_uri={our_callback_url}
     &state={nonce}
     &nonce={nonce}
   ```

3. **Customer Approves**: Customer logs into Haravan and approves permissions

4. **Callback with Code**: Haravan redirects to our callback with authorization code

5. **Exchange for Token**:

   ```
   POST https://accounts.haravan.com/connect/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={authorization_code}
   &redirect_uri={our_callback_url}
   &client_id={client_id}
   &client_secret={client_secret}
   ```

6. **Response**:

   ```json
   {
     "access_token": "xxx",
     "token_type": "Bearer",
     "expires_in": 86400,
     "id_token": "xxx",
     "scope": "openid profile email org com.read_orders..."
   }
   ```

7. **Get Store Info**: Use the token to call `/com/shop.json` to get store domain

8. **Store Token**: Save access token in Secrets Manager

#### Option B: Private App (Manual Setup)

1. **Customer Creates Private App in Haravan Admin**:
   - Login to Haravan Admin
   - Navigate to Apps > Private Apps
   - Click "Create Private App"
   - Set app name and configure permissions
   - Copy API Key and Password

2. **Customer Enters Credentials**: Paste API Key and Password in our connection UI

3. **We Validate**: Test connection by calling `/com/shop.json`

### Credential Storage

| Field         | Storage Location  | Notes                      |
| ------------- | ----------------- | -------------------------- |
| `storeDomain` | DynamoDB (config) | Store identifier           |
| `accessToken` | Secrets Manager   | Encrypted, permanent token |
| `apiKey`      | DynamoDB (config) | For private apps only      |
| `password`    | Secrets Manager   | For private apps only      |

### Token Lifecycle

| Aspect           | Value                                    |
| ---------------- | ---------------------------------------- |
| Token Expiry     | **Never** (permanent for offline tokens) |
| Refresh Required | **No**                                   |
| Revocation       | When app is uninstalled or token revoked |

---

## Available Scopes

| Scope                   | Resources                                    |
| ----------------------- | -------------------------------------------- |
| `openid`                | Required for OAuth (OpenID Connect)          |
| `profile`               | User profile information                     |
| `email`                 | User email                                   |
| `org`                   | Organization/store information               |
| `com.read_products`     | Read products, variants, images, collections |
| `com.write_products`    | Create/update/delete products                |
| `com.read_orders`       | Read orders, transactions, fulfillments      |
| `com.write_orders`      | Create/update orders, process fulfillments   |
| `com.read_customers`    | Read customer profiles, addresses            |
| `com.write_customers`   | Create/update customer records               |
| `com.read_inventory`    | Read inventory levels                        |
| `com.write_inventory`   | Adjust inventory quantities                  |
| `com.read_content`      | Read articles, blogs, pages                  |
| `com.write_content`     | Create/update content                        |
| `com.read_themes`       | Read theme assets                            |
| `com.write_themes`      | Modify theme files                           |
| `com.read_price_rules`  | Read discounts, price rules                  |
| `com.write_price_rules` | Create/modify discounts                      |
| `com.read_locations`    | Read store locations                         |
| `com.read_shipping`     | Read shipping settings                       |

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
| Low      | `search_customers`    | Search customers by phone/email          |
| Low      | `get_locations`       | Get store/warehouse locations            |

---

### 1. Get Order Details (High Priority)

**API Endpoint:** `GET /com/orders/{order_id}.json`

**Use Case:** AI agent looking up specific order details for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_order",
  "name": "Get Haravan Order Details",
  "description": "Retrieve detailed information about a specific order including items, customer info, payment status, and fulfillment status. Use when customer asks about their order.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "Haravan order ID"
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
      "name": { "type": "string", "description": "Order name (#1001)" },
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
          "voided",
          "partially_refunded"
        ],
        "description": "Payment status"
      },
      "fulfillmentStatus": {
        "type": "string",
        "enum": ["unfulfilled", "partial", "fulfilled", "noteligible"],
        "description": "Shipping status"
      },
      "totalPrice": { "type": "number", "description": "Total order amount" },
      "subtotalPrice": {
        "type": "number",
        "description": "Subtotal before shipping/discount"
      },
      "totalDiscounts": {
        "type": "number",
        "description": "Total discounts applied"
      },
      "totalShippingPrice": {
        "type": "number",
        "description": "Shipping cost"
      },
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
          "ward": { "type": "string" },
          "district": { "type": "string" },
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
            "variantTitle": { "type": "string" },
            "quantity": { "type": "integer" },
            "price": { "type": "number" },
            "sku": { "type": "string" },
            "fulfillmentStatus": { "type": "string" }
          }
        }
      },
      "fulfillments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "status": { "type": "string" },
            "trackingNumber": { "type": "string" },
            "trackingCompany": { "type": "string" },
            "trackingUrl": { "type": "string" }
          }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" },
      "cancelledAt": { "type": "string", "format": "date-time" },
      "note": { "type": "string", "description": "Order notes" },
      "tags": { "type": "string", "description": "Order tags" },
      "gateway": { "type": "string", "description": "Payment gateway used" }
    }
  }
}
```

---

### 2. List Orders (High Priority)

**API Endpoint:** `GET /com/orders.json`

**Use Case:** AI agent searching for orders based on criteria.

**Tool Definition:**

```json
{
  "actionId": "list_orders",
  "name": "List Haravan Orders",
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
        "description": "Show orders created after this date (ISO 8601)"
      },
      "createdAtMax": {
        "type": "string",
        "format": "date-time",
        "description": "Show orders created before this date"
      },
      "processedAtMin": {
        "type": "string",
        "format": "date-time",
        "description": "Show orders processed after this date"
      },
      "processedAtMax": {
        "type": "string",
        "format": "date-time",
        "description": "Show orders processed before this date"
      },
      "sinceId": {
        "type": "integer",
        "description": "Show orders after this ID (for pagination)"
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
      },
      "order": {
        "type": "string",
        "enum": [
          "created_at asc",
          "created_at desc",
          "updated_at asc",
          "updated_at desc"
        ],
        "description": "Sort order",
        "default": "created_at desc"
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
            "name": { "type": "string" },
            "orderNumber": { "type": "integer" },
            "status": { "type": "string" },
            "financialStatus": { "type": "string" },
            "fulfillmentStatus": { "type": "string" },
            "totalPrice": { "type": "number" },
            "customerName": { "type": "string" },
            "customerPhone": { "type": "string" },
            "createdAt": { "type": "string" },
            "itemCount": { "type": "integer" }
          }
        }
      },
      "count": {
        "type": "integer",
        "description": "Total orders matching criteria"
      }
    }
  }
}
```

---

### 3. Get Product Details (High Priority)

**API Endpoint:** `GET /com/products/{product_id}.json`

**Use Case:** AI agent retrieving product information for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_product",
  "name": "Get Haravan Product Details",
  "description": "Retrieve detailed information about a product including variants, pricing, and inventory. Use when customer asks about a specific product.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "integer",
        "description": "Haravan product ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "Product ID" },
      "title": { "type": "string", "description": "Product name" },
      "bodyHtml": {
        "type": "string",
        "description": "Product description (HTML)"
      },
      "vendor": { "type": "string", "description": "Product vendor/brand" },
      "productType": { "type": "string", "description": "Product category" },
      "handle": { "type": "string", "description": "URL-friendly handle" },
      "publishedAt": {
        "type": "string",
        "description": "When product was published"
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
            "barcode": { "type": "string" },
            "price": { "type": "number" },
            "compareAtPrice": { "type": "number" },
            "inventoryQuantity": { "type": "integer" },
            "inventoryManagement": { "type": "string" },
            "inventoryPolicy": { "type": "string" },
            "option1": { "type": "string" },
            "option2": { "type": "string" },
            "option3": { "type": "string" },
            "weight": { "type": "number" },
            "weightUnit": { "type": "string" }
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
            "position": { "type": "integer" },
            "alt": { "type": "string" }
          }
        }
      },
      "options": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" },
            "position": { "type": "integer" },
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

**API Endpoint:** `GET /com/products.json`

**Use Case:** AI agent browsing or searching product catalog.

**Tool Definition:**

```json
{
  "actionId": "list_products",
  "name": "List Haravan Products",
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
      "handle": {
        "type": "string",
        "description": "Filter by product handle"
      },
      "publishedStatus": {
        "type": "string",
        "enum": ["published", "unpublished", "any"],
        "description": "Filter by published status"
      },
      "sinceId": {
        "type": "integer",
        "description": "Show products after this ID"
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
            "handle": { "type": "string" },
            "priceMin": {
              "type": "number",
              "description": "Lowest variant price"
            },
            "priceMax": {
              "type": "number",
              "description": "Highest variant price"
            },
            "totalInventory": { "type": "integer" },
            "imageUrl": { "type": "string" },
            "variantCount": { "type": "integer" }
          }
        }
      },
      "count": { "type": "integer" }
    }
  }
}
```

---

### 5. Update Order Fulfillment (Medium Priority)

**API Endpoint:** `PUT /com/orders/{order_id}.json`

**Use Case:** AI agent updating shipping status when order is shipped.

**Tool Definition:**

```json
{
  "actionId": "update_order_status",
  "name": "Update Haravan Order Fulfillment",
  "description": "Update the fulfillment/shipping status of an order. Use when marking order as shipped or adding tracking information. IMPORTANT: This modifies the order - confirm before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "Haravan order ID"
      },
      "trackingNumber": {
        "type": "string",
        "description": "Shipping tracking number"
      },
      "trackingCompany": {
        "type": "string",
        "description": "Shipping carrier (e.g., GHN, GHTK, Viettel Post)",
        "enum": [
          "GHN",
          "GHTK",
          "Viettel Post",
          "VNPost",
          "J&T Express",
          "Ninja Van",
          "Other"
        ]
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
        "description": "Specific items to fulfill (optional, defaults to all unfulfilled)",
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
      "orderId": { "type": "integer" },
      "fulfillmentStatus": { "type": "string" },
      "fulfillment": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "trackingNumber": { "type": "string" },
          "trackingCompany": { "type": "string" },
          "trackingUrl": { "type": "string" },
          "status": { "type": "string" },
          "createdAt": { "type": "string" }
        }
      }
    }
  }
}
```

---

### 6. Get Customer Details (Medium Priority)

**API Endpoint:** `GET /com/customers/{customer_id}.json`

**Use Case:** AI agent looking up customer information.

**Tool Definition:**

```json
{
  "actionId": "get_customer",
  "name": "Get Haravan Customer Details",
  "description": "Retrieve detailed customer information including contact details, addresses, and order history summary.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["customerId"],
    "properties": {
      "customerId": {
        "type": "integer",
        "description": "Haravan customer ID"
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
      "state": { "type": "string", "enum": ["enabled", "disabled", "invited"] },
      "tags": { "type": "string" },
      "note": { "type": "string" },
      "verifiedEmail": { "type": "boolean" },
      "taxExempt": { "type": "boolean" },
      "defaultAddress": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "address1": { "type": "string" },
          "address2": { "type": "string" },
          "ward": { "type": "string" },
          "district": { "type": "string" },
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
            "ward": { "type": "string" },
            "district": { "type": "string" },
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

**API Endpoint:** `GET /com/inventory_levels.json`

**Use Case:** AI agent checking stock availability.

**Tool Definition:**

```json
{
  "actionId": "check_inventory",
  "name": "Check Haravan Inventory",
  "description": "Check inventory/stock levels for a product or specific variant. Use when customer asks about product availability.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "inventoryItemIds": {
        "type": "array",
        "items": { "type": "integer" },
        "description": "List of inventory item IDs to check"
      },
      "locationId": {
        "type": "integer",
        "description": "Specific location ID (optional, returns all locations if not provided)"
      },
      "productId": {
        "type": "integer",
        "description": "Product ID to check all variants"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "inventoryLevels": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "inventoryItemId": { "type": "integer" },
            "locationId": { "type": "integer" },
            "locationName": { "type": "string" },
            "available": {
              "type": "integer",
              "description": "Available quantity"
            },
            "incoming": { "type": "integer", "description": "Incoming stock" },
            "committed": {
              "type": "integer",
              "description": "Reserved for orders"
            }
          }
        }
      },
      "totalAvailable": {
        "type": "integer",
        "description": "Total available across all locations"
      }
    }
  }
}
```

---

### 8. Search Customers (Low Priority)

**API Endpoint:** `GET /com/customers/search.json`

**Use Case:** AI agent finding customer by phone or email.

**Tool Definition:**

```json
{
  "actionId": "search_customers",
  "name": "Search Haravan Customers",
  "description": "Search for customers by phone number, email, or name. Use to find customer records.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (phone, email, or name)"
      },
      "phone": {
        "type": "string",
        "description": "Search by phone number"
      },
      "email": {
        "type": "string",
        "description": "Search by email address"
      },
      "limit": {
        "type": "integer",
        "default": 50,
        "maximum": 250
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "customers": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "email": { "type": "string" },
            "firstName": { "type": "string" },
            "lastName": { "type": "string" },
            "phone": { "type": "string" },
            "ordersCount": { "type": "integer" },
            "totalSpent": { "type": "number" }
          }
        }
      },
      "count": { "type": "integer" }
    }
  }
}
```

---

## Vietnamese Address Support

Haravan provides built-in APIs for Vietnamese geographic data:

| Endpoint                  | Description                   |
| ------------------------- | ----------------------------- |
| `GET /com/provinces.json` | List all Vietnamese provinces |
| `GET /com/districts.json` | List districts by province    |
| `GET /com/wards.json`     | List wards by district        |

### Example: Get Districts

```
GET /com/districts.json?province_id=201
```

This is useful for address validation and autocomplete.

---

## Webhook Support

Haravan provides comprehensive webhook support.

### Webhook Topics

| Category         | Events                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **App**          | `app/uninstalled`                                                                                                                       |
| **Orders**       | `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`, `orders/partially_fulfilled`, `orders/delete` |
| **Products**     | `products/create`, `products/update`, `products/delete`                                                                                 |
| **Customers**    | `customers/create`, `customers/update`, `customers/delete`                                                                              |
| **Inventory**    | `inventory_levels/update`, `inventory_levels/connect`, `inventory_levels/disconnect`                                                    |
| **Fulfillments** | `fulfillments/create`, `fulfillments/update`                                                                                            |
| **Refunds**      | `refunds/create`                                                                                                                        |
| **Collections**  | `collections/create`, `collections/update`, `collections/delete`                                                                        |

### Webhook Configuration

```json
POST /com/webhooks.json
{
  "webhook": {
    "topic": "orders/create",
    "address": "https://your-domain.com/webhooks/haravan",
    "format": "json"
  }
}
```

### Webhook Verification

Haravan webhooks include HMAC signature in `X-Haravan-Hmac-Sha256` header:

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

## Rate Limiting

Haravan uses a leaky bucket algorithm:

| Metric         | Value               |
| -------------- | ------------------- |
| Bucket Size    | 40 requests         |
| Leak Rate      | 2 requests/second   |
| Burst Capacity | 40 requests at once |

### Rate Limit Headers

| Header                          | Description                   |
| ------------------------------- | ----------------------------- |
| `X-Haravan-Shop-Api-Call-Limit` | Current usage (e.g., "32/40") |

### Handling Rate Limits

When rate limited (HTTP 429):

1. Check `Retry-After` header
2. Implement exponential backoff
3. Queue and batch requests when possible

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
| 429         | Too Many Requests    | Rate limited, check Retry-After   |
| 500/502     | Server Error         | Retry with exponential backoff    |

---

## Example AI Agent Conversations

### Scenario 1: Order Lookup with Vietnamese Address

```
Customer: "Tôi muốn kiểm tra đơn hàng #1234"

AI Agent: [Uses get_order tool]

Response: "Tôi đã tìm thấy đơn hàng #1234 của bạn:

📦 **Trạng thái**: Đang giao hàng
💳 **Thanh toán**: Đã thanh toán (1,850,000 VND)
🚚 **Vận chuyển**: GHN - Mã vận đơn: GHN123456

**Sản phẩm:**
- Áo thun nam size L (x2) - 400,000 VND
- Quần jean slim fit (x1) - 650,000 VND
- Giày sneaker (x1) - 800,000 VND

**Địa chỉ giao hàng:**
123 Nguyễn Huệ, Phường Bến Nghé
Quận 1, TP. Hồ Chí Minh

Bạn có thể theo dõi đơn hàng tại: https://ghn.vn/track/GHN123456"
```

### Scenario 2: Product Search with Variants

```
Customer: "Cho tôi xem áo thun màu trắng size M"

AI Agent: [Uses list_products then get_product]

Response: "Tôi tìm thấy sản phẩm phù hợp:

**Áo Thun Basic Cotton**
- Giá: 250,000 VND
- Màu: Trắng, Đen, Xanh navy
- Size có sẵn: S, M, L, XL

✅ **Size M màu Trắng**: Còn 15 cái

Bạn có muốn đặt hàng không?"
```

### Scenario 3: Customer History

```
Staff: "Tìm khách hàng số điện thoại 0901234567"

AI Agent: [Uses search_customers then get_customer]

Response: "Đã tìm thấy khách hàng:

👤 **Nguyễn Văn A**
📧 nguyenvana@email.com
📱 0901234567

📊 **Thống kê:**
- Số đơn hàng: 12
- Tổng chi tiêu: 25,400,000 VND

📍 **Địa chỉ mặc định:**
456 Lê Lợi, Phường Bến Thành
Quận 1, TP. Hồ Chí Minh

Bạn muốn xem chi tiết đơn hàng nào?"
```

### Scenario 4: Update Shipping

```
Staff: "Cập nhật đơn #1234 đã giao cho GHN, mã GHN789012"

AI Agent: Để tôi xác nhận trước khi cập nhật:
- Đơn hàng: #1234
- Đơn vị vận chuyển: GHN
- Mã vận đơn: GHN789012
- Gửi thông báo cho khách: Có

Xác nhận cập nhật?

Staff: "Đồng ý"

AI Agent: [Uses update_order_status with confirmation]

Response: "Đã cập nhật đơn hàng #1234!

✅ **Trạng thái**: Đã giao cho vận chuyển
🚚 **GHN**: GHN789012
📧 **Đã gửi email thông báo cho khách hàng**

Link theo dõi: https://ghn.vn/track/GHN789012"
```

---

## Security Best Practices

1. **Secure token storage**: Store access tokens in Secrets Manager only
2. **Verify webhooks**: Always validate HMAC signature before processing
3. **Use HTTPS**: All callback URLs must be HTTPS
4. **Minimal scopes**: Request only necessary permissions
5. **Handle uninstalls**: Listen to `app/uninstalled` webhook to clean up data
6. **Rate limit awareness**: Monitor `X-Haravan-Shop-Api-Call-Limit` header
7. **PII protection**: Don't log customer personal information

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [Sapo Integration Specification](./ecommerce-sapo.md)
- [Shopify Integration Specification](./ecommerce-shopify.md)
