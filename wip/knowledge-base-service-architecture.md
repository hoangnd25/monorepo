# Knowledge Base Service Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-10

## Context & Problem Statement

### Business Need

AI agents need access to customer-specific knowledge to provide accurate, contextual responses. Without domain knowledge, agents can only provide generic answers that may not reflect the tenant's products, policies, or procedures.

Tenants need to provide:

- **Unstructured content**: Documents (PDFs, Word), web pages, FAQs, help articles
- **Structured content**: Product catalogs, inventory, pricing, customer records

Current challenges:

- **No knowledge customization**: AI agents lack tenant-specific context
- **Manual prompt engineering**: Tenants must embed knowledge directly in prompts (limited, not scalable)
- **No dynamic updates**: Changing products/policies requires updating agent configurations manually
- **Inconsistent responses**: Agents may hallucinate or provide outdated information

### Solution

Build a **Knowledge Base Service** that:

1. **Ingests unstructured content** (documents, web pages) and converts to searchable embeddings
2. **Manages structured data** with tenant-defined or predefined schemas (e.g., products, FAQs)
3. **Provides RAG (Retrieval-Augmented Generation)** capabilities for AI agents
4. **Integrates seamlessly** with the AI Agents Service via internal APIs
5. **Supports multi-tenancy** with proper isolation and access control

### Relationship to AI Agents Service

```
                         AI AGENTS SERVICE
                               │
                               │ Tool: search_knowledge
                               │ Tool: get_product
                               │ Tool: search_faqs
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE BASE SERVICE                               │
│                                                                             │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐  │
│  │  Unstructured Content      │    │  Structured Content                │  │
│  │                            │    │                                    │  │
│  │  • Documents (PDF, DOCX)   │    │  • Products (predefined schema)   │  │
│  │  • Web pages               │    │  • FAQs (predefined schema)       │  │
│  │  • Help articles           │    │  • Custom models (tenant-defined) │  │
│  │  • Knowledge articles      │    │                                    │  │
│  │                            │    │                                    │  │
│  │  Vector Search (OpenSearch)│    │  Structured Queries (DynamoDB)    │  │
│  └────────────────────────────┘    └────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CONTENT SOURCES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ Document Upload   │  │ Web Scraper       │  │ API Import            │   │
│  │ (S3 + Lambda)     │  │ (Scheduled)       │  │ (Bulk/Real-time)      │   │
│  │                   │  │                   │  │                       │   │
│  │ PDF, DOCX, TXT    │  │ URLs, Sitemaps    │  │ Products, FAQs        │   │
│  └─────────┬─────────┘  └─────────┬─────────┘  └───────────┬───────────┘   │
│            │                      │                        │               │
└────────────┼──────────────────────┼────────────────────────┼───────────────┘
             │                      │                        │
             └──────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE BASE SERVICE                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Content Processing Pipeline                      │  │
│  │                                                                       │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐   │  │
│  │  │ Extractor   │    │ Chunker     │    │ Embedding Generator     │   │  │
│  │  │             │───▶│             │───▶│                         │   │  │
│  │  │ PDF→Text    │    │ Split into  │    │ Bedrock Titan/Cohere    │   │  │
│  │  │ HTML→Text   │    │ passages    │    │ Generate vectors        │   │  │
│  │  │ DOCX→Text   │    │             │    │                         │   │  │
│  │  └─────────────┘    └─────────────┘    └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│            ┌───────────────────────┼───────────────────────┐                │
│            │                       │                       │                │
│            ▼                       ▼                       ▼                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐    │
│  │  OpenSearch     │   │   DynamoDB      │   │   S3                    │    │
│  │  Serverless     │   │                 │   │                         │    │
│  │                 │   │  • Collections  │   │  • Original documents   │    │
│  │  • Vector store │   │  • Documents    │   │  • Extracted text       │    │
│  │  • Hybrid search│   │  • Models       │   │  • Metadata             │    │
│  │  • BM25 + kNN   │   │  • Records      │   │                         │    │
│  │                 │   │  • Sync Jobs    │   │                         │    │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Internal API (ORPC + IAM Auth)                     │  │
│  │                                                                       │  │
│  │  Collections:                  Documents:                             │  │
│  │  • collections.create          • documents.upload                     │  │
│  │  • collections.get             • documents.get                        │  │
│  │  • collections.update          • documents.delete                     │  │
│  │  • collections.delete          • documents.list                       │  │
│  │  • collections.list            • documents.reprocess                  │  │
│  │                                                                       │  │
│  │  Search:                       Models (Structured):                   │  │
│  │  • search.query                • models.create                        │  │
│  │  • search.hybrid               • models.get                           │  │
│  │  • search.semantic             • models.update                        │  │
│  │                                • models.delete                        │  │
│  │  Records (Structured):         • models.list                          │  │
│  │  • records.create                                                     │  │
│  │  • records.get                 Web Scraping:                          │  │
│  │  • records.update              • scraping.addUrl                      │  │
│  │  • records.delete              • scraping.addSitemap                  │  │
│  │  • records.list                • scraping.sync                        │  │
│  │  • records.bulkUpsert          • scraping.status                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
             │                                    ▲
             │ Events                             │ Internal API Calls
             ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI AGENTS SERVICE                                │
│                                                                             │
│  Agent Tools:                                                               │
│  • search_knowledge(query, collection_ids)                                  │
│  • get_product(product_id)                                                  │
│  • search_products(filters, query)                                          │
│  • get_faq(faq_id)                                                          │
│  • search_faqs(query)                                                       │
│  • query_custom_model(model_id, query, filters)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Collection

A **Collection** is a container for related content within a tenant's knowledge base.

| Field              | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `tenantId`         | Owning tenant                                           |
| `collectionId`     | Unique identifier (ULID)                                |
| `name`             | Human-readable name                                     |
| `description`      | Purpose of this collection                              |
| `type`             | `unstructured` \| `structured`                          |
| `modelId`          | For structured: reference to data model                 |
| `embeddingModel`   | For unstructured: `titan-embed-v2` \| `cohere-embed-v3` |
| `chunkingStrategy` | `fixed` \| `semantic` \| `paragraph`                    |
| `chunkSize`        | Target chunk size in tokens (default: 512)              |
| `chunkOverlap`     | Overlap between chunks (default: 50)                    |
| `metadata`         | Custom metadata fields for filtering                    |
| `documentCount`    | Number of documents in collection                       |
| `lastSyncAt`       | Last sync timestamp (for web scraping)                  |
| `status`           | `active` \| `processing` \| `error`                     |
| `createdAt`        | Creation timestamp                                      |
| `updatedAt`        | Last update timestamp                                   |

**Collection Types:**

| Type           | Description                          | Storage         | Search Method        |
| -------------- | ------------------------------------ | --------------- | -------------------- |
| `unstructured` | Documents, web pages, articles       | OpenSearch + S3 | Vector + BM25 hybrid |
| `structured`   | Typed records (products, FAQs, etc.) | DynamoDB        | Attribute queries    |

### Document (Unstructured)

A **Document** represents a single piece of unstructured content.

| Field              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `tenantId`         | Owning tenant                                        |
| `collectionId`     | Parent collection                                    |
| `documentId`       | Unique identifier (ULID)                             |
| `source`           | `upload` \| `url` \| `api`                           |
| `sourceUrl`        | Original URL (for web-scraped content)               |
| `sourceFile`       | S3 key of original file (for uploads)                |
| `title`            | Document title                                       |
| `contentType`      | MIME type (`application/pdf`, `text/html`, etc.)     |
| `extractedText`    | S3 key of extracted text                             |
| `chunkCount`       | Number of chunks created                             |
| `metadata`         | Custom metadata (author, date, category, etc.)       |
| `processingStatus` | `pending` \| `processing` \| `completed` \| `failed` |
| `errorMessage`     | Error details if processing failed                   |
| `createdAt`        | Creation timestamp                                   |
| `updatedAt`        | Last update timestamp                                |

### Chunk (Vector Embedding)

A **Chunk** is a searchable segment of a document stored in the vector database.

| Field          | Description                              |
| -------------- | ---------------------------------------- |
| `chunkId`      | Unique identifier (ULID)                 |
| `tenantId`     | Owning tenant (for filtering)            |
| `collectionId` | Parent collection                        |
| `documentId`   | Source document                          |
| `content`      | Text content of the chunk                |
| `embedding`    | Vector embedding (1536 or 1024 dims)     |
| `position`     | Position in document (for ordering)      |
| `metadata`     | Inherited from document + chunk-specific |

### Model (Structured Schema)

A **Model** defines the schema for structured content within a collection.

| Field        | Description                                       |
| ------------ | ------------------------------------------------- |
| `tenantId`   | Owning tenant (null for predefined models)        |
| `modelId`    | Unique identifier (ULID or predefined name)       |
| `name`       | Model name (e.g., `product`, `faq`, `custom_xyz`) |
| `type`       | `predefined` \| `custom`                          |
| `version`    | Schema version for migrations                     |
| `fields`     | Array of field definitions                        |
| `indexes`    | Custom indexes for querying                       |
| `searchable` | Fields to include in full-text search             |
| `status`     | `active` \| `deprecated`                          |
| `createdAt`  | Creation timestamp                                |
| `updatedAt`  | Last update timestamp                             |

**Field Definition:**

```typescript
interface ModelField {
  name: string; // Field name (camelCase)
  type: FieldType; // string, number, boolean, array, object, date, enum
  required: boolean; // Is field required
  indexed: boolean; // Create DynamoDB index
  searchable: boolean; // Include in text search
  description: string; // For AI context
  enumValues?: string[]; // For enum type
  arrayItemType?: FieldType; // For array type
  objectSchema?: ModelField[]; // For object type
  defaultValue?: unknown; // Default value
  validation?: {
    // Validation rules
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
  };
}

type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'date'
  | 'enum'
  | 'richtext';
```

### Record (Structured Data)

A **Record** is a single instance of structured data conforming to a model.

| Field          | Description                           |
| -------------- | ------------------------------------- |
| `tenantId`     | Owning tenant                         |
| `collectionId` | Parent collection                     |
| `recordId`     | Unique identifier (ULID)              |
| `modelId`      | Schema this record conforms to        |
| `data`         | Record data (validated against model) |
| `searchText`   | Concatenated searchable fields        |
| `createdAt`    | Creation timestamp                    |
| `updatedAt`    | Last update timestamp                 |

---

## Predefined Models

Predefined models help tenants get started quickly with common use cases.

### Product Model

```typescript
const ProductModel: Model = {
  modelId: 'product',
  name: 'Product',
  type: 'predefined',
  description: 'E-commerce product catalog',
  fields: [
    {
      name: 'sku',
      type: 'string',
      required: true,
      indexed: true,
      searchable: false,
      description: 'Stock keeping unit',
    },
    {
      name: 'name',
      type: 'string',
      required: true,
      indexed: false,
      searchable: true,
      description: 'Product name',
    },
    {
      name: 'description',
      type: 'richtext',
      required: false,
      indexed: false,
      searchable: true,
      description: 'Product description',
    },
    {
      name: 'category',
      type: 'string',
      required: true,
      indexed: true,
      searchable: true,
      description: 'Product category',
    },
    {
      name: 'subcategory',
      type: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Product subcategory',
    },
    {
      name: 'brand',
      type: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Brand name',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      indexed: true,
      searchable: false,
      description: 'Price in cents',
    },
    {
      name: 'currency',
      type: 'string',
      required: true,
      indexed: false,
      searchable: false,
      description: 'Currency code (e.g., USD)',
    },
    {
      name: 'salePrice',
      type: 'number',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Sale price in cents',
    },
    {
      name: 'inStock',
      type: 'boolean',
      required: true,
      indexed: true,
      searchable: false,
      description: 'Is product in stock',
    },
    {
      name: 'stockQuantity',
      type: 'number',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Available quantity',
    },
    {
      name: 'images',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Image URLs',
    },
    {
      name: 'attributes',
      type: 'object',
      required: false,
      indexed: false,
      searchable: true,
      description: 'Custom attributes (size, color, etc.)',
    },
    {
      name: 'tags',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Product tags',
    },
    {
      name: 'url',
      type: 'string',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Product page URL',
    },
  ],
  indexes: [
    { name: 'byCategory', fields: ['category', 'subcategory'] },
    { name: 'byBrand', fields: ['brand'] },
    { name: 'byPrice', fields: ['price'] },
  ],
  searchable: ['name', 'description', 'category', 'brand', 'tags'],
};
```

### FAQ Model

```typescript
const FAQModel: Model = {
  modelId: 'faq',
  name: 'FAQ',
  type: 'predefined',
  description: 'Frequently asked questions',
  fields: [
    {
      name: 'question',
      type: 'string',
      required: true,
      indexed: false,
      searchable: true,
      description: 'The question',
    },
    {
      name: 'answer',
      type: 'richtext',
      required: true,
      indexed: false,
      searchable: true,
      description: 'The answer',
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'FAQ category',
    },
    {
      name: 'tags',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Tags for filtering',
    },
    {
      name: 'priority',
      type: 'number',
      required: false,
      indexed: true,
      searchable: false,
      description: 'Display priority (higher = more important)',
    },
    {
      name: 'relatedFaqIds',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Related FAQ IDs',
    },
    {
      name: 'helpfulCount',
      type: 'number',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Number of helpful votes',
    },
    {
      name: 'notHelpfulCount',
      type: 'number',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Number of not helpful votes',
    },
  ],
  indexes: [
    { name: 'byCategory', fields: ['category'] },
    { name: 'byPriority', fields: ['priority'] },
  ],
  searchable: ['question', 'answer', 'category', 'tags'],
};
```

### Policy Model

```typescript
const PolicyModel: Model = {
  modelId: 'policy',
  name: 'Policy',
  type: 'predefined',
  description: 'Company policies and procedures',
  fields: [
    {
      name: 'title',
      type: 'string',
      required: true,
      indexed: false,
      searchable: true,
      description: 'Policy title',
    },
    {
      name: 'content',
      type: 'richtext',
      required: true,
      indexed: false,
      searchable: true,
      description: 'Policy content',
    },
    {
      name: 'summary',
      type: 'string',
      required: false,
      indexed: false,
      searchable: true,
      description: 'Brief summary',
    },
    {
      name: 'category',
      type: 'string',
      required: true,
      indexed: true,
      searchable: true,
      description: 'Policy category (returns, shipping, privacy, etc.)',
    },
    {
      name: 'effectiveDate',
      type: 'date',
      required: false,
      indexed: true,
      searchable: false,
      description: 'When policy became effective',
    },
    {
      name: 'expirationDate',
      type: 'date',
      required: false,
      indexed: true,
      searchable: false,
      description: 'When policy expires (if applicable)',
    },
    {
      name: 'version',
      type: 'string',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Policy version',
    },
    {
      name: 'keywords',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Keywords for search',
    },
  ],
  indexes: [
    { name: 'byCategory', fields: ['category'] },
    { name: 'byEffectiveDate', fields: ['effectiveDate'] },
  ],
  searchable: ['title', 'content', 'summary', 'category', 'keywords'],
};
```

### Order Model (For Order Lookup)

```typescript
const OrderModel: Model = {
  modelId: 'order',
  name: 'Order',
  type: 'predefined',
  description: 'Customer orders for lookup and support',
  fields: [
    {
      name: 'orderNumber',
      type: 'string',
      required: true,
      indexed: true,
      searchable: true,
      description: 'Order number',
    },
    {
      name: 'customerEmail',
      type: 'string',
      required: true,
      indexed: true,
      searchable: false,
      description: 'Customer email',
    },
    {
      name: 'customerName',
      type: 'string',
      required: false,
      indexed: false,
      searchable: true,
      description: 'Customer name',
    },
    {
      name: 'status',
      type: 'enum',
      enumValues: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
      ],
      required: true,
      indexed: true,
      searchable: false,
      description: 'Order status',
    },
    {
      name: 'orderDate',
      type: 'date',
      required: true,
      indexed: true,
      searchable: false,
      description: 'Order date',
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      indexed: false,
      searchable: false,
      description: 'Total amount in cents',
    },
    {
      name: 'currency',
      type: 'string',
      required: true,
      indexed: false,
      searchable: false,
      description: 'Currency code',
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      indexed: false,
      searchable: false,
      description: 'Order line items',
    },
    {
      name: 'shippingAddress',
      type: 'object',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Shipping address',
    },
    {
      name: 'trackingNumber',
      type: 'string',
      required: false,
      indexed: true,
      searchable: true,
      description: 'Shipping tracking number',
    },
    {
      name: 'trackingUrl',
      type: 'string',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Tracking URL',
    },
    {
      name: 'estimatedDelivery',
      type: 'date',
      required: false,
      indexed: false,
      searchable: false,
      description: 'Estimated delivery date',
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      indexed: false,
      searchable: true,
      description: 'Order notes',
    },
  ],
  indexes: [
    { name: 'byOrderNumber', fields: ['orderNumber'] },
    { name: 'byCustomerEmail', fields: ['customerEmail', 'orderDate'] },
    { name: 'byStatus', fields: ['status'] },
    { name: 'byTrackingNumber', fields: ['trackingNumber'] },
  ],
  searchable: ['orderNumber', 'customerName', 'trackingNumber', 'notes'],
};
```

---

## Custom Model Creation

Tenants can define custom models for their specific use cases.

### Custom Model API

```typescript
// Create a custom model
const customModel = await knowledgeClient.models.create({
  name: 'RealEstateProperty',
  description: 'Real estate property listings',
  fields: [
    {
      name: 'listingId',
      type: 'string',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'address',
      type: 'string',
      required: true,
      indexed: false,
      searchable: true,
    },
    {
      name: 'city',
      type: 'string',
      required: true,
      indexed: true,
      searchable: true,
    },
    {
      name: 'state',
      type: 'string',
      required: true,
      indexed: true,
      searchable: true,
    },
    {
      name: 'zipCode',
      type: 'string',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'propertyType',
      type: 'enum',
      enumValues: ['house', 'condo', 'apartment', 'townhouse', 'land'],
      required: true,
      indexed: true,
    },
    {
      name: 'bedrooms',
      type: 'number',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'bathrooms',
      type: 'number',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'squareFeet',
      type: 'number',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'description',
      type: 'richtext',
      required: false,
      indexed: false,
      searchable: true,
    },
    {
      name: 'features',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: true,
      searchable: true,
    },
    {
      name: 'images',
      type: 'array',
      arrayItemType: 'string',
      required: false,
      indexed: false,
      searchable: false,
    },
    {
      name: 'listingDate',
      type: 'date',
      required: true,
      indexed: true,
      searchable: false,
    },
    {
      name: 'status',
      type: 'enum',
      enumValues: ['active', 'pending', 'sold', 'withdrawn'],
      required: true,
      indexed: true,
    },
  ],
});

// Create a collection using the custom model
const collection = await knowledgeClient.collections.create({
  name: 'Property Listings',
  type: 'structured',
  modelId: customModel.modelId,
});

// Add records
await knowledgeClient.records.bulkUpsert({
  collectionId: collection.collectionId,
  records: [
    {
      listingId: 'MLS-12345',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      propertyType: 'house',
      bedrooms: 4,
      bathrooms: 3,
      squareFeet: 2500,
      price: 650000,
      description: 'Beautiful 4-bedroom home in downtown Austin...',
      features: ['pool', 'garage', 'updated kitchen'],
      listingDate: '2026-01-15',
      status: 'active',
    },
    // ... more records
  ],
});
```

### Schema Evolution

Models support versioned schema changes:

```typescript
// Add a new field (backward compatible)
await knowledgeClient.models.update({
  modelId: customModel.modelId,
  addFields: [
    {
      name: 'virtualTourUrl',
      type: 'string',
      required: false,
      indexed: false,
      searchable: false,
    },
  ],
});

// Records without the new field remain valid
// New records can include the field
```

**Migration Strategy:**

| Change Type        | Action                           | Impact           |
| ------------------ | -------------------------------- | ---------------- |
| Add optional field | Auto-migrate (null default)      | None             |
| Add required field | Provide default value            | Backfill needed  |
| Remove field       | Mark deprecated, keep in storage | None             |
| Change field type  | Not allowed (create new field)   | N/A              |
| Rename field       | Add new + deprecate old          | Manual migration |

---

## Content Processing Pipeline

### Unstructured Content Flow

```
1. Content Ingestion
   ├── Document Upload → S3 (original file)
   ├── URL Submission → Web Scraper Lambda
   └── API Import → Direct text content
                │
                ▼
2. Content Extraction
   ├── PDF → Apache Tika / Textract
   ├── DOCX → Apache Tika
   ├── HTML → Cheerio (text + structure)
   └── TXT → Direct read
                │
                ▼
3. Text Processing
   ├── Clean and normalize text
   ├── Extract metadata (title, author, date)
   └── Detect language
                │
                ▼
4. Chunking
   ├── Fixed: Split by token count
   ├── Semantic: Split by meaning (sentences/paragraphs)
   └── Paragraph: Split by paragraph markers
                │
                ▼
5. Embedding Generation
   ├── Batch chunks (max 25 per request)
   ├── Generate embeddings via Bedrock
   └── Handle rate limits with exponential backoff
                │
                ▼
6. Storage
   ├── Chunks → OpenSearch Serverless
   ├── Metadata → DynamoDB
   └── Original + Extracted → S3
```

### Chunking Strategies

| Strategy    | Description                          | Best For                    |
| ----------- | ------------------------------------ | --------------------------- |
| `fixed`     | Fixed token count with overlap       | General purpose, consistent |
| `semantic`  | Sentence/paragraph boundaries        | Maintaining context         |
| `paragraph` | Split on paragraph markers           | Well-structured documents   |
| `markdown`  | Split on headers, preserve structure | Technical documentation     |

**Fixed Chunking Example:**

```typescript
interface ChunkingConfig {
  strategy: 'fixed';
  chunkSize: 512; // Target tokens per chunk
  chunkOverlap: 50; // Overlap tokens between chunks
}
```

### Embedding Models

| Model                          | Dimensions | Max Tokens | Best For                    |
| ------------------------------ | ---------- | ---------- | --------------------------- |
| `amazon.titan-embed-v2`        | 1024       | 8,192      | General purpose, multi-lang |
| `cohere.embed-english-v3`      | 1024       | 512        | English content             |
| `cohere.embed-multilingual-v3` | 1024       | 512        | Multi-language content      |

---

## Search Capabilities

### Hybrid Search (Unstructured)

Combines vector similarity with keyword matching for best results.

```typescript
interface SearchRequest {
  query: string;
  collectionIds: string[]; // Collections to search
  filters?: {
    // Metadata filters
    [key: string]: string | number | boolean;
  };
  limit?: number; // Max results (default: 10)
  threshold?: number; // Min similarity score (0-1)
  hybridWeights?: {
    // Weights for hybrid search
    vector: number; // Default: 0.7
    keyword: number; // Default: 0.3
  };
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  collectionId: string;
  content: string;
  score: number; // Combined relevance score
  metadata: Record<string, unknown>;
  document: {
    // Parent document info
    title: string;
    sourceUrl?: string;
  };
}
```

### Structured Queries

Query structured records with filters and full-text search.

```typescript
interface RecordQuery {
  collectionId: string;
  filters?: {
    [field: string]: {
      eq?: unknown; // Equals
      ne?: unknown; // Not equals
      gt?: number; // Greater than
      gte?: number; // Greater than or equal
      lt?: number; // Less than
      lte?: number; // Less than or equal
      in?: unknown[]; // In array
      contains?: string; // String contains
      startsWith?: string; // String starts with
      between?: [number, number]; // Range
    };
  };
  search?: string; // Full-text search across searchable fields
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  cursor?: string; // Pagination cursor
}

interface RecordQueryResult {
  records: Array<{
    recordId: string;
    data: Record<string, unknown>;
    score?: number; // If search query provided
  }>;
  nextCursor?: string;
  totalCount: number;
}
```

---

## AI Agent Integration

### Agent Tools

The AI Agents Service uses knowledge base tools to access tenant knowledge:

```typescript
// Tool: Search unstructured knowledge
const searchKnowledge = tool(
  async ({ query, collectionIds, filters }) => {
    const results = await knowledgeClient.search.hybrid({
      query,
      collectionIds,
      filters,
      limit: 5,
    });

    return results.map((r) => ({
      content: r.content,
      source: r.document.title,
      url: r.document.sourceUrl,
    }));
  },
  {
    name: 'search_knowledge',
    description: 'Search the knowledge base for relevant information',
    schema: z.object({
      query: z.string().describe('Search query'),
      collectionIds: z
        .array(z.string())
        .optional()
        .describe('Collection IDs to search'),
      filters: z.record(z.unknown()).optional().describe('Metadata filters'),
    }),
  }
);

// Tool: Search products
const searchProducts = tool(
  async ({ query, category, inStock, minPrice, maxPrice }) => {
    const results = await knowledgeClient.records.query({
      collectionId: productCollectionId,
      search: query,
      filters: {
        ...(category && { category: { eq: category } }),
        ...(inStock !== undefined && { inStock: { eq: inStock } }),
        ...(minPrice && { price: { gte: minPrice } }),
        ...(maxPrice && { price: { lte: maxPrice } }),
      },
      limit: 10,
    });

    return results.records.map((r) => r.data);
  },
  {
    name: 'search_products',
    description: 'Search product catalog',
    schema: z.object({
      query: z.string().optional().describe('Search query'),
      category: z.string().optional().describe('Product category'),
      inStock: z.boolean().optional().describe('Filter by stock status'),
      minPrice: z.number().optional().describe('Minimum price in cents'),
      maxPrice: z.number().optional().describe('Maximum price in cents'),
    }),
  }
);

// Tool: Get FAQ answer
const searchFaqs = tool(
  async ({ query, category }) => {
    const results = await knowledgeClient.records.query({
      collectionId: faqCollectionId,
      search: query,
      filters: category ? { category: { eq: category } } : undefined,
      sort: { field: 'priority', direction: 'desc' },
      limit: 3,
    });

    return results.records.map((r) => ({
      question: r.data.question,
      answer: r.data.answer,
      category: r.data.category,
    }));
  },
  {
    name: 'search_faqs',
    description: 'Search frequently asked questions',
    schema: z.object({
      query: z.string().describe('Question or topic to search'),
      category: z.string().optional().describe('FAQ category'),
    }),
  }
);

// Tool: Lookup order
const lookupOrder = tool(
  async ({ orderNumber, customerEmail }) => {
    const results = await knowledgeClient.records.query({
      collectionId: orderCollectionId,
      filters: {
        ...(orderNumber && { orderNumber: { eq: orderNumber } }),
        ...(customerEmail && { customerEmail: { eq: customerEmail } }),
      },
      sort: { field: 'orderDate', direction: 'desc' },
      limit: 5,
    });

    return results.records.map((r) => r.data);
  },
  {
    name: 'lookup_order',
    description: 'Look up customer orders',
    schema: z.object({
      orderNumber: z.string().optional().describe('Order number'),
      customerEmail: z.string().optional().describe('Customer email'),
    }),
  }
);
```

### RAG Context Building

When an agent receives a message, the context builder can automatically retrieve relevant knowledge:

```typescript
async function buildAgentContext(
  tenantId: string,
  agentConfig: AgentConfig,
  message: string
): Promise<string> {
  const contextParts: string[] = [];

  // 1. Search configured knowledge collections
  if (agentConfig.knowledgeCollectionIds?.length) {
    const searchResults = await knowledgeClient.search.hybrid({
      query: message,
      collectionIds: agentConfig.knowledgeCollectionIds,
      limit: 5,
    });

    if (searchResults.length > 0) {
      contextParts.push('## Relevant Knowledge\n');
      for (const result of searchResults) {
        contextParts.push(`### ${result.document.title}\n${result.content}\n`);
      }
    }
  }

  // 2. Build structured context based on detected intent
  // (e.g., if user asks about products, fetch relevant products)

  return contextParts.join('\n');
}
```

---

## Web Scraping

### URL-Based Ingestion

```typescript
// Add single URL
await knowledgeClient.scraping.addUrl({
  collectionId: 'col-123',
  url: 'https://example.com/help/article-1',
  metadata: {
    category: 'help',
    section: 'getting-started',
  },
});

// Add sitemap for bulk import
await knowledgeClient.scraping.addSitemap({
  collectionId: 'col-123',
  sitemapUrl: 'https://example.com/sitemap.xml',
  urlPattern: '/help/*', // Only scrape URLs matching pattern
  metadata: {
    source: 'help-center',
  },
});

// Manual sync trigger
await knowledgeClient.scraping.sync({
  collectionId: 'col-123',
});
```

### Sync Configuration

```typescript
interface SyncConfig {
  collectionId: string;
  schedule?: string; // Cron expression (e.g., '0 0 * * *' for daily)
  changeDetection: boolean; // Only re-process changed content
  retryFailedUrls: boolean; // Retry previously failed URLs
  maxDepth?: number; // Max link-following depth (for crawling)
  respectRobotsTxt: boolean; // Honor robots.txt
  userAgent: string; // Custom user agent
}
```

### Sync Job Status

```typescript
interface SyncJob {
  jobId: string;
  collectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  stats: {
    urlsTotal: number;
    urlsProcessed: number;
    urlsSucceeded: number;
    urlsFailed: number;
    chunksCreated: number;
  };
  errors?: Array<{
    url: string;
    error: string;
  }>;
}
```

---

## Service Structure

```
services/knowledge-base/
├── functions/
│   └── src/
│       ├── internal-api/
│       │   ├── handler.ts           # Express + ORPC setup
│       │   ├── router.ts            # ORPC router
│       │   ├── collections.ts       # Collection CRUD
│       │   ├── documents.ts         # Document operations
│       │   ├── models.ts            # Model CRUD
│       │   ├── records.ts           # Record CRUD
│       │   ├── search.ts            # Search endpoints
│       │   └── scraping.ts          # Web scraping endpoints
│       │
│       ├── processors/
│       │   ├── document-processor.ts    # SQS consumer for doc processing
│       │   ├── embedding-generator.ts   # Batch embedding generation
│       │   └── web-scraper.ts           # Web scraping Lambda
│       │
│       ├── scheduled/
│       │   └── sync-scheduler.ts    # Scheduled sync jobs
│       │
│       └── lib/
│           ├── db/
│           │   ├── collections.ts   # Collection repository
│           │   ├── documents.ts     # Document repository
│           │   ├── models.ts        # Model repository
│           │   ├── records.ts       # Record repository
│           │   └── sync-jobs.ts     # Sync job repository
│           │
│           ├── search/
│           │   ├── opensearch.ts    # OpenSearch client
│           │   ├── vector-search.ts # Vector search operations
│           │   └── hybrid-search.ts # Hybrid search logic
│           │
│           ├── processing/
│           │   ├── extractors/
│           │   │   ├── pdf.ts       # PDF text extraction
│           │   │   ├── html.ts      # HTML text extraction
│           │   │   └── docx.ts      # DOCX text extraction
│           │   ├── chunkers/
│           │   │   ├── fixed.ts     # Fixed-size chunking
│           │   │   ├── semantic.ts  # Semantic chunking
│           │   │   └── markdown.ts  # Markdown-aware chunking
│           │   └── embeddings.ts    # Bedrock embedding client
│           │
│           ├── models/
│           │   ├── predefined/
│           │   │   ├── product.ts   # Product model definition
│           │   │   ├── faq.ts       # FAQ model definition
│           │   │   ├── policy.ts    # Policy model definition
│           │   │   └── order.ts     # Order model definition
│           │   └── validator.ts     # Schema validation
│           │
│           └── scraping/
│               ├── fetcher.ts       # URL fetcher with retry
│               ├── parser.ts        # HTML parser
│               └── sitemap.ts       # Sitemap parser
│
├── infra/
│   ├── Main.ts                      # Stack definition
│   ├── Api.ts                       # Internal API setup
│   ├── Database.ts                  # DynamoDB tables
│   ├── OpenSearch.ts                # OpenSearch Serverless
│   ├── Storage.ts                   # S3 buckets
│   └── Processing.ts                # Processing Lambdas + SQS
│
├── sst.config.ts
└── package.json
```

---

## Internal API Contract

### Collections

```typescript
// packages/contract-internal-api/src/knowledge.ts

export const createCollection = oc
  .route({ method: 'POST', path: '/collections' })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      type: z.enum(['unstructured', 'structured']),
      modelId: z.string().optional(), // Required for structured
      embeddingModel: z.string().default('amazon.titan-embed-v2'),
      chunkingStrategy: z
        .enum(['fixed', 'semantic', 'paragraph', 'markdown'])
        .default('fixed'),
      chunkSize: z.number().default(512),
      chunkOverlap: z.number().default(50),
    })
  )
  .output(CollectionSchema);

export const searchHybrid = oc
  .route({ method: 'POST', path: '/search/hybrid' })
  .input(
    z.object({
      query: z.string(),
      collectionIds: z.array(z.string()),
      filters: z.record(z.unknown()).optional(),
      limit: z.number().default(10),
      threshold: z.number().optional(),
      hybridWeights: z
        .object({
          vector: z.number(),
          keyword: z.number(),
        })
        .optional(),
    })
  )
  .output(z.array(SearchResultSchema));
```

### Models

```typescript
export const createModel = oc
  .route({ method: 'POST', path: '/models' })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      fields: z.array(FieldDefinitionSchema),
      indexes: z.array(IndexDefinitionSchema).optional(),
      searchable: z.array(z.string()).optional(),
    })
  )
  .output(ModelSchema);

export const getModel = oc
  .route({ method: 'GET', path: '/models/{modelId}' })
  .input(z.object({ modelId: z.string() }))
  .output(ModelSchema);
```

### Records

```typescript
export const queryRecords = oc
  .route({ method: 'POST', path: '/records/query' })
  .input(
    z.object({
      collectionId: z.string(),
      filters: z.record(FilterOperatorSchema).optional(),
      search: z.string().optional(),
      sort: z
        .object({
          field: z.string(),
          direction: z.enum(['asc', 'desc']),
        })
        .optional(),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    })
  )
  .output(
    z.object({
      records: z.array(RecordSchema),
      nextCursor: z.string().optional(),
      totalCount: z.number(),
    })
  );

export const bulkUpsertRecords = oc
  .route({ method: 'POST', path: '/records/bulk' })
  .input(
    z.object({
      collectionId: z.string(),
      records: z.array(
        z.object({
          recordId: z.string().optional(), // Optional for inserts
          data: z.record(z.unknown()),
        })
      ),
    })
  )
  .output(
    z.object({
      created: z.number(),
      updated: z.number(),
      failed: z.number(),
      errors: z
        .array(
          z.object({
            index: z.number(),
            error: z.string(),
          })
        )
        .optional(),
    })
  );
```

---

## Infrastructure

### DynamoDB Tables

**Collections Table:**

| Key | Type | Description       |
| --- | ---- | ----------------- |
| PK  | S    | `TENANT#<id>`     |
| SK  | S    | `COLLECTION#<id>` |

**Documents Table:**

| Key | Type | Description       |
| --- | ---- | ----------------- |
| PK  | S    | `COLLECTION#<id>` |
| SK  | S    | `DOCUMENT#<id>`   |

GSI: `DocumentsBySource` - Query by sourceUrl for deduplication

**Models Table:**

| Key | Type | Description   |
| --- | ---- | ------------- |
| PK  | S    | `TENANT#<id>` |
| SK  | S    | `MODEL#<id>`  |

GSI: `PredefinedModels` - Query predefined models (PK = `PREDEFINED`)

**Records Table:**

| Key | Type | Description       |
| --- | ---- | ----------------- |
| PK  | S    | `COLLECTION#<id>` |
| SK  | S    | `RECORD#<id>`     |

GSIs: Dynamic based on model indexes (up to 5 per collection)

**SyncJobs Table:**

| Key | Type | Description       |
| --- | ---- | ----------------- |
| PK  | S    | `COLLECTION#<id>` |
| SK  | S    | `JOB#<timestamp>` |

TTL: 7 days

### OpenSearch Serverless

```typescript
// Vector collection for embeddings
{
  name: 'knowledge-vectors',
  type: 'VECTORSEARCH',
  standbyReplicas: 'DISABLED',  // Cost optimization for non-prod
}

// Index mapping
{
  mappings: {
    properties: {
      tenantId: { type: 'keyword' },
      collectionId: { type: 'keyword' },
      documentId: { type: 'keyword' },
      content: { type: 'text' },
      embedding: {
        type: 'knn_vector',
        dimension: 1024,
        method: {
          name: 'hnsw',
          engine: 'nmslib',
          parameters: {
            ef_construction: 128,
            m: 16,
          },
        },
      },
      metadata: { type: 'object', dynamic: true },
    },
  },
}
```

### S3 Buckets

| Bucket                | Purpose                 | Lifecycle          |
| --------------------- | ----------------------- | ------------------ |
| `documents-original`  | Original uploaded files | 90 days to Glacier |
| `documents-extracted` | Extracted text content  | 30 days expiration |

### IAM Permissions

```typescript
// Bedrock access for embeddings
{
  actions: [
    'bedrock:InvokeModel',
  ],
  resources: [
    'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-*',
    'arn:aws:bedrock:*::foundation-model/cohere.embed-*',
  ],
}

// OpenSearch Serverless access
{
  actions: [
    'aoss:APIAccessAll',
  ],
  resources: [`arn:aws:aoss:${region}:${account}:collection/*`],
}

// Textract for PDF processing (optional)
{
  actions: [
    'textract:DetectDocumentText',
    'textract:AnalyzeDocument',
  ],
  resources: ['*'],
}
```

---

## Architecture Decisions

### Vector Database Choice

**Decision**: **OpenSearch Serverless** with vector search.

| Option                | Pros                                  | Cons                   |
| --------------------- | ------------------------------------- | ---------------------- |
| OpenSearch Serverless | Hybrid search, serverless, AWS native | Cost at scale          |
| Amazon Bedrock KB     | Fully managed, simple                 | Less customization     |
| Pinecone              | Purpose-built, fast                   | External service, cost |
| pgvector (RDS)        | Familiar, SQL queries                 | Operational overhead   |

**Rationale:**

- Hybrid search (vector + keyword) provides best results
- Serverless scales to zero when not in use
- Native AWS integration for security and compliance
- Built-in BM25 for keyword search

### Embedding Model

**Decision**: **Amazon Titan Embed v2** as default, with Cohere as alternative.

| Model           | Dimensions | Strengths                   |
| --------------- | ---------- | --------------------------- |
| Titan Embed v2  | 1024       | Multi-language, AWS native  |
| Cohere Embed v3 | 1024       | High quality, English-first |

**Rationale:**

- Titan provides good multi-language support
- AWS native means simpler security
- Allow tenant to choose based on content language

### Structured Data Storage

**Decision**: **DynamoDB** for structured records.

| Factor            | DynamoDB                | OpenSearch          |
| ----------------- | ----------------------- | ------------------- |
| CRUD operations   | Excellent               | Good                |
| Complex queries   | Limited                 | Excellent           |
| Consistency       | Strong                  | Eventual            |
| Cost              | Pay per request         | Always-on instances |
| Existing patterns | Consistent with project | New infrastructure  |

**Rationale:**

- Structured data needs strong consistency for CRUD
- DynamoDB GSIs handle most query patterns
- Full-text search on structured data can use OpenSearch if needed
- Consistent with existing codebase patterns

### Processing Architecture

**Decision**: **Async processing with SQS** for document ingestion.

```
Upload → S3 → Event → SQS → Processor Lambda
                              │
                              ├→ Extract text
                              ├→ Chunk content
                              ├→ Generate embeddings (batched)
                              └→ Index to OpenSearch
```

**Rationale:**

- Decouples upload from processing
- Handles large documents (embedding generation takes time)
- Natural retry mechanism for failures
- Can scale processing independently

### Chunking Strategy

**Decision**: **Configurable per collection** with sensible defaults.

| Strategy    | Default Size | Default Overlap | Use Case               |
| ----------- | ------------ | --------------- | ---------------------- |
| `fixed`     | 512 tokens   | 50 tokens       | General purpose        |
| `semantic`  | 400-600 tok  | Sentence        | Conversational content |
| `paragraph` | Variable     | None            | Structured docs        |
| `markdown`  | Header-based | None            | Technical docs         |

**Rationale:**

- No one-size-fits-all solution
- Different content types need different strategies
- Defaults work for 80% of cases

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Service scaffolding (sst.config, infra)
- [ ] DynamoDB tables (Collections, Documents, Models, Records)
- [ ] S3 buckets for document storage
- [ ] Basic Collection CRUD API
- [ ] Predefined model definitions (Product, FAQ, Policy, Order)

### Phase 2: Unstructured Content

- [ ] OpenSearch Serverless setup
- [ ] Document upload endpoint (S3 presigned URLs)
- [ ] Text extraction (PDF, HTML, DOCX)
- [ ] Chunking strategies implementation
- [ ] Bedrock embedding generation
- [ ] Vector indexing pipeline
- [ ] Basic vector search

### Phase 3: Structured Content

- [ ] Custom model creation API
- [ ] Record CRUD with validation
- [ ] Dynamic GSI management
- [ ] Full-text search for structured records
- [ ] Bulk import/export

### Phase 4: Search & Integration

- [ ] Hybrid search implementation
- [ ] AI Agent tools integration
- [ ] RAG context builder
- [ ] Search relevance tuning
- [ ] Metadata filtering

### Phase 5: Web Scraping

- [ ] URL ingestion endpoint
- [ ] Sitemap parser
- [ ] Scheduled sync jobs
- [ ] Change detection
- [ ] Error handling and retries

### Phase 6: UI Integration

- [ ] Collection management UI
- [ ] Document upload interface
- [ ] Record management (CRUD)
- [ ] Custom model builder
- [ ] Search testing interface

### Phase 7: Optimization

- [ ] Embedding caching
- [ ] Batch processing optimization
- [ ] Cost monitoring and alerts
- [ ] Usage analytics
- [ ] Performance tuning

---

## Open Questions

### Technical Decisions

- [ ] **Embedding cache**: Should we cache embeddings for common queries?
- [ ] **Cross-collection search**: Allow searching across multiple collection types?
- [ ] **Real-time sync**: WebSocket updates when processing completes?
- [ ] **Image support**: Extract text from images in documents?

### Product Decisions

- [ ] **Collection limits**: Max collections/documents per tenant?
- [ ] **Storage quotas**: How to handle large document uploads?
- [ ] **Model limits**: Max custom models per tenant?
- [ ] **Rate limits**: Processing queue limits per tenant?

### Future Considerations

- [ ] **Multi-modal**: Support for image/video content
- [ ] **Entity extraction**: Auto-extract entities from documents
- [ ] **Knowledge graphs**: Relationship mapping between content
- [ ] **Semantic caching**: Cache semantically similar queries

---

## References

### AWS Services

- [Amazon Bedrock Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html)
- [OpenSearch Serverless Vector Search](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html)
- [Amazon Textract](https://docs.aws.amazon.com/textract/latest/dg/what-is.html)

### RAG Patterns

- [LangChain RAG](https://js.langchain.com/docs/tutorials/rag)
- [AWS RAG Best Practices](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)

### Related Services

- [AI Agents Service Architecture](./ai-agents-service-architecture.md)
- [Conversations Service Architecture](./conversations-service-architecture.md)
- [LangChain Multi-Agent Patterns](./langchain-multi-agent-patterns.md)
