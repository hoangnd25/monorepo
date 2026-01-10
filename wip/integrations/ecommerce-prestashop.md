# PrestaShop Integration Specification

> **Status**: Draft
> **Last Updated**: 2026-01-11
> **Integration ID**: `ecommerce-prestashop`
> **Category**: E-commerce

## Overview

PrestaShop is a popular open-source e-commerce platform powering over 300,000 online stores worldwide. Unlike SaaS platforms (Shopify, Haravan, Sapo), PrestaShop is **self-hosted**, giving merchants full control over their store infrastructure.

**API Documentation**: [https://devdocs.prestashop-project.org/8/webservice/](https://devdocs.prestashop-project.org/8/webservice/)
**GitHub**: [https://github.com/PrestaShop/PrestaShop](https://github.com/PrestaShop/PrestaShop)
**Marketplace**: [https://addons.prestashop.com](https://addons.prestashop.com)

---

## Authentication Model

PrestaShop uses **API Key authentication** - significantly simpler than OAuth-based platforms.

### Comparison with Other E-commerce Platforms

| Aspect               | PrestaShop     | Shopify                 | Haravan      | Sapo         |
| -------------------- | -------------- | ----------------------- | ------------ | ------------ |
| **Auth Type**        | API Key        | OAuth 2.0               | OAuth 2.0    | OAuth 2.0    |
| **Token Refresh**    | Not required   | Required (1h)           | Not required | Not required |
| **Token Generation** | Admin panel    | OAuth flow              | OAuth flow   | OAuth flow   |
| **Credential**       | Single API key | Access + Refresh tokens | Access token | Access token |

### Credential Requirements

| Credential | Description                 | Obtained From          |
| ---------- | --------------------------- | ---------------------- |
| `api_key`  | 32-character webservice key | PrestaShop Admin Panel |

### Key Characteristics

- **Permanent Tokens**: API keys do not expire unless manually revoked
- **No Refresh Needed**: Unlike Shopify, no token refresh mechanism required
- **Per-Resource Permissions**: Permissions configured per resource in admin panel
- **Self-Hosted**: Each store has a unique base URL
- **HTTP Basic Auth**: API key as username, empty password

---

## Version Compatibility

PrestaShop has two major version lines in active use. Our integration supports both.

### Supported Versions

| Version   | PHP Requirement | Status      | Notes             |
| --------- | --------------- | ----------- | ----------------- |
| **1.7.x** | PHP 7.1 - 7.4   | Maintenance | Still widely used |
| **8.x**   | PHP 7.2.5 - 8.1 | Current     | Recommended       |

### API Compatibility Summary

The Webservice API is **largely backward compatible** between 1.7.x and 8.x:

| Feature           | 1.7.x | 8.x | Notes            |
| ----------------- | ----- | --- | ---------------- |
| Core REST API     | Yes   | Yes | Fully compatible |
| Resource schemas  | Yes   | Yes | Identical        |
| Authentication    | Yes   | Yes | Same method      |
| JSON output       | Yes   | Yes | Same parameter   |
| Filtering/Sorting | Yes   | Yes | Same syntax      |
| Stock management  | Yes   | Yes | Same limitations |
| Order management  | Yes   | Yes | Same process     |
| PHP 8 support     | No    | Yes | 8.x only         |

### Version-Specific Differences

#### Breaking Changes in 8.x

| Change                       | Impact on Integration             |
| ---------------------------- | --------------------------------- |
| Live exchange rate removed   | None - we don't use this feature  |
| Default carrier name changed | Minor - "0" → "Click and collect" |
| Hook registration stricter   | None - affects modules only       |
| PHP 8 stricter typing        | Handle type coercion carefully    |

#### Version Detection

```typescript
// Detect version via configurations endpoint
GET /api/configurations?filter[name]=PS_VERSION_DB&output_format=JSON

// Response
{
  "configurations": [{
    "id": 123,
    "name": "PS_VERSION_DB",
    "value": "8.1.0"  // or "1.7.8.11"
  }]
}
```

---

## Environments

| Aspect           | Value                            | Notes                             |
| ---------------- | -------------------------------- | --------------------------------- |
| **API Base URL** | `https://{customer_domain}/api/` | Variable per store                |
| **Protocol**     | HTTPS required                   | Some stores may have HTTP         |
| **Sandbox**      | None                             | Test on production with test data |

**Important**: Unlike SaaS platforms with standard domains (`.myshopify.com`, `.mysapo.net`), PrestaShop stores have completely custom domains.

---

## Connection Configuration

### Integration Definition

```json
{
  "integrationId": "ecommerce-prestashop",
  "category": "ecommerce",
  "name": "PrestaShop E-commerce",
  "description": "Connect to PrestaShop stores for orders, products, customers, and inventory management",
  "provider": "PrestaShop SA",
  "version": "1.0.0",
  "authType": "api_key",
  "configSchema": {
    "type": "object",
    "required": ["shopUrl", "apiKey"],
    "properties": {
      "shopUrl": {
        "type": "string",
        "title": "Shop URL",
        "description": "Your PrestaShop store URL (e.g., https://mystore.com)",
        "format": "uri",
        "pattern": "^https?://.+"
      },
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "32-character webservice key from PrestaShop admin",
        "format": "password",
        "minLength": 32,
        "maxLength": 32
      },
      "prestashopVersion": {
        "type": "string",
        "title": "PrestaShop Version",
        "description": "Major version (auto-detected if not provided)",
        "enum": ["1.7", "8.x"],
        "default": "8.x"
      },
      "defaultLanguageId": {
        "type": "integer",
        "title": "Default Language ID",
        "description": "Language ID for multilingual fields (default: 1)",
        "default": 1
      },
      "defaultShopId": {
        "type": "integer",
        "title": "Default Shop ID",
        "description": "Shop ID for multistore installations (default: 1)",
        "default": 1
      }
    }
  },
  "credentialFields": ["apiKey"],
  "configFields": [
    "shopUrl",
    "prestashopVersion",
    "defaultLanguageId",
    "defaultShopId"
  ]
}
```

### Customer Connection Flow

Unlike OAuth-based platforms, PrestaShop requires **manual credential setup**:

1. **Customer Enables Webservice in PrestaShop Admin**:
   - Login to PrestaShop Back Office
   - Navigate to: Advanced Parameters > Webservice
   - Enable webservice toggle
   - Click "Add new webservice key"

2. **Customer Configures API Key**:
   - Generate or enter 32-character key
   - Set key description (e.g., "AI Agent Integration")
   - Configure permissions for required resources:
     - `orders` - View, Modify
     - `order_details` - View
     - `order_histories` - View, Add
     - `order_carriers` - View, Modify
     - `order_states` - View
     - `products` - View
     - `stock_availables` - View, Modify
     - `customers` - View
     - `addresses` - View
     - `carriers` - View
     - `search` - View

3. **Customer Provides Credentials**:
   - Shop URL
   - API Key
   - PrestaShop version (optional, auto-detected)

4. **We Validate Connection**:

   ```
   GET https://{shop_url}/api/?output_format=JSON
   Authorization: Basic {base64(api_key:)}
   ```

5. **Store Credentials**: Save in DynamoDB/Secrets Manager

### Authentication Methods

#### Method 1: HTTP Basic Auth (Recommended)

```http
GET /api/orders HTTP/1.1
Host: mystore.com
Authorization: Basic {base64(api_key:)}
```

```typescript
const auth = Buffer.from(`${apiKey}:`).toString('base64');
const response = await fetch(`${shopUrl}/api/orders`, {
  headers: { Authorization: `Basic ${auth}` },
});
```

#### Method 2: URL Parameter (Less Secure)

```
https://mystore.com/api/orders?ws_key={api_key}
```

**Note**: Always prefer HTTP Basic Auth for security.

### Credential Storage

| Field               | Storage Location  | Notes                   |
| ------------------- | ----------------- | ----------------------- |
| `shopUrl`           | DynamoDB (config) | Store base URL          |
| `apiKey`            | Secrets Manager   | Encrypted, 32-char key  |
| `prestashopVersion` | DynamoDB (config) | "1.7" or "8.x"          |
| `defaultLanguageId` | DynamoDB (config) | For multilingual fields |
| `defaultShopId`     | DynamoDB (config) | For multistore          |

### Token Lifecycle

| Aspect           | Value                          |
| ---------------- | ------------------------------ |
| Token Expiry     | **Never** (permanent)          |
| Refresh Required | **No**                         |
| Revocation       | Manual deletion in admin panel |

---

## API Reference

### Request Format

```http
GET /api/{resource}?output_format=JSON&display=full
Authorization: Basic {base64(api_key:)}
```

### Response Formats

PrestaShop supports two output formats:

| Format | Parameter            | Default |
| ------ | -------------------- | ------- |
| XML    | (none)               | Yes     |
| JSON   | `output_format=JSON` | No      |

**Recommendation**: Always use `output_format=JSON` for easier parsing.

### Query Parameters

| Parameter       | Description               | Example                                     |
| --------------- | ------------------------- | ------------------------------------------- |
| `display`       | Fields to return          | `display=full` or `display=[id,name,price]` |
| `filter`        | Filter conditions         | `filter[current_state]=[3]`                 |
| `sort`          | Sort order                | `sort=[date_add_DESC]`                      |
| `limit`         | Pagination                | `limit=50` or `limit=10,50`                 |
| `date`          | Enable date sorting       | `date=1` (required for date sort)           |
| `output_format` | Response format           | `output_format=JSON`                        |
| `language`      | Language for multilingual | `language=1`                                |
| `id_shop`       | Shop context (multistore) | `id_shop=1`                                 |

### Filter Syntax

| Operator    | Syntax                       | Example                 |
| ----------- | ---------------------------- | ----------------------- |
| Equals      | `filter[field]=[value]`      | `filter[id]=[123]`      |
| OR          | `filter[field]=[val1\|val2]` | `filter[id]=[1\|5]`     |
| Range       | `filter[field]=[min,max]`    | `filter[id]=[1,100]`    |
| Starts with | `filter[field]=[val]%`       | `filter[name]=[Nike]%`  |
| Ends with   | `filter[field]=%[val]`       | `filter[name]=%[shoes]` |
| Contains    | `filter[field]=%[val]%`      | `filter[name]=%[air]%`  |

---

## AI Agent Tools

### Tool Priority Summary

| Priority | Tool                  | Use Case                          |
| -------- | --------------------- | --------------------------------- |
| High     | `get_order`           | Look up order details by ID       |
| High     | `list_orders`         | Search/filter orders              |
| High     | `get_product`         | Get product information           |
| Medium   | `list_products`       | Browse product catalog            |
| Medium   | `update_order_status` | Update order state (confirmation) |
| Medium   | `add_tracking_number` | Add shipping tracking info        |
| Medium   | `check_stock`         | Check inventory levels            |
| Medium   | `get_customer`        | Look up customer information      |
| Low      | `search_customers`    | Search customers by email/name    |
| Low      | `search_products`     | Full-text product search          |
| Low      | `get_order_states`    | List available order statuses     |

---

### 1. Get Order Details (High Priority)

**API Endpoint:** `GET /api/orders/{order_id}?output_format=JSON&display=full`

**Use Case:** AI agent looking up specific order details for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_order",
  "name": "Get PrestaShop Order Details",
  "description": "Retrieve detailed information about a specific order including items, customer info, payment status, and shipping status. Use when customer asks about their order.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "PrestaShop order ID"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "Order ID" },
      "reference": {
        "type": "string",
        "description": "Order reference code (e.g., XKBKNABJK)"
      },
      "currentState": {
        "type": "integer",
        "description": "Current order state ID"
      },
      "currentStateName": {
        "type": "string",
        "description": "Human-readable order state name"
      },
      "payment": {
        "type": "string",
        "description": "Payment method used"
      },
      "totalPaid": {
        "type": "number",
        "description": "Total amount paid"
      },
      "totalProducts": {
        "type": "number",
        "description": "Products subtotal"
      },
      "totalShipping": {
        "type": "number",
        "description": "Shipping cost"
      },
      "totalDiscounts": {
        "type": "number",
        "description": "Discounts applied"
      },
      "shippingNumber": {
        "type": "string",
        "description": "Tracking number if shipped"
      },
      "customer": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "email": { "type": "string" },
          "firstName": { "type": "string" },
          "lastName": { "type": "string" }
        }
      },
      "shippingAddress": {
        "type": "object",
        "properties": {
          "address1": { "type": "string" },
          "address2": { "type": "string" },
          "city": { "type": "string" },
          "postcode": { "type": "string" },
          "country": { "type": "string" },
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
            "productAttributeId": { "type": "integer" },
            "productName": { "type": "string" },
            "productReference": { "type": "string" },
            "productQuantity": { "type": "integer" },
            "productPrice": { "type": "number" },
            "unitPriceTaxIncl": { "type": "number" }
          }
        }
      },
      "dateAdd": { "type": "string", "format": "date-time" },
      "dateUpd": { "type": "string", "format": "date-time" },
      "carrier": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" }
        }
      }
    }
  }
}
```

**Implementation Notes:**

```typescript
// Fetch order with related data
async function getOrder(orderId: number): Promise<Order> {
  // Get order details
  const order = await this.get(`/orders/${orderId}?display=full`);

  // Get order rows (line items) from associations
  const lineItems = order.associations?.order_rows || [];

  // Get customer details
  const customer = await this.get(`/customers/${order.id_customer}`);

  // Get shipping address
  const address = await this.get(`/addresses/${order.id_address_delivery}`);

  // Get order state name
  const state = await this.get(`/order_states/${order.current_state}`);

  // Get carrier info if available
  const carrier = order.id_carrier
    ? await this.get(`/carriers/${order.id_carrier}`)
    : null;

  return normalizeOrder(order, lineItems, customer, address, state, carrier);
}
```

---

### 2. List Orders (High Priority)

**API Endpoint:** `GET /api/orders?output_format=JSON&display=full`

**Use Case:** AI agent searching for orders based on criteria.

**Tool Definition:**

```json
{
  "actionId": "list_orders",
  "name": "List PrestaShop Orders",
  "description": "Search and list orders with optional filters. Use to find orders by status, date range, or customer.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "stateId": {
        "type": "integer",
        "description": "Filter by order state ID"
      },
      "customerId": {
        "type": "integer",
        "description": "Filter by customer ID"
      },
      "reference": {
        "type": "string",
        "description": "Filter by order reference"
      },
      "dateFrom": {
        "type": "string",
        "format": "date",
        "description": "Show orders from this date (YYYY-MM-DD)"
      },
      "dateTo": {
        "type": "string",
        "format": "date",
        "description": "Show orders until this date (YYYY-MM-DD)"
      },
      "limit": {
        "type": "integer",
        "description": "Number of results (default 50, max 250)",
        "default": 50,
        "maximum": 250
      },
      "offset": {
        "type": "integer",
        "description": "Pagination offset",
        "default": 0
      },
      "sort": {
        "type": "string",
        "enum": ["date_add_DESC", "date_add_ASC", "id_DESC", "id_ASC"],
        "default": "date_add_DESC",
        "description": "Sort order"
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
            "reference": { "type": "string" },
            "currentState": { "type": "integer" },
            "currentStateName": { "type": "string" },
            "payment": { "type": "string" },
            "totalPaid": { "type": "number" },
            "customerName": { "type": "string" },
            "dateAdd": { "type": "string" }
          }
        }
      },
      "total": { "type": "integer", "description": "Total matching orders" }
    }
  }
}
```

**Query Building:**

```typescript
function buildOrdersQuery(params: ListOrdersParams): string {
  const queryParts = ['output_format=JSON', 'display=full', 'date=1'];

  if (params.stateId) {
    queryParts.push(`filter[current_state]=[${params.stateId}]`);
  }

  if (params.customerId) {
    queryParts.push(`filter[id_customer]=[${params.customerId}]`);
  }

  if (params.reference) {
    queryParts.push(`filter[reference]=[${params.reference}]`);
  }

  if (params.dateFrom && params.dateTo) {
    queryParts.push(`filter[date_add]=[${params.dateFrom},${params.dateTo}]`);
  }

  queryParts.push(`sort=[${params.sort || 'date_add_DESC'}]`);
  queryParts.push(`limit=${params.offset || 0},${params.limit || 50}`);

  return `/orders?${queryParts.join('&')}`;
}
```

---

### 3. Get Product Details (High Priority)

**API Endpoint:** `GET /api/products/{product_id}?output_format=JSON&display=full`

**Use Case:** AI agent retrieving product information for customer inquiries.

**Tool Definition:**

```json
{
  "actionId": "get_product",
  "name": "Get PrestaShop Product Details",
  "description": "Retrieve detailed information about a product including variants, pricing, and inventory. Use when customer asks about a specific product.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "integer",
        "description": "PrestaShop product ID"
      },
      "languageId": {
        "type": "integer",
        "description": "Language ID for multilingual fields (optional)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "Product ID" },
      "name": { "type": "string", "description": "Product name" },
      "description": { "type": "string", "description": "Product description" },
      "descriptionShort": {
        "type": "string",
        "description": "Short description"
      },
      "reference": { "type": "string", "description": "Product reference/SKU" },
      "ean13": { "type": "string", "description": "EAN-13 barcode" },
      "price": { "type": "number", "description": "Base price (tax excluded)" },
      "priceTaxIncl": { "type": "number", "description": "Price with tax" },
      "active": { "type": "boolean", "description": "Is product active" },
      "quantity": { "type": "integer", "description": "Total stock quantity" },
      "categoryDefault": {
        "type": "string",
        "description": "Default category name"
      },
      "manufacturer": {
        "type": "string",
        "description": "Manufacturer/brand name"
      },
      "weight": { "type": "number", "description": "Product weight" },
      "images": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "url": { "type": "string" }
          }
        }
      },
      "combinations": {
        "type": "array",
        "description": "Product variants/combinations",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "reference": { "type": "string" },
            "ean13": { "type": "string" },
            "price": { "type": "number", "description": "Price impact" },
            "quantity": { "type": "integer" },
            "attributes": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "value": { "type": "string" }
                }
              }
            }
          }
        }
      },
      "dateAdd": { "type": "string", "format": "date-time" },
      "dateUpd": { "type": "string", "format": "date-time" }
    }
  }
}
```

**Handling Multilingual Fields:**

```typescript
function extractLocalizedField(field: any, languageId: number): string {
  // PrestaShop returns multilingual fields as:
  // { language: [{ "@attributes": { id: "1" }, "#text": "Product Name" }, ...] }

  if (typeof field === 'string') return field;

  if (field?.language) {
    const languages = Array.isArray(field.language)
      ? field.language
      : [field.language];

    const match = languages.find(
      (l: any) => parseInt(l['@attributes']?.id) === languageId
    );

    return match?.['#text'] || languages[0]?.['#text'] || '';
  }

  return '';
}
```

---

### 4. List Products (Medium Priority)

**API Endpoint:** `GET /api/products?output_format=JSON`

**Tool Definition:**

```json
{
  "actionId": "list_products",
  "name": "List PrestaShop Products",
  "description": "Search and list products with optional filters. Use to browse catalog or find products by criteria.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Filter by product name (partial match)"
      },
      "reference": {
        "type": "string",
        "description": "Filter by product reference/SKU"
      },
      "categoryId": {
        "type": "integer",
        "description": "Filter by category ID"
      },
      "activeOnly": {
        "type": "boolean",
        "description": "Only show active products",
        "default": true
      },
      "limit": {
        "type": "integer",
        "default": 50,
        "maximum": 250
      },
      "offset": {
        "type": "integer",
        "default": 0
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
            "name": { "type": "string" },
            "reference": { "type": "string" },
            "price": { "type": "number" },
            "active": { "type": "boolean" },
            "quantity": { "type": "integer" },
            "imageUrl": { "type": "string" }
          }
        }
      },
      "total": { "type": "integer" }
    }
  }
}
```

---

### 5. Update Order Status (Medium Priority)

**API Endpoint:** `POST /api/order_histories`

**Important**: PrestaShop uses `order_histories` to update order status, NOT a direct PUT to orders.

**Tool Definition:**

```json
{
  "actionId": "update_order_status",
  "name": "Update PrestaShop Order Status",
  "description": "Update the status of an order. IMPORTANT: This changes the order state - confirm before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderId", "newStateId"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "PrestaShop order ID"
      },
      "newStateId": {
        "type": "integer",
        "description": "New order state ID (use get_order_states to see available states)"
      },
      "notifyCustomer": {
        "type": "boolean",
        "description": "Send email notification to customer (depends on state configuration)",
        "default": true
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "orderHistoryId": { "type": "integer" },
      "newState": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" }
        }
      },
      "dateAdd": { "type": "string", "format": "date-time" }
    }
  }
}
```

**Implementation:**

```typescript
async function updateOrderStatus(
  orderId: number,
  newStateId: number
): Promise<OrderHistoryResult> {
  // Create order history entry (this updates the order status)
  const payload = {
    order_history: {
      id_order: orderId,
      id_order_state: newStateId,
    },
  };

  const result = await this.post('/order_histories', payload);

  // Get the new state name
  const state = await this.get(`/order_states/${newStateId}`);

  return {
    success: true,
    orderHistoryId: result.order_history.id,
    newState: {
      id: newStateId,
      name: extractLocalizedField(state.name, this.languageId),
    },
    dateAdd: result.order_history.date_add,
  };
}
```

---

### 6. Add Tracking Number (Medium Priority)

**API Endpoint:** `PUT /api/order_carriers/{order_carrier_id}`

**Tool Definition:**

```json
{
  "actionId": "add_tracking_number",
  "name": "Add Tracking Number to PrestaShop Order",
  "description": "Add or update shipping tracking information for an order. IMPORTANT: This updates shipping info - confirm before executing.",
  "category": "write",
  "requiresConfirmation": true,
  "inputSchema": {
    "type": "object",
    "required": ["orderId", "trackingNumber"],
    "properties": {
      "orderId": {
        "type": "integer",
        "description": "PrestaShop order ID"
      },
      "trackingNumber": {
        "type": "string",
        "description": "Shipping tracking number"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "orderId": { "type": "integer" },
      "trackingNumber": { "type": "string" },
      "carrierName": { "type": "string" }
    }
  }
}
```

**Implementation:**

```typescript
async function addTrackingNumber(
  orderId: number,
  trackingNumber: string
): Promise<TrackingResult> {
  // Find the order_carrier record for this order
  const orderCarriers = await this.get(
    `/order_carriers?filter[id_order]=[${orderId}]&display=full`
  );

  if (!orderCarriers.order_carriers?.length) {
    throw new Error('No carrier found for this order');
  }

  const orderCarrier = orderCarriers.order_carriers[0];

  // Update with tracking number
  const payload = {
    order_carrier: {
      id: orderCarrier.id,
      tracking_number: trackingNumber,
    },
  };

  await this.put(`/order_carriers/${orderCarrier.id}`, payload);

  // Also update the order's shipping_number field
  await this.put(`/orders/${orderId}`, {
    order: {
      id: orderId,
      shipping_number: trackingNumber,
    },
  });

  return {
    success: true,
    orderId,
    trackingNumber,
    carrierName: orderCarrier.carrier_name || 'Unknown',
  };
}
```

---

### 7. Check Stock (Medium Priority)

**API Endpoint:** `GET /api/stock_availables?filter[id_product]=[{product_id}]`

**Tool Definition:**

```json
{
  "actionId": "check_stock",
  "name": "Check PrestaShop Stock",
  "description": "Check inventory/stock levels for a product or specific variant. Use when customer asks about product availability.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["productId"],
    "properties": {
      "productId": {
        "type": "integer",
        "description": "PrestaShop product ID"
      },
      "productAttributeId": {
        "type": "integer",
        "description": "Product attribute/combination ID (for variants, 0 for simple products)"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "productId": { "type": "integer" },
      "stockItems": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer", "description": "Stock available ID" },
            "productAttributeId": {
              "type": "integer",
              "description": "0 for simple product"
            },
            "quantity": { "type": "integer" },
            "outOfStock": {
              "type": "integer",
              "description": "0=deny orders, 1=allow orders, 2=use default"
            },
            "dependsOnStock": { "type": "boolean" },
            "location": { "type": "string" }
          }
        }
      },
      "totalQuantity": { "type": "integer" },
      "inStock": { "type": "boolean" }
    }
  }
}
```

**Note on stock_availables limitations:**

| HTTP Method | Supported | Notes                       |
| ----------- | --------- | --------------------------- |
| GET         | Yes       | Read stock levels           |
| POST        | **No**    | Cannot create stock records |
| PUT         | Yes       | Update existing stock       |
| DELETE      | **No**    | Cannot delete stock records |

---

### 8. Get Customer Details (Medium Priority)

**API Endpoint:** `GET /api/customers/{customer_id}?output_format=JSON&display=full`

**Tool Definition:**

```json
{
  "actionId": "get_customer",
  "name": "Get PrestaShop Customer Details",
  "description": "Retrieve detailed customer information including addresses.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "required": ["customerId"],
    "properties": {
      "customerId": {
        "type": "integer",
        "description": "PrestaShop customer ID"
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
      "birthday": { "type": "string" },
      "active": { "type": "boolean" },
      "newsletter": { "type": "boolean" },
      "dateAdd": { "type": "string", "format": "date-time" },
      "addresses": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "alias": { "type": "string" },
            "address1": { "type": "string" },
            "address2": { "type": "string" },
            "city": { "type": "string" },
            "postcode": { "type": "string" },
            "country": { "type": "string" },
            "phone": { "type": "string" },
            "phoneMobile": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### 9. Search Customers (Low Priority)

**API Endpoint:** `GET /api/customers?filter[email]=[{email}]`

**Tool Definition:**

```json
{
  "actionId": "search_customers",
  "name": "Search PrestaShop Customers",
  "description": "Search for customers by email, name, or other criteria.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Search by exact email address"
      },
      "lastName": {
        "type": "string",
        "description": "Search by last name (partial match)"
      },
      "firstName": {
        "type": "string",
        "description": "Search by first name (partial match)"
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
            "active": { "type": "boolean" },
            "dateAdd": { "type": "string" }
          }
        }
      },
      "total": { "type": "integer" }
    }
  }
}
```

**Note**: Phone search requires querying `addresses` resource, not `customers`.

---

### 10. Get Order States (Low Priority)

**API Endpoint:** `GET /api/order_states?output_format=JSON&display=full`

**Tool Definition:**

```json
{
  "actionId": "get_order_states",
  "name": "Get PrestaShop Order States",
  "description": "List all available order states/statuses. Use to understand valid state IDs for update_order_status.",
  "category": "read",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "states": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" },
            "color": { "type": "string" },
            "logable": {
              "type": "boolean",
              "description": "Counts as valid order"
            },
            "invoice": {
              "type": "boolean",
              "description": "Generates invoice"
            },
            "shipped": { "type": "boolean", "description": "Marks as shipped" },
            "paid": { "type": "boolean", "description": "Marks as paid" },
            "delivery": {
              "type": "boolean",
              "description": "Show delivery PDF"
            },
            "sendEmail": {
              "type": "boolean",
              "description": "Send email notification"
            }
          }
        }
      }
    }
  }
}
```

**Default PrestaShop Order States:**

| ID  | Name                       | Description          |
| --- | -------------------------- | -------------------- |
| 1   | Awaiting check payment     | Payment pending      |
| 2   | Payment accepted           | Paid                 |
| 3   | Processing in progress     | Being prepared       |
| 4   | Shipped                    | Sent to customer     |
| 5   | Delivered                  | Received by customer |
| 6   | Canceled                   | Order canceled       |
| 7   | Refunded                   | Payment refunded     |
| 8   | Payment error              | Payment failed       |
| 9   | On backorder (paid)        | Waiting for stock    |
| 10  | Awaiting bank wire payment | Waiting for transfer |

**Note**: Actual state IDs may vary by installation.

---

## Webhook Support

### Native Webhook Support: **NONE**

PrestaShop **does NOT have built-in webhook support** in the core platform. This is a major difference from Shopify/Haravan/Sapo.

### Alternatives for Real-time Updates

| Approach                | Description                    | Recommendation     |
| ----------------------- | ------------------------------ | ------------------ |
| **Polling**             | Periodically query for changes | Primary method     |
| **Third-party Modules** | Install webhook modules        | Customer-dependent |
| **Custom Module**       | PrestaShop hook-based module   | Complex setup      |

### Polling Implementation

```typescript
// Poll for new/updated orders since last sync
async function pollOrders(lastSyncDate: string): Promise<Order[]> {
  const query =
    `/orders?output_format=JSON&display=full&date=1` +
    `&filter[date_upd]=[${lastSyncDate},9999-12-31 23:59:59]` +
    `&sort=[date_upd_ASC]`;

  return this.get(query);
}

// Recommended polling intervals
const POLLING_INTERVALS = {
  orders: 5 * 60 * 1000, // 5 minutes
  products: 15 * 60 * 1000, // 15 minutes
  stock: 10 * 60 * 1000, // 10 minutes
};
```

### Comparison with Other Platforms

| Platform   | Webhooks | Events                               |
| ---------- | -------- | ------------------------------------ |
| PrestaShop | **No**   | N/A                                  |
| Shopify    | Yes      | orders/create, products/update, etc. |
| Haravan    | Yes      | orders/create, products/update, etc. |
| Sapo       | Yes      | orders/create, products/update, etc. |

---

## Rate Limiting

### No Official Rate Limits

PrestaShop is self-hosted, so rate limits depend on the customer's server configuration.

### Recommended Client-Side Limits

| Action           | Recommended Limit   | Notes           |
| ---------------- | ------------------- | --------------- |
| Read operations  | 2-5 requests/second | Per tenant      |
| Write operations | 1-2 requests/second | Per tenant      |
| Bulk operations  | 1 request/5 seconds | Large responses |

### Implementation

```typescript
const rateLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 'second',
});

async function apiRequest(endpoint: string): Promise<any> {
  await rateLimiter.removeTokens(1);
  return fetch(endpoint);
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description        | Action                    |
| ---- | ------------------ | ------------------------- |
| 200  | Success            | Process response          |
| 201  | Created            | Resource created          |
| 400  | Bad Request        | Check request format      |
| 401  | Unauthorized       | Invalid/missing API key   |
| 403  | Forbidden          | Insufficient permissions  |
| 404  | Not Found          | Resource doesn't exist    |
| 405  | Method Not Allowed | HTTP method not supported |
| 500  | Server Error       | Retry with backoff        |

### Error Response Format

**JSON:**

```json
{
  "errors": [
    {
      "code": 100,
      "message": "The API key is invalid or not specified."
    }
  ]
}
```

**XML:**

```xml
<prestashop>
  <errors>
    <error>
      <code><![CDATA[100]]></code>
      <message><![CDATA[The API key is invalid or not specified.]]></message>
    </error>
  </errors>
</prestashop>
```

### Common Error Codes

| Code | Message                | Cause                    |
| ---- | ---------------------- | ------------------------ |
| 100  | API key invalid        | Missing or wrong API key |
| 18   | Resource not found     | Invalid endpoint         |
| 22   | Resource ID required   | Missing ID parameter     |
| 25   | Bad id_lang            | Invalid language ID      |
| 27   | Required field missing | POST/PUT missing field   |
| 28   | Field value invalid    | Validation failed        |

---

## Self-Hosted Considerations

### Challenges and Mitigations

| Challenge                | Impact               | Mitigation                            |
| ------------------------ | -------------------- | ------------------------------------- |
| Variable base URLs       | Each store unique    | Store URL per connection              |
| Version differences      | API behavior varies  | Store version, version-aware code     |
| SSL certificates         | Self-signed possible | Allow custom CA configuration         |
| Server performance       | Varies by hosting    | Adaptive rate limiting                |
| Firewall/IP restrictions | May whitelist IPs    | Document required IPs                 |
| Downtime                 | Customer-controlled  | Handle connection failures gracefully |

### Multi-Store Support

PrestaShop supports multiple stores in one installation:

```
# Query specific shop
?id_shop={shop_id}

# Query shop group
?id_group_shop={group_id}

# List available shops
GET /api/shops?output_format=JSON
```

---

## Example AI Agent Conversations

### Scenario 1: Order Status Inquiry

```
Customer: "What's the status of my order XKBKNABJK?"

AI Agent: [Uses list_orders with reference filter, then get_order]

Response: "I found your order XKBKNABJK! Here are the details:

Order Status: Shipped
Payment: Paid (Credit Card)
Total: 89.99 EUR

Items:
- Nike Air Max 90 (Size 42) x1 - 79.99 EUR
- Shipping - 10.00 EUR

Shipping Address:
123 Main Street
Paris, 75001
France

Tracking Number: 1Z999AA10123456784

Your order was shipped on January 10th. Would you like the tracking link?"
```

### Scenario 2: Product Availability

```
Customer: "Do you have the Samsung Galaxy S24 in stock?"

AI Agent: [Uses list_products with name filter, then check_stock]

Response: "Let me check our Samsung Galaxy S24 inventory...

Samsung Galaxy S24 (128GB)
- Price: 899.00 EUR
- Black: 5 in stock
- White: 3 in stock
- Purple: Out of stock

Samsung Galaxy S24 (256GB)
- Price: 999.00 EUR
- Black: 2 in stock
- White: 1 in stock

Would you like to place an order?"
```

### Scenario 3: Update Shipping Status

```
Staff: "Mark order 12345 as shipped with tracking number TRACK123456"

AI Agent: Let me confirm before updating:
- Order ID: 12345
- New Status: Shipped (State ID: 4)
- Tracking Number: TRACK123456

Proceed with update?

Staff: "Yes"

AI Agent: [Uses update_order_status and add_tracking_number]

Response: "Order 12345 has been updated!

New Status: Shipped
Tracking Number: TRACK123456
Customer notification: Sent

The customer will receive an email with shipping details."
```

### Scenario 4: Customer Lookup

```
Staff: "Find customer john.doe@example.com"

AI Agent: [Uses search_customers with email filter, then get_customer]

Response: "Found customer:

John Doe
Email: john.doe@example.com
Member Since: March 15, 2024
Active: Yes
Newsletter: Subscribed

Addresses:
1. Home - 123 Main St, Paris 75001, France
2. Work - 456 Business Ave, Lyon 69001, France

Would you like to see their order history?"
```

---

## Security Best Practices

1. **Use HTTP Basic Auth header**: Never embed API key in URLs
2. **Store API key in Secrets Manager**: Never in code or config files
3. **Use HTTPS only**: Reject HTTP connections
4. **Minimal permissions**: Request only needed resource permissions
5. **Validate SSL certificates**: Handle self-signed certs securely
6. **Log API access**: Track usage for security auditing
7. **Handle connection errors**: Don't expose internal errors to users
8. **Version detection**: Verify API compatibility before operations

---

## Implementation Checklist

### Connection Setup

- [ ] Validate shop URL format and accessibility
- [ ] Verify API key with test request to `/api/`
- [ ] Detect PrestaShop version
- [ ] Get default language and shop IDs
- [ ] Store credentials securely

### Core Functionality

- [ ] Implement get_order with full details
- [ ] Implement list_orders with filtering
- [ ] Implement get_product with variants
- [ ] Implement list_products with search
- [ ] Implement check_stock
- [ ] Implement get_customer

### Write Operations

- [ ] Implement update_order_status via order_histories
- [ ] Implement add_tracking_number via order_carriers
- [ ] Add confirmation prompts for write operations

### Version Compatibility

- [ ] Test on PrestaShop 1.7.x
- [ ] Test on PrestaShop 8.x
- [ ] Handle multilingual fields correctly
- [ ] Handle version-specific behaviors

### Error Handling

- [ ] Parse error responses (JSON and XML)
- [ ] Implement retry with exponential backoff
- [ ] Handle connection timeouts
- [ ] Log errors for debugging

---

## Related Documents

- [Integrations Service Architecture](../integrations-service-architecture.md)
- [Shopify Integration Specification](./ecommerce-shopify.md)
- [Haravan Integration Specification](./ecommerce-haravan.md)
- [Sapo Integration Specification](./ecommerce-sapo.md)
