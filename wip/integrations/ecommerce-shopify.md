# Shopify Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-10
> **Integration ID**: `ecommerce-shopify`
> **Category**: E-commerce

## Overview

Shopify is the world's leading e-commerce platform, powering over 4 million online stores globally. It provides a comprehensive suite of tools for merchants to sell online, in-store, and across multiple channels.

**API Documentation**: [https://shopify.dev/docs/api](https://shopify.dev/docs/api)
**Partner Dashboard**: [https://partners.shopify.com](https://partners.shopify.com)
**App Store**: [https://apps.shopify.com](https://apps.shopify.com)

---

## Authentication Model

Shopify uses **OAuth 2.0** with support for multiple token types:

### Token Types

| Token Type                              | Duration   | Use Case                           |
| --------------------------------------- | ---------- | ---------------------------------- |
| **Online Access Token**                 | 24 hours   | User session-based actions         |
| **Offline Access Token (Non-expiring)** | Indefinite | Background jobs, webhooks (legacy) |
| **Offline Access Token (Expiring)**     | 1 hour     | Enhanced security (recommended)    |

### Credential Requirements

| Credential      | Description                    | Obtained From       |
| --------------- | ------------------------------ | ------------------- |
| `client_id`     | API key for the app            | Partner Dashboard   |
| `client_secret` | App secret key                 | Partner Dashboard   |
| `access_token`  | Token for API requests         | OAuth flow response |
| `refresh_token` | For refreshing expiring tokens | OAuth flow response |

### Key Characteristics

- **OAuth 2.0 Required**: All apps must use OAuth (no simple API keys)
- **Expiring Tokens (New)**: Shopify is transitioning to expiring offline tokens (1-hour lifetime)
- **Refresh Tokens**: 90-day lifetime for refresh tokens
- **Scopes Required**: Explicit permission scopes for each resource
- **GraphQL Preferred**: GraphQL Admin API is the primary API

---

## Environments

| Environment | API Base URL                                        | Dashboard                      |
| ----------- | --------------------------------------------------- | ------------------------------ |
| Development | `https://{shop}.myshopify.com/admin/api/{version}/` | Partner Dashboard (dev stores) |
| Production  | `https://{shop}.myshopify.com/admin/api/{version}/` | Partner Dashboard              |

**Current API Version**: `2026-01` (updated quarterly)

**Note**: Shopify provides development stores for testing via Partner Dashboard.

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "ecommerce-shopify",
  "category": "ecommerce",
  "name": "Shopify E-commerce",
  "description": "Connect to Shopify stores for orders, products, customers, and inventory management",
  "provider": "Shopify Inc.",
  "version": "1.0.0",
  "authType": "oauth2",
  "configSchema": {
    "type": "object",
    "required": ["shopDomain", "accessToken"],
    "properties": {
      "shopDomain": {
        "type": "string",
        "title": "Shop Domain",
        "description": "Your Shopify store domain (e.g., mystore.myshopify.com)",
        "pattern": "^[a-z0-9-]+\\.myshopify\\.com$"
      },
      "accessToken": {
        "type": "string",
        "title": "Access Token",
        "description": "API access token from OAuth flow",
        "format": "password"
      },
      "refreshToken": {
        "type": "string",
        "title": "Refresh Token",
        "description": "Token for refreshing expiring access tokens",
        "format": "password"
      },
      "tokenExpiresAt": {
        "type": "string",
        "title": "Token Expiry",
        "description": "When the access token expires (ISO 8601)",
        "format": "date-time"
      },
      "apiVersion": {
        "type": "string",
        "title": "API Version",
        "description": "Shopify API version to use",
        "default": "2026-01"
      }
    }
  },
  "credentialFields": ["accessToken", "refreshToken"],
  "configFields": ["shopDomain", "tokenExpiresAt", "apiVersion"],
  "oauthConfig": {
    "authorizationUrl": "https://{shop}/admin/oauth/authorize",
    "tokenUrl": "https://{shop}/admin/oauth/access_token",
    "refreshUrl": "https://{shop}/admin/oauth/access_token",
    "scopes": [
      "read_products",
      "write_products",
      "read_orders",
      "write_orders",
      "read_customers",
      "write_customers",
      "read_inventory",
      "write_inventory",
      "read_fulfillments",
      "write_fulfillments"
    ]
  }
}
```

### Customer Connection Flow

#### OAuth Flow (Required)

1. **Initiate Connection**:
   - Customer enters their shop domain (e.g., `mystore.myshopify.com`)
   - We redirect to Shopify authorization page

2. **Authorization URL**:

   ```
   GET https://{shop}/admin/oauth/authorize
     ?client_id={client_id}
     &scope=read_products,write_products,read_orders,write_orders,read_customers,read_inventory
     &redirect_uri={our_callback_url}
     &state={nonce}
     &grant_options[]=per-user
   ```

   **Note**: Use `grant_options[]=per-user` for online tokens, omit for offline tokens.

3. **Customer Approves**: Customer logs into Shopify and approves permissions

4. **Callback with Code**: Shopify redirects to our callback with authorization code

5. **Exchange for Token**:

   ```
   POST https://{shop}/admin/oauth/access_token
   Content-Type: application/x-www-form-urlencoded

   client_id={client_id}
   &client_secret={client_secret}
   &code={authorization_code}
   ```

6. **Response (Expiring Token)**:

   ```json
   {
     "access_token": "shpat_xxxxx",
     "expires_in": 3600,
     "refresh_token": "shprt_yyyyy",
     "refresh_token_expires_in": 7776000,
     "scope": "read_products,write_products,read_orders...",
     "associated_user_scope": "...",
     "associated_user": {
       "id": 123456,
       "first_name": "John",
       "last_name": "Doe",
       "email": "john@example.com"
     }
   }
   ```

7. **Store Credentials**: Save tokens in Secrets Manager, schedule refresh

### Token Refresh Flow

For expiring offline tokens (1-hour lifetime):

```
POST https://{shop}/admin/oauth/access_token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}
&client_secret={client_secret}
&grant_type=refresh_token
&refresh_token={refresh_token}
```

**Response**:

```json
{
  "access_token": "shpat_new_xxxxx",
  "expires_in": 3600,
  "refresh_token": "shprt_new_yyyyy",
  "refresh_token_expires_in": 7776000,
  "scope": "read_products,write_products,read_orders..."
}
```

### Credential Storage

| Field            | Storage Location  | Notes                    |
| ---------------- | ----------------- | ------------------------ |
| `shopDomain`     | DynamoDB (config) | Store identifier         |
| `accessToken`    | Secrets Manager   | Encrypted, 1-hour expiry |
| `refreshToken`   | Secrets Manager   | Encrypted, 90-day expiry |
| `tokenExpiresAt` | DynamoDB (config) | For proactive refresh    |
| `apiVersion`     | DynamoDB (config) | API version to use       |

### Token Lifecycle

| Token Type    | Lifetime | Refresh Mechanism               |
| ------------- | -------- | ------------------------------- |
| Access Token  | 1 hour   | Use refresh token before expiry |
| Refresh Token | 90 days  | Re-authenticate if expired      |

**Important**: Implement proactive token refresh (e.g., refresh when < 10 minutes remaining).

---

## Available Scopes

| Scope                | Resources                               |
| -------------------- | --------------------------------------- |
| `read_products`      | Products, variants, images, collections |
| `write_products`     | Create/update/delete products           |
| `read_orders`        | Orders, transactions, fulfillments      |
| `write_orders`       | Create/update orders                    |
| `read_customers`     | Customer profiles, addresses            |
| `write_customers`    | Create/update customer records          |
| `read_inventory`     | Inventory levels, items                 |
| `write_inventory`    | Adjust inventory quantities             |
| `read_fulfillments`  | Fulfillment orders, services            |
| `write_fulfillments` | Create/update fulfillments              |
| `read_draft_orders`  | Draft orders                            |
| `write_draft_orders` | Create/update draft orders              |
| `read_shipping`      | Shipping settings, carrier services     |
| `write_shipping`     | Modify shipping settings                |
| `read_locations`     | Store locations                         |
| `read_price_rules`   | Discounts, price rules                  |
| `write_price_rules`  | Create/modify discounts                 |
| `read_reports`       | Analytics and reports                   |
| `read_themes`        | Theme assets                            |
| `write_themes`       | Modify theme files                      |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool               | Use Case                          |
| -------- | ------------------ | --------------------------------- |
| High     | `get_order`        | Look up order details by ID       |
| High     | `list_orders`      | Search/filter orders              |
| High     | `get_product`      | Get product information           |
| Medium   | `list_products`    | Browse product catalog            |
| Medium   | `fulfill_order`    | Create fulfillment (confirmation) |
| Medium   | `get_customer`     | Look up customer information      |
| Medium   | `check_inventory`  | Check stock levels                |
| Low      | `search_customers` | Search customers                  |
| Low      | `cancel_order`     | Cancel order (confirmation)       |

**Note**: Shopify recommends GraphQL Admin API. Tool implementations should use GraphQL queries.

---

### 1. Get Order Details (High Priority)

**API**: GraphQL Admin API

**Use Case:** AI agent looking up specific order details.

**Tool Definition:**

```json
{
  "actionId": "get_order",
  "name": "Get Shopify Order Details",
  "description": "Retrieve detailed information about a specific order including items, customer info, payment status, and fulfillment status. Use when customer asks about their order.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Shopify order ID (numeric) or GID (gid://shopify/Order/123)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Order GID" },
      "name": { "type": "string", "description": "Order name (#1001)" },
      "orderNumber": { "type": "integer" },
      "displayFinancialStatus": {
        "type": "string",
        "enum": [
          "PENDING",
          "AUTHORIZED",
          "PAID",
          "PARTIALLY_PAID",
          "REFUNDED",
          "VOIDED",
          "PARTIALLY_REFUNDED"
        ],
        "description": "Payment status"
      },
      "displayFulfillmentStatus": {
        "type": "string",
        "enum": [
          "UNFULFILLED",
          "PARTIALLY_FULFILLED",
          "FULFILLED",
          "RESTOCKED",
          "PENDING_FULFILLMENT",
          "OPEN",
          "IN_PROGRESS",
          "ON_HOLD",
          "SCHEDULED"
        ],
        "description": "Fulfillment status"
      },
      "totalPriceSet": {
        "type": "object",
        "properties": {
          "shopMoney": {
            "type": "object",
            "properties": {
              "amount": { "type": "string" },
              "currencyCode": { "type": "string" }
            }
          }
        }
      },
      "subtotalPriceSet": { "type": "object" },
      "totalShippingPriceSet": { "type": "object" },
      "totalDiscountsSet": { "type": "object" },
      "customer": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
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
          "address2": { "type": "string" },
          "city": { "type": "string" },
          "province": { "type": "string" },
          "country": { "type": "string" },
          "zip": { "type": "string" },
          "phone": { "type": "string" }
        }
      },
      "lineItems": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "quantity": { "type": "integer" },
            "sku": { "type": "string" },
            "originalUnitPriceSet": { "type": "object" },
            "variant": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "title": { "type": "string" },
                "product": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string" },
                    "title": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      },
      "fulfillments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "status": { "type": "string" },
            "trackingInfo": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "number": { "type": "string" },
                  "company": { "type": "string" },
                  "url": { "type": "string" }
                }
              }
            }
          }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" },
      "cancelledAt": { "type": "string", "format": "date-time" },
      "note": { "type": "string" },
      "tags": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

**GraphQL Query:**

```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    name
    displayFinancialStatus
    displayFulfillmentStatus
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    subtotalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    totalShippingPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    customer {
      id
      email
      firstName
      lastName
      phone
    }
    shippingAddress {
      address1
      address2
      city
      province
      country
      zip
      phone
    }
    lineItems(first: 50) {
      nodes {
        id
        name
        quantity
        sku
        originalUnitPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        variant {
          id
          title
          product {
            id
            title
          }
        }
      }
    }
    fulfillments {
      id
      status
      trackingInfo {
        number
        company
        url
      }
    }
    createdAt
    note
    tags
  }
}
```

---

### 2. List Orders (High Priority)

**API**: GraphQL Admin API

**Use Case:** AI agent searching for orders.

**Tool Definition:**

```json
{
  "actionId": "list_orders",
  "name": "List Shopify Orders",
  "description": "Search and list orders with optional filters. Use to find orders by status, date range, or customer.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (e.g., 'financial_status:paid fulfillment_status:unfulfilled')"
      },
      "financialStatus": {
        "type": "string",
        "enum": [
          "PENDING",
          "AUTHORIZED",
          "PAID",
          "PARTIALLY_PAID",
          "REFUNDED",
          "VOIDED"
        ],
        "description": "Filter by payment status"
      },
      "fulfillmentStatus": {
        "type": "string",
        "enum": ["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED"],
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
      "first": {
        "type": "integer",
        "description": "Number of results (max 250, default 50)",
        "default": 50,
        "maximum": 250
      },
      "after": {
        "type": "string",
        "description": "Cursor for pagination"
      },
      "sortKey": {
        "type": "string",
        "enum": [
          "CREATED_AT",
          "UPDATED_AT",
          "PROCESSED_AT",
          "TOTAL_PRICE",
          "ID"
        ],
        "default": "CREATED_AT"
      },
      "reverse": {
        "type": "boolean",
        "default": true,
        "description": "Reverse sort order (newest first)"
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
            "id": { "type": "string" },
            "name": { "type": "string" },
            "displayFinancialStatus": { "type": "string" },
            "displayFulfillmentStatus": { "type": "string" },
            "totalPriceSet": { "type": "object" },
            "customerName": { "type": "string" },
            "customerEmail": { "type": "string" },
            "createdAt": { "type": "string" },
            "lineItemCount": { "type": "integer" }
          }
        }
      },
      "pageInfo": {
        "type": "object",
        "properties": {
          "hasNextPage": { "type": "boolean" },
          "endCursor": { "type": "string" }
        }
      },
      "totalCount": { "type": "integer" }
    }
  }
}
```

---

### 3. Get Product Details (High Priority)

**API**: GraphQL Admin API

**Use Case:** AI agent retrieving product information.

**Tool Definition:**

```json
{
  "actionId": "get_product",
  "name": "Get Shopify Product Details",
  "description": "Retrieve detailed information about a product including variants, pricing, and inventory.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "string",
        "description": "Shopify product ID or GID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "title": { "type": "string" },
      "descriptionHtml": { "type": "string" },
      "vendor": { "type": "string" },
      "productType": { "type": "string" },
      "handle": { "type": "string" },
      "status": {
        "type": "string",
        "enum": ["ACTIVE", "ARCHIVED", "DRAFT"]
      },
      "tags": { "type": "array", "items": { "type": "string" } },
      "totalInventory": { "type": "integer" },
      "priceRangeV2": {
        "type": "object",
        "properties": {
          "minVariantPrice": {
            "type": "object",
            "properties": {
              "amount": { "type": "string" },
              "currencyCode": { "type": "string" }
            }
          },
          "maxVariantPrice": { "type": "object" }
        }
      },
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "sku": { "type": "string" },
            "barcode": { "type": "string" },
            "price": { "type": "string" },
            "compareAtPrice": { "type": "string" },
            "inventoryQuantity": { "type": "integer" },
            "inventoryItem": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "tracked": { "type": "boolean" }
              }
            },
            "selectedOptions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "value": { "type": "string" }
                }
              }
            },
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
            "id": { "type": "string" },
            "url": { "type": "string" },
            "altText": { "type": "string" }
          }
        }
      },
      "options": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
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

**API**: GraphQL Admin API

**Tool Definition:**

```json
{
  "actionId": "list_products",
  "name": "List Shopify Products",
  "description": "Search and list products with optional filters.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (e.g., 'title:*shirt* status:active')"
      },
      "first": {
        "type": "integer",
        "default": 50,
        "maximum": 250
      },
      "after": {
        "type": "string",
        "description": "Cursor for pagination"
      },
      "sortKey": {
        "type": "string",
        "enum": [
          "TITLE",
          "CREATED_AT",
          "UPDATED_AT",
          "VENDOR",
          "PRODUCT_TYPE",
          "INVENTORY_TOTAL"
        ],
        "default": "TITLE"
      },
      "reverse": {
        "type": "boolean",
        "default": false
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
            "id": { "type": "string" },
            "title": { "type": "string" },
            "vendor": { "type": "string" },
            "productType": { "type": "string" },
            "status": { "type": "string" },
            "totalInventory": { "type": "integer" },
            "priceRange": { "type": "string" },
            "featuredImageUrl": { "type": "string" },
            "variantsCount": { "type": "integer" }
          }
        }
      },
      "pageInfo": {
        "type": "object",
        "properties": {
          "hasNextPage": { "type": "boolean" },
          "endCursor": { "type": "string" }
        }
      }
    }
  }
}
```

---

### 5. Fulfill Order (Medium Priority)

**API**: GraphQL Admin API - `fulfillmentCreateV2` mutation

**Tool Definition:**

```json
{
  "actionId": "fulfill_order",
  "name": "Fulfill Shopify Order",
  "description": "Create a fulfillment for an order with tracking information. IMPORTANT: This marks items as shipped - confirm before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Shopify order ID or GID"
      },
      "trackingNumber": {
        "type": "string",
        "description": "Shipping tracking number"
      },
      "trackingCompany": {
        "type": "string",
        "description": "Shipping carrier name (e.g., 'UPS', 'FedEx', 'USPS', 'DHL')"
      },
      "trackingUrl": {
        "type": "string",
        "description": "Custom tracking URL (optional)",
        "format": "uri"
      },
      "notifyCustomer": {
        "type": "boolean",
        "description": "Send shipment notification email",
        "default": true
      },
      "lineItemIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Specific line items to fulfill (optional, defaults to all)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "fulfillmentId": { "type": "string" },
      "status": { "type": "string" },
      "trackingInfo": {
        "type": "object",
        "properties": {
          "number": { "type": "string" },
          "company": { "type": "string" },
          "url": { "type": "string" }
        }
      },
      "createdAt": { "type": "string", "format": "date-time" }
    }
  }
}
```

---

### 6. Get Customer Details (Medium Priority)

**API**: GraphQL Admin API

**Tool Definition:**

```json
{
  "actionId": "get_customer",
  "name": "Get Shopify Customer Details",
  "description": "Retrieve detailed customer information including order history and addresses.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["customerId"],
    "properties": {
      "customerId": {
        "type": "string",
        "description": "Shopify customer ID or GID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "email": { "type": "string" },
      "firstName": { "type": "string" },
      "lastName": { "type": "string" },
      "phone": { "type": "string" },
      "ordersCount": { "type": "integer" },
      "totalSpentV2": {
        "type": "object",
        "properties": {
          "amount": { "type": "string" },
          "currencyCode": { "type": "string" }
        }
      },
      "state": {
        "type": "string",
        "enum": ["ENABLED", "DISABLED", "INVITED", "DECLINED"]
      },
      "tags": { "type": "array", "items": { "type": "string" } },
      "note": { "type": "string" },
      "verifiedEmail": { "type": "boolean" },
      "taxExempt": { "type": "boolean" },
      "defaultAddress": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "address1": { "type": "string" },
          "address2": { "type": "string" },
          "city": { "type": "string" },
          "province": { "type": "string" },
          "country": { "type": "string" },
          "zip": { "type": "string" },
          "phone": { "type": "string" }
        }
      },
      "addresses": { "type": "array" },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" }
    }
  }
}
```

---

### 7. Check Inventory (Medium Priority)

**API**: GraphQL Admin API

**Tool Definition:**

```json
{
  "actionId": "check_inventory",
  "name": "Check Shopify Inventory",
  "description": "Check inventory levels for a product variant at specific or all locations.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["inventoryItemId"],
    "properties": {
      "inventoryItemId": {
        "type": "string",
        "description": "Inventory item ID or GID"
      },
      "locationId": {
        "type": "string",
        "description": "Specific location ID (optional)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "inventoryItemId": { "type": "string" },
      "sku": { "type": "string" },
      "tracked": { "type": "boolean" },
      "inventoryLevels": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "locationId": { "type": "string" },
            "locationName": { "type": "string" },
            "available": { "type": "integer" },
            "incoming": { "type": "integer" },
            "committed": { "type": "integer" }
          }
        }
      },
      "totalAvailable": { "type": "integer" }
    }
  }
}
```

---

## Webhook Support

Shopify has extensive webhook support with mandatory compliance webhooks.

### Webhook Topics

| Category         | Events                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Orders**       | `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`, `orders/partially_fulfilled`, `orders/delete` |
| **Products**     | `products/create`, `products/update`, `products/delete`                                                                                 |
| **Customers**    | `customers/create`, `customers/update`, `customers/delete`, `customers/enable`, `customers/disable`                                     |
| **Inventory**    | `inventory_levels/update`, `inventory_levels/connect`, `inventory_levels/disconnect`                                                    |
| **Fulfillments** | `fulfillments/create`, `fulfillments/update`                                                                                            |
| **Refunds**      | `refunds/create`                                                                                                                        |
| **App**          | `app/uninstalled`                                                                                                                       |

### Mandatory Compliance Webhooks

Apps published on Shopify App Store **must** handle:

| Topic                    | Purpose                             |
| ------------------------ | ----------------------------------- |
| `customers/data_request` | Customer data export request (GDPR) |
| `customers/redact`       | Customer data deletion request      |
| `shop/redact`            | Shop data deletion after uninstall  |

### Webhook Configuration (GraphQL)

```graphql
mutation webhookSubscriptionCreate(
  $topic: WebhookSubscriptionTopic!
  $webhookSubscription: WebhookSubscriptionInput!
) {
  webhookSubscriptionCreate(
    topic: $topic
    webhookSubscription: $webhookSubscription
  ) {
    webhookSubscription {
      id
      topic
      endpoint {
        __typename
        ... on WebhookHttpEndpoint {
          callbackUrl
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Webhook Verification

Shopify webhooks include HMAC signature in `X-Shopify-Hmac-Sha256` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(body, hmacHeader, secretKey) {
  const calculatedHmac = crypto
    .createHmac('sha256', secretKey)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(calculatedHmac)
  );
}
```

---

## Rate Limiting

Shopify uses a calculated query cost system for GraphQL:

### GraphQL Rate Limits

| Plan             | Restore Rate   | Bucket Size   |
| ---------------- | -------------- | ------------- |
| Standard         | 50 points/sec  | 1,000 points  |
| Advanced Shopify | 100 points/sec | 2,000 points  |
| Shopify Plus     | 500 points/sec | 10,000 points |

### Cost Calculation

Each GraphQL query has a **requested cost** based on:

- Number of objects requested
- Connections and edges
- Nested fields

### Rate Limit Response

```json
{
  "extensions": {
    "cost": {
      "requestedQueryCost": 101,
      "actualQueryCost": 46,
      "throttleStatus": {
        "maximumAvailable": 1000,
        "currentlyAvailable": 954,
        "restoreRate": 50
      }
    }
  }
}
```

### Handling Rate Limits

1. Check `currentlyAvailable` before complex queries
2. Implement exponential backoff on 429 responses
3. Use bulk operations for large data sets
4. Batch mutations when possible

---

## Error Handling

| HTTP Status | Description       | Action                                |
| ----------- | ----------------- | ------------------------------------- |
| 200         | Success           | Process response (check `userErrors`) |
| 400         | Bad Request       | Invalid GraphQL query                 |
| 401         | Unauthorized      | Invalid or expired token              |
| 402         | Payment Required  | Shop frozen or deactivated            |
| 403         | Forbidden         | Insufficient scopes                   |
| 404         | Not Found         | Shop not found                        |
| 423         | Locked            | Shop locked                           |
| 429         | Too Many Requests | Rate limited                          |
| 500         | Server Error      | Retry with backoff                    |

### GraphQL User Errors

Always check `userErrors` in mutation responses:

```json
{
  "data": {
    "orderUpdate": {
      "order": null,
      "userErrors": [
        {
          "field": ["input", "note"],
          "message": "Note is too long (maximum is 5000 characters)"
        }
      ]
    }
  }
}
```

---

## Example AI Agent Conversations

### Scenario 1: Order Status with Tracking

```
Customer: "Where's my order #1234?"

AI Agent: [Uses get_order tool]

Response: "I found your order #1234! Here's the status:

📦 **Order Status**: Shipped
💳 **Payment**: Paid ($127.50 USD)
🚚 **Shipping**: In Transit

**Tracking Information:**
- Carrier: UPS
- Tracking: 1Z999AA10123456784
- Link: https://ups.com/track?tracknum=1Z999AA10123456784

**Items:**
- Classic Cotton T-Shirt (Blue, M) x2 - $50.00
- Denim Jeans (32x30) x1 - $77.50

**Shipping To:**
123 Main St, Apt 4B
New York, NY 10001

Your package should arrive within 2-3 business days!"
```

### Scenario 2: Product Inquiry with Inventory

```
Customer: "Do you have the Nike Air Max in size 10?"

AI Agent: [Uses list_products then get_product]

Response: "Let me check our Nike Air Max inventory...

**Nike Air Max 90**
- Price: $120.00
- Colors available: White, Black, Red

**Size 10 Availability:**
✅ White - 5 in stock
✅ Black - 3 in stock
❌ Red - Out of stock

Would you like to place an order for the White or Black?"
```

### Scenario 3: Fulfill Order with Tracking

```
Staff: "Ship order #1234 with FedEx tracking 789456123"

AI Agent: Let me confirm before creating the fulfillment:
- Order: #1234
- Carrier: FedEx
- Tracking Number: 789456123
- Send notification to customer: Yes

Proceed with fulfillment?

Staff: "Yes"

AI Agent: [Uses fulfill_order tool]

Response: "Order #1234 has been fulfilled!

✅ **Status**: Shipped
🚚 **FedEx**: 789456123
📧 **Customer notified**: Yes

Tracking link: https://www.fedex.com/fedextrack/?trknbr=789456123

The customer will receive an email with shipping details."
```

### Scenario 4: Customer Lookup

```
Staff: "Find customer john@example.com"

AI Agent: [Uses search_customers then get_customer]

Response: "Found customer:

👤 **John Doe**
📧 john@example.com
📱 +1 (555) 123-4567

📊 **Customer Stats:**
- Total Orders: 15
- Total Spent: $1,847.50 USD
- Member Since: March 2024

📍 **Default Address:**
123 Main St, Apt 4B
New York, NY 10001

🏷️ **Tags:** VIP, Newsletter

Would you like to see their recent orders?"
```

---

## Token Refresh Implementation

Since Shopify uses expiring tokens, implement proactive refresh:

```typescript
class ShopifyTokenManager {
  private async refreshIfNeeded(connection: Connection): Promise<string> {
    const expiresAt = new Date(connection.tokenExpiresAt);
    const now = new Date();
    const bufferMinutes = 10;

    // Refresh if token expires within buffer time
    if (expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000) {
      return await this.refreshToken(connection);
    }

    return connection.accessToken;
  }

  private async refreshToken(connection: Connection): Promise<string> {
    const response = await fetch(
      `https://${connection.shopDomain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: connection.refreshToken,
        }),
      }
    );

    const data = await response.json();

    // Update stored credentials
    await this.updateConnection(connection.id, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
    });

    return data.access_token;
  }
}
```

---

## Security Best Practices

1. **Token security**: Store tokens in Secrets Manager, never in logs
2. **Proactive refresh**: Refresh tokens before expiry (10-minute buffer)
3. **Verify webhooks**: Always validate HMAC signatures
4. **Use HTTPS**: All redirect/webhook URLs must be HTTPS
5. **Minimal scopes**: Request only necessary permissions
6. **Handle uninstalls**: Clean up data on `app/uninstalled` webhook
7. **GDPR compliance**: Implement mandatory compliance webhooks
8. **Rate limit awareness**: Monitor query costs, implement backoff
9. **API versioning**: Stay current with Shopify API versions (quarterly updates)

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [Sapo Integration Specification](./ecommerce-sapo.md)
- [Haravan Integration Specification](./ecommerce-haravan.md)
