# Smart Web Crawler Design

> **Status**: Draft - High Level Design
> **Last Updated**: 2026-01-10
> **Related**: [Knowledge Base Service Architecture](./knowledge-base-service-architecture.md)

## Context & Problem Statement

### Business Need

Tenants want to quickly populate their knowledge base with existing content from their websites. Manually uploading documents or entering content is time-consuming and creates friction during onboarding. A smart web crawler allows tenants to:

1. **Quick Setup**: Point to their website and automatically import relevant content
2. **Stay Current**: Automatically detect and sync content changes
3. **Focus on Quality**: AI-powered filtering ensures only valuable content enters the knowledge base

### Current Gap

The Knowledge Base Service architecture outlines basic web scraping capabilities (`scraping.addUrl`, `scraping.addSitemap`, `scraping.sync`) but lacks:

- **Intelligent content understanding**: Distinguishing valuable content from navigation, ads, boilerplate
- **Smart crawling**: Understanding site structure, respecting boundaries, avoiding traps
- **Content classification**: Automatically categorizing pages (FAQ, product, article, policy)
- **Quality filtering**: Detecting and filtering low-quality, duplicate, or irrelevant content
- **Guardrails**: Protecting both the crawler infrastructure and target websites

### Solution

Build a **Smart Web Crawler** that:

1. **Intelligently navigates** websites using sitemap analysis and link discovery
2. **Understands content** using LLMs to classify, extract, and assess quality
3. **Respects boundaries** with rate limiting, robots.txt compliance, and domain restrictions
4. **Scales efficiently** using serverless architecture with parallel processing
5. **Provides visibility** with detailed crawl status, errors, and content previews

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CRAWL INITIATION                                    │
│                                                                                  │
│  Tenant UI / API                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  • Start crawl from seed URL(s)                                            │ │
│  │  • Configure: depth, page limit, include/exclude patterns                  │ │
│  │  • Select target collection                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┬┘
                                                                                  │
                                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CRAWL ORCHESTRATION                                    │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                     Step Functions (Standard Workflow)                      │ │
│  │                                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │ │
│  │  │ Initialize  │───▶│  Discovery  │───▶│  Parallel   │───▶│  Finalize   │  │ │
│  │  │   Crawl     │    │    Phase    │    │  Processing │    │   Crawl     │  │ │
│  │  │             │    │             │    │             │    │             │  │ │
│  │  │ • Validate  │    │ • Sitemap   │    │ Distributed │    │ • Stats     │  │ │
│  │  │ • robots.txt│    │ • Seed URLs │    │    Map      │    │ • Cleanup   │  │ │
│  │  │ • Rate calc │    │ • Queue URLs│    │ (per URL)   │    │ • Notify    │  │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │ │
│  │                                               │                            │ │
│  └───────────────────────────────────────────────┼────────────────────────────┘ │
│                                                  │                              │
└──────────────────────────────────────────────────┼──────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
                    ▼                              ▼                              ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
│      FETCH & EXTRACT        │  │     CONTENT ANALYSIS        │  │       STORAGE               │
│                             │  │                             │  │                             │
│  ┌───────────────────────┐  │  │  ┌───────────────────────┐  │  │  ┌───────────────────────┐  │
│  │  Lambda (Container)   │  │  │  │  Bedrock Pipeline     │  │  │  │  DynamoDB             │  │
│  │                       │  │  │  │                       │  │  │  │                       │  │
│  │  • Playwright/        │  │  │  │  1. Classification    │  │  │  │  • Crawl jobs         │  │
│  │    Puppeteer          │  │  │  │     (Nova Micro)      │  │  │  │  • URL state          │  │
│  │  • JavaScript render  │  │  │  │                       │  │  │  │  • robots.txt cache   │  │
│  │  • Content extraction │  │  │  │  2. Quality Check     │  │  │  │  • Rate limit state   │  │
│  │  • Link discovery     │  │  │  │     (Claude Haiku)    │  │  │  └───────────────────────┘  │
│  │                       │  │  │  │                       │  │  │                             │
│  └───────────────────────┘  │  │  │  3. Extraction        │  │  │  ┌───────────────────────┐  │
│                             │  │  │     (Claude Sonnet)   │  │  │  │  S3                   │  │
│  ┌───────────────────────┐  │  │  │                       │  │  │  │                       │  │
│  │  Cheerio (Fallback)   │  │  │  │  4. Embedding         │  │  │  │  • Raw HTML           │  │
│  │                       │  │  │  │     (Titan v2)        │  │  │  │  • Extracted text     │  │
│  │  • Static HTML        │  │  │  └───────────────────────┘  │  │  │  • Screenshots        │  │
│  │  • Fast extraction    │  │  │                             │  │  └───────────────────────┘  │
│  │  • No JS rendering    │  │  │                             │  │                             │
│  └───────────────────────┘  │  │                             │  │  ┌───────────────────────┐  │
│                             │  │                             │  │  │  OpenSearch           │  │
└─────────────────────────────┘  └─────────────────────────────┘  │  │                       │  │
                                                                  │  │  • Vector embeddings  │  │
                                                                  │  │  • Full-text index    │  │
                                                                  │  └───────────────────────┘  │
                                                                  └─────────────────────────────┘
```

---

## Core Components

### 1. Crawl Job Manager

Manages the lifecycle of crawl jobs and provides tenant visibility.

```typescript
interface CrawlJob {
  jobId: string; // ULID
  tenantId: string;
  collectionId: string;
  status: CrawlJobStatus;
  config: CrawlConfig;
  stats: CrawlStats;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

type CrawlJobStatus =
  | 'pending' // Job created, not started
  | 'initializing' // Fetching robots.txt, sitemap
  | 'discovering' // Finding URLs to crawl
  | 'processing' // Crawling and processing pages
  | 'finalizing' // Generating embeddings, cleanup
  | 'completed' // Successfully finished
  | 'failed' // Fatal error
  | 'cancelled'; // User cancelled

interface CrawlConfig {
  // Entry points
  seedUrls: string[]; // Starting URLs
  sitemapUrls?: string[]; // Sitemaps to parse

  // Boundaries
  allowedDomains: string[]; // Domains to crawl (derived from seeds)
  includePatterns?: string[]; // URL patterns to include (glob)
  excludePatterns?: string[]; // URL patterns to exclude (glob)
  maxDepth: number; // Max link-following depth (default: 3)
  maxPages: number; // Max pages to crawl (default: 100)

  // Behavior
  respectRobotsTxt: boolean; // Honor robots.txt (default: true)
  followExternalLinks: boolean; // Follow links to other domains (default: false)
  renderJavaScript: boolean; // Use headless browser (default: true)
  waitForSelector?: string; // CSS selector to wait for before extraction

  // Rate limiting
  requestsPerSecond: number; // Max requests per second per domain (default: 1)
  delayBetweenRequests: number; // Minimum delay in ms (default: 1000)

  // Content filtering
  minContentLength: number; // Min text length to accept (default: 100)
  maxContentLength: number; // Max text length to process (default: 100000)
  contentTypes: string[]; // Allowed content types (default: ['text/html'])

  // AI analysis
  enableClassification: boolean; // Classify page types (default: true)
  enableQualityCheck: boolean; // Filter low-quality content (default: true)
  qualityThreshold: number; // Min quality score 0-10 (default: 5)
  targetContentTypes?: string[]; // Content types to keep (article, faq, product, policy)
}

interface CrawlStats {
  urlsDiscovered: number;
  urlsQueued: number;
  urlsProcessed: number;
  urlsSucceeded: number;
  urlsFailed: number;
  urlsSkipped: number; // Filtered by quality/type
  urlsBlocked: number; // Blocked by robots.txt
  pagesIndexed: number;
  chunksCreated: number;
  bytesDownloaded: number;
  processingTimeMs: number;
}
```

### 2. URL Frontier (Discovery & Queue)

Manages URL discovery, deduplication, and prioritization.

```typescript
interface UrlEntry {
  urlHash: string; // SHA-256 hash for dedup
  url: string;
  crawlJobId: string;
  tenantId: string;

  // Discovery metadata
  source: 'seed' | 'sitemap' | 'link';
  parentUrl?: string; // Page this was discovered on
  depth: number; // Distance from seed

  // Processing state
  status: UrlStatus;
  priority: number; // Higher = process first
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;

  // Results
  httpStatus?: number;
  contentType?: string;
  contentLength?: number;
  documentId?: string; // If successfully processed
  error?: string;

  // Timestamps
  discoveredAt: string;
  processedAt?: string;
  ttl: number; // Auto-cleanup after job completion
}

type UrlStatus =
  | 'pending' // Discovered, not yet processed
  | 'queued' // In processing queue
  | 'processing' // Currently being fetched/analyzed
  | 'completed' // Successfully processed
  | 'failed' // Failed after max retries
  | 'skipped' // Filtered out (quality, type, etc.)
  | 'blocked'; // Blocked by robots.txt or rules

// Priority calculation
function calculatePriority(entry: UrlEntry, config: CrawlConfig): number {
  let priority = 100;

  // Prefer lower depth (closer to seed)
  priority -= entry.depth * 10;

  // Prefer sitemap URLs (usually important pages)
  if (entry.source === 'sitemap') priority += 20;

  // Prefer seed URLs
  if (entry.source === 'seed') priority += 50;

  // Boost URLs matching include patterns
  if (config.includePatterns?.some((p) => matchGlob(entry.url, p))) {
    priority += 30;
  }

  return Math.max(0, Math.min(200, priority));
}
```

### 3. Page Fetcher (Lambda with Headless Browser)

Fetches and extracts content from web pages.

```typescript
interface FetchResult {
  url: string;
  finalUrl: string; // After redirects
  httpStatus: number;
  contentType: string;
  contentLength: number;

  // Extracted content
  html: string; // Raw HTML
  text: string; // Extracted text
  title: string;
  description?: string;

  // Metadata
  links: DiscoveredLink[]; // Internal + external links
  canonicalUrl?: string;
  language?: string;
  publishedAt?: string;
  modifiedAt?: string;
  author?: string;

  // Performance
  fetchTimeMs: number;
  renderTimeMs?: number; // If JS rendering used

  // Errors
  error?: string;
}

interface DiscoveredLink {
  url: string;
  text: string; // Anchor text
  isInternal: boolean;
  rel?: string; // nofollow, etc.
}

// Lambda configuration for headless browser
const fetcherLambdaConfig = {
  memorySize: 3072, // 3GB for Playwright
  timeout: 300, // 5 minutes max
  ephemeralStorage: 1024, // 1GB for browser cache
  architecture: 'x86_64', // Required for Playwright
  containerImage: true, // Custom image with Playwright
};
```

### 4. Content Analyzer (Bedrock Pipeline)

AI-powered content analysis pipeline.

```typescript
interface ContentAnalysis {
  // Classification
  classification: {
    pageType: PageType;
    confidence: number;
    subtypes?: string[]; // e.g., ['tutorial', 'how-to'] for article
  };

  // Quality assessment
  quality: {
    overall: number; // 0-10
    originality: number; // Unique vs duplicate/scraped
    depth: number; // Substantive vs thin
    readability: number; // Well-written vs poor
    relevance: number; // On-topic vs off-topic
    flags: QualityFlag[];
  };

  // Extracted data (if applicable)
  extraction?: {
    modelUsed: 'product' | 'faq' | 'article' | 'policy' | 'custom';
    data: Record<string, unknown>;
    confidence: number;
  };

  // Summary
  summary?: {
    short: string; // 1-2 sentences
    long?: string; // Full summary (150 words)
    keywords: string[];
    entities: Entity[];
  };

  // Decision
  decision: {
    shouldIndex: boolean;
    reason: string;
    suggestedCollection?: string;
  };
}

type PageType =
  | 'article' // Blog posts, news, guides
  | 'product' // E-commerce product pages
  | 'faq' // FAQ pages, Q&A
  | 'policy' // Terms, privacy, legal
  | 'landing' // Marketing pages
  | 'navigation' // Index, category, listing pages
  | 'contact' // Contact info pages
  | 'other';

type QualityFlag =
  | 'thin_content' // < 200 words
  | 'duplicate_suspected' // High similarity to existing content
  | 'keyword_stuffing' // Unnatural keyword density
  | 'boilerplate_heavy' // Mostly navigation/footer content
  | 'auto_generated' // Machine-generated content
  | 'outdated' // References to past dates/events
  | 'broken_formatting'; // Extraction issues

interface Entity {
  text: string;
  type: 'person' | 'organization' | 'product' | 'location' | 'date' | 'price';
  normalized?: string;
}
```

---

## Guardrails & Safety

### 1. Crawler Etiquette

```typescript
interface CrawlerEtiquette {
  // Rate limiting per domain
  rateLimit: {
    requestsPerSecond: number; // Default: 1
    burstLimit: number; // Max burst requests
    backoffMultiplier: number; // Increase delay on errors
    maxDelay: number; // Cap on delay (ms)
  };

  // robots.txt compliance
  robotsTxt: {
    enabled: boolean; // Default: true
    cacheSeconds: number; // Cache robots.txt (default: 86400)
    respectCrawlDelay: boolean; // Honor Crawl-delay directive
    maxCrawlDelay: number; // Max honored delay (default: 10s)
  };

  // Request headers
  headers: {
    userAgent: string; // Identify as our crawler
    acceptLanguage: string;
    acceptEncoding: string;
  };

  // Polite behavior
  polite: {
    honorNoIndex: boolean; // Respect meta robots noindex
    honorNoFollow: boolean; // Respect rel=nofollow
    honorCanonical: boolean; // Follow canonical URLs
    avoidCrawlTraps: boolean; // Detect infinite URL patterns
  };
}

// Default user agent
const USER_AGENT =
  'KnowledgeBaseBot/1.0 (+https://example.com/bot; bot@example.com)';

// robots.txt parsing
interface RobotsTxtRules {
  domain: string;
  fetchedAt: string;
  ttl: number;
  rules: {
    userAgent: string;
    allow: string[];
    disallow: string[];
    crawlDelay?: number;
    sitemap?: string[];
  }[];
}
```

### 2. Domain & URL Restrictions

```typescript
interface DomainRestrictions {
  // Allowed domains (derived from seed URLs)
  allowedDomains: string[];

  // Global blocklist (always blocked)
  blockedDomains: string[]; // Known spam, malware domains

  // URL pattern restrictions
  blockedPatterns: RegExp[]; // e.g., /logout, /admin, /cart

  // Protocol restrictions
  allowedProtocols: string[]; // Only http, https

  // File type restrictions
  blockedExtensions: string[]; // .pdf, .zip, .exe, etc.
}

// Crawl trap detection
interface CrawlTrapDetector {
  // Calendar trap: /2024/01/01, /2024/01/02, ...
  detectCalendarPattern(urls: string[]): boolean;

  // Session trap: ?sid=xxx, ?session=xxx
  detectSessionParameters(url: string): boolean;

  // Pagination trap: /page/1, /page/2, ... /page/99999
  detectPaginationTrap(urls: string[]): boolean;

  // Query parameter explosion
  detectParameterExplosion(url: string): boolean;
}

// Default blocked patterns
const BLOCKED_URL_PATTERNS = [
  /\/logout/i,
  /\/signout/i,
  /\/login/i,
  /\/signin/i,
  /\/register/i,
  /\/signup/i,
  /\/cart/i,
  /\/checkout/i,
  /\/account/i,
  /\/admin/i,
  /\/wp-admin/i,
  /\/feed\/?$/i,
  /\/rss\/?$/i,
  /\?replytocom=/i,
  /\/trackback\/?$/i,
  /\/xmlrpc\.php/i,
  /\/wp-json/i,
  /calendar/i,
  /\?s=/i, // Search pages
  /\/search/i,
];
```

### 3. Resource Limits

```typescript
interface ResourceLimits {
  // Per-crawl limits
  perCrawl: {
    maxPages: number; // Default: 100, Max: 10000
    maxDepth: number; // Default: 3, Max: 10
    maxDuration: number; // Default: 1 hour, Max: 24 hours
    maxBytes: number; // Total download size (100MB default)
  };

  // Per-page limits
  perPage: {
    maxSize: number; // Max page size (10MB)
    maxRenderTime: number; // JS render timeout (30s)
    maxLinks: number; // Max links to extract (500)
    maxContentLength: number; // Max text to process (100KB)
  };

  // Per-tenant limits
  perTenant: {
    maxConcurrentCrawls: number; // Default: 3
    maxDailyPages: number; // Default: 1000
    maxStorageBytes: number; // Default: 1GB
  };

  // System limits
  system: {
    maxConcurrentFetches: number; // Global fetch concurrency
    maxQueuedUrls: number; // Max URLs in queue
  };
}
```

### 4. Content Safety

```typescript
interface ContentSafety {
  // Personal information detection
  pii: {
    enabled: boolean;
    action: 'flag' | 'redact' | 'skip';
    types: PIIType[];
  };

  // Sensitive content detection
  sensitive: {
    enabled: boolean;
    action: 'flag' | 'skip';
    categories: string[]; // violence, adult, etc.
  };

  // Copyright/licensing
  copyright: {
    detectCopyrightNotice: boolean;
    skipCopyrightedContent: boolean;
  };
}

type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'address' | 'name';
```

---

## Step Functions Workflow

### Main Crawl Workflow

```yaml
# State Machine Definition (simplified)
StartAt: InitializeCrawl

States:
  InitializeCrawl:
    Type: Task
    Resource: arn:aws:lambda:...:InitializeCrawlFunction
    Next: DiscoverUrls
    Catch:
      - ErrorEquals: [States.ALL]
        Next: HandleCrawlFailure
    # Actions:
    #   - Validate configuration
    #   - Fetch and cache robots.txt
    #   - Calculate rate limits
    #   - Create crawl job record

  DiscoverUrls:
    Type: Task
    Resource: arn:aws:lambda:...:DiscoverUrlsFunction
    Next: CheckUrlsDiscovered
    # Actions:
    #   - Parse sitemaps
    #   - Enqueue seed URLs
    #   - Initialize URL frontier

  CheckUrlsDiscovered:
    Type: Choice
    Choices:
      - Variable: $.stats.urlsQueued
        NumericGreaterThan: 0
        Next: ProcessUrls
    Default: FinalizeCrawl

  ProcessUrls:
    Type: Map
    ItemProcessor:
      ProcessorConfig:
        Mode: DISTRIBUTED
        ExecutionType: EXPRESS
      StartAt: FetchPage
      States:
        FetchPage:
          Type: Task
          Resource: arn:aws:lambda:...:FetchPageFunction
          Next: AnalyzeContent
          Retry:
            - ErrorEquals: [Lambda.TooManyRequestsException]
              IntervalSeconds: 5
              MaxAttempts: 3
              BackoffRate: 2
              JitterStrategy: FULL
          Catch:
            - ErrorEquals: [States.ALL]
              Next: RecordFetchFailure

        AnalyzeContent:
          Type: Task
          Resource: arn:aws:lambda:...:AnalyzeContentFunction
          Next: ProcessAnalysisResult
          Catch:
            - ErrorEquals: [States.ALL]
              Next: RecordAnalysisFailure

        ProcessAnalysisResult:
          Type: Choice
          Choices:
            - Variable: $.analysis.decision.shouldIndex
              BooleanEquals: true
              Next: IndexContent
          Default: SkipContent

        IndexContent:
          Type: Task
          Resource: arn:aws:lambda:...:IndexContentFunction
          Next: DiscoverLinks

        SkipContent:
          Type: Task
          Resource: arn:aws:lambda:...:RecordSkipFunction
          Next: DiscoverLinks

        DiscoverLinks:
          Type: Task
          Resource: arn:aws:lambda:...:DiscoverLinksFunction
          End: true

        RecordFetchFailure:
          Type: Task
          Resource: arn:aws:lambda:...:RecordFailureFunction
          End: true

        RecordAnalysisFailure:
          Type: Task
          Resource: arn:aws:lambda:...:RecordFailureFunction
          End: true

    MaxConcurrency: 10 # Per-domain concurrency
    ToleratedFailurePercentage: 20
    ItemsPath: $.urls
    ResultPath: $.processingResults
    Next: CheckMoreUrls

  CheckMoreUrls:
    Type: Task
    Resource: arn:aws:lambda:...:CheckMoreUrlsFunction
    Next: MoreUrlsChoice

  MoreUrlsChoice:
    Type: Choice
    Choices:
      - Variable: $.hasMoreUrls
        BooleanEquals: true
        Next: WaitBetweenBatches
      - Variable: $.stats.urlsProcessed
        NumericGreaterThanEqualsPath: $.config.maxPages
        Next: FinalizeCrawl
    Default: FinalizeCrawl

  WaitBetweenBatches:
    Type: Wait
    Seconds: 5 # Rate limit pause
    Next: ProcessUrls

  FinalizeCrawl:
    Type: Task
    Resource: arn:aws:lambda:...:FinalizeCrawlFunction
    Next: CrawlComplete
    # Actions:
    #   - Update crawl job status
    #   - Calculate final stats
    #   - Trigger embedding generation
    #   - Send completion notification

  CrawlComplete:
    Type: Succeed

  HandleCrawlFailure:
    Type: Task
    Resource: arn:aws:lambda:...:HandleCrawlFailureFunction
    Next: CrawlFailed

  CrawlFailed:
    Type: Fail
    Error: CrawlFailed
    Cause: See error details in crawl job record
```

---

## Content Analysis Pipeline

### Classification Stage (Nova Micro)

```typescript
const classificationPrompt = `
Classify this web page into ONE of these categories:

- article: News, blog posts, tutorials, guides, how-to content
- product: E-commerce product pages with pricing, specs, buy buttons
- faq: FAQ pages, help articles, Q&A content
- policy: Terms of service, privacy policy, legal documents
- landing: Marketing pages, homepages, promotional content
- navigation: Category pages, sitemaps, index pages, search results
- contact: Contact information, about us pages
- other: None of the above

Return ONLY valid JSON:
{"category": "...", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Page URL: {url}
Page Title: {title}

Content (first 2000 chars):
{content}
`;

// Cost: ~$0.000035 per page (Nova Micro)
```

### Quality Assessment Stage (Claude Haiku)

```typescript
const qualityPrompt = `
Evaluate this web page content for quality. Score each dimension 0-10.

Dimensions:
1. Originality: Is this unique content or copied/scraped from elsewhere?
2. Depth: Does it provide substantive, detailed information?
3. Readability: Is it well-written, clear, and properly formatted?
4. Relevance: Is it focused on a clear topic (not a mix of unrelated content)?

Also identify any quality flags:
- thin_content: Less than 200 words of meaningful content
- duplicate_suspected: Appears to be copied from another source
- keyword_stuffing: Unnatural repetition of keywords
- boilerplate_heavy: Mostly navigation, menus, or footer content
- auto_generated: Appears machine-generated or template-based
- broken_formatting: Significant extraction or formatting issues

Return ONLY valid JSON:
{
  "scores": {
    "originality": N,
    "depth": N,
    "readability": N,
    "relevance": N
  },
  "overall": N,
  "flags": ["flag1", "flag2"],
  "summary": "Brief quality assessment"
}

Content:
{content}
`;

// Cost: ~$0.001 per page (Claude Haiku)
```

### Structured Extraction Stage (Claude Sonnet)

Only run for pages classified as product, faq, or policy:

```typescript
const productExtractionPrompt = `
Extract structured product information from this page.

Return ONLY valid JSON matching this schema:
{
  "name": "string",
  "description": "string (max 500 chars)",
  "price": {"amount": number, "currency": "USD"},
  "salePrice": {"amount": number, "currency": "USD"} | null,
  "sku": "string" | null,
  "brand": "string" | null,
  "category": "string" | null,
  "inStock": boolean,
  "specifications": [{"key": "string", "value": "string"}],
  "images": ["url"],
  "confidence": 0.0-1.0
}

Rules:
- Use null for missing fields
- Normalize currency to ISO 4217 codes
- Extract only information present in the content
- Do not invent or assume information

Page Content:
{content}
`;

// Cost: ~$0.003 per page (Claude 3.5 Sonnet) - only for relevant pages
```

### Embedding Generation (Titan Embed v2)

```typescript
const generateEmbeddings = async (chunks: string[]): Promise<number[][]> => {
  const batchSize = 25; // Bedrock limit
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const responses = await Promise.all(
      batch.map((text) =>
        bedrock.invokeModel({
          modelId: 'amazon.titan-embed-text-v2:0',
          body: JSON.stringify({
            inputText: text,
            dimensions: 512, // Balance quality vs storage
            normalize: true,
          }),
        })
      )
    );

    embeddings.push(...responses.map((r) => JSON.parse(r.body).embedding));
  }

  return embeddings;
};

// Cost: ~$0.00002 per 1K tokens
```

---

## Data Model

### DynamoDB Tables

```typescript
// Crawl Jobs Table
// PK: TENANT#{tenantId}
// SK: CRAWLJOB#{jobId}
interface CrawlJobItem {
  pk: string;
  sk: string;
  gsi1pk: string; // STATUS#{status}
  gsi1sk: string; // CREATED#{timestamp}

  jobId: string;
  tenantId: string;
  collectionId: string;
  status: CrawlJobStatus;
  config: CrawlConfig;
  stats: CrawlStats;
  sfnExecutionArn?: string;

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;

  ttl?: number; // Auto-cleanup old jobs
}

// URL State Table (separate table for high throughput)
// PK: CRAWLJOB#{jobId}
// SK: URL#{urlHash}
interface UrlStateItem {
  pk: string;
  sk: string;
  gsi1pk: string; // CRAWLJOB#{jobId}#STATUS#{status}
  gsi1sk: string; // PRIORITY#{priority}

  urlHash: string;
  url: string;
  crawlJobId: string;
  tenantId: string;

  source: 'seed' | 'sitemap' | 'link';
  parentUrl?: string;
  depth: number;

  status: UrlStatus;
  priority: number;
  attempts: number;

  httpStatus?: number;
  contentType?: string;
  documentId?: string;
  error?: string;

  discoveredAt: string;
  processedAt?: string;

  ttl: number; // Cleanup after job completion + buffer
}

// Robots.txt Cache Table
// PK: DOMAIN#{domain}
interface RobotsTxtItem {
  pk: string;
  domain: string;
  rules: RobotsTxtRules;
  fetchedAt: string;
  ttl: number; // 24 hour cache
}

// Rate Limit State Table
// PK: DOMAIN#{domain}
// SK: WINDOW#{windowStart}
interface RateLimitItem {
  pk: string;
  sk: string;
  domain: string;
  windowStart: number;
  requestCount: number;
  ttl: number; // Auto-expire old windows
}
```

### S3 Storage

```
s3://knowledge-base-{stage}-crawler/
├── crawls/
│   └── {tenantId}/
│       └── {jobId}/
│           ├── raw/
│           │   └── {urlHash}.html      # Raw HTML
│           ├── extracted/
│           │   └── {urlHash}.json      # Extracted content + analysis
│           └── screenshots/
│               └── {urlHash}.png       # Page screenshots (optional)
├── robots/
│   └── {domain}.txt                    # Cached robots.txt files
└── sitemaps/
    └── {domain}/
        └── {hash}.xml                  # Cached sitemaps
```

---

## API Contract

### Crawl Management Endpoints

```typescript
// packages/contract-internal-api/src/crawler.ts

// Start a new crawl
export const startCrawl = oc
  .route({ method: 'POST', path: '/crawler/crawls' })
  .input(
    z.object({
      collectionId: z.string(),
      seedUrls: z.array(z.string().url()).min(1).max(10),
      sitemapUrls: z.array(z.string().url()).max(5).optional(),
      config: z
        .object({
          maxDepth: z.number().min(1).max(10).default(3),
          maxPages: z.number().min(1).max(10000).default(100),
          includePatterns: z.array(z.string()).optional(),
          excludePatterns: z.array(z.string()).optional(),
          respectRobotsTxt: z.boolean().default(true),
          renderJavaScript: z.boolean().default(true),
          requestsPerSecond: z.number().min(0.1).max(5).default(1),
          enableClassification: z.boolean().default(true),
          enableQualityCheck: z.boolean().default(true),
          qualityThreshold: z.number().min(0).max(10).default(5),
          targetContentTypes: z
            .array(
              z.enum([
                'article',
                'product',
                'faq',
                'policy',
                'landing',
                'contact',
              ])
            )
            .optional(),
        })
        .optional(),
    })
  )
  .output(CrawlJobSchema);

// Get crawl status
export const getCrawl = oc
  .route({ method: 'GET', path: '/crawler/crawls/{jobId}' })
  .input(z.object({ jobId: z.string() }))
  .output(CrawlJobSchema);

// List crawls
export const listCrawls = oc
  .route({ method: 'GET', path: '/crawler/crawls' })
  .input(
    z.object({
      collectionId: z.string().optional(),
      status: z
        .enum(['pending', 'processing', 'completed', 'failed'])
        .optional(),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    })
  )
  .output(
    z.object({
      crawls: z.array(CrawlJobSchema),
      nextCursor: z.string().optional(),
    })
  );

// Cancel crawl
export const cancelCrawl = oc
  .route({ method: 'POST', path: '/crawler/crawls/{jobId}/cancel' })
  .input(z.object({ jobId: z.string() }))
  .output(CrawlJobSchema);

// Get crawled URLs
export const getCrawlUrls = oc
  .route({ method: 'GET', path: '/crawler/crawls/{jobId}/urls' })
  .input(
    z.object({
      jobId: z.string(),
      status: z.enum(['pending', 'completed', 'failed', 'skipped']).optional(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    })
  )
  .output(
    z.object({
      urls: z.array(UrlEntrySchema),
      nextCursor: z.string().optional(),
    })
  );

// Preview URL (fetch and analyze without indexing)
export const previewUrl = oc
  .route({ method: 'POST', path: '/crawler/preview' })
  .input(
    z.object({
      url: z.string().url(),
      renderJavaScript: z.boolean().default(true),
    })
  )
  .output(
    z.object({
      url: z.string(),
      title: z.string(),
      contentPreview: z.string(),
      classification: ClassificationSchema,
      quality: QualitySchema,
      links: z.array(
        z.object({
          url: z.string(),
          text: z.string(),
          isInternal: z.boolean(),
        })
      ),
    })
  );
```

---

## Infrastructure

### Service Structure

```
services/knowledge-base/
├── functions/
│   └── src/
│       ├── crawler/
│       │   ├── api/
│       │   │   ├── start-crawl.ts
│       │   │   ├── get-crawl.ts
│       │   │   ├── list-crawls.ts
│       │   │   ├── cancel-crawl.ts
│       │   │   └── preview-url.ts
│       │   │
│       │   ├── workflow/
│       │   │   ├── initialize-crawl.ts
│       │   │   ├── discover-urls.ts
│       │   │   ├── fetch-page.ts
│       │   │   ├── analyze-content.ts
│       │   │   ├── index-content.ts
│       │   │   ├── discover-links.ts
│       │   │   ├── check-more-urls.ts
│       │   │   └── finalize-crawl.ts
│       │   │
│       │   └── lib/
│       │       ├── fetcher/
│       │       │   ├── playwright-fetcher.ts
│       │       │   └── cheerio-fetcher.ts
│       │       ├── analyzer/
│       │       │   ├── classifier.ts
│       │       │   ├── quality-checker.ts
│       │       │   ├── extractor.ts
│       │       │   └── summarizer.ts
│       │       ├── frontier/
│       │       │   ├── url-frontier.ts
│       │       │   └── deduplicator.ts
│       │       ├── robots/
│       │       │   ├── parser.ts
│       │       │   └── cache.ts
│       │       └── rate-limiter/
│       │           └── domain-rate-limiter.ts
│       │
│       └── ... (existing code)
│
├── infra/
│   ├── Main.ts
│   ├── Crawler.ts                  # Crawler infrastructure
│   │   ├── Step Functions state machine
│   │   ├── Lambda functions
│   │   ├── DynamoDB tables
│   │   └── S3 buckets
│   └── ... (existing infra)
│
└── crawler-image/                  # Docker image for Playwright Lambda
    ├── Dockerfile
    ├── package.json
    └── src/
        └── handler.ts
```

### Lambda Container Image (Playwright)

```dockerfile
# crawler-image/Dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Install Playwright dependencies
RUN dnf install -y \
    nss \
    nspr \
    atk \
    cups-libs \
    dbus-glib \
    libdrm \
    libXcomposite \
    libXdamage \
    libXrandr \
    mesa-libgbm \
    pango \
    alsa-lib \
    && dnf clean all

# Install Playwright
WORKDIR /var/task
COPY package*.json ./
RUN npm ci --production

# Install Chromium
RUN npx playwright install chromium

# Copy function code
COPY dist/ ./

CMD ["handler.handler"]
```

---

## Cost Estimation

### Per-Page Processing Cost

| Stage                     | Model         | Tokens (avg) | Cost per Page          |
| ------------------------- | ------------- | ------------ | ---------------------- |
| Classification            | Nova Micro    | ~500         | $0.000018              |
| Quality Check             | Claude Haiku  | ~1000        | $0.001                 |
| Extraction (50% of pages) | Claude Sonnet | ~2000        | $0.003 × 0.5 = $0.0015 |
| Embedding (3 chunks avg)  | Titan v2      | ~1500        | $0.00003               |
| **Total AI Cost**         |               |              | **~$0.0025/page**      |

### Infrastructure Cost (per 1000 pages)

| Component       | Usage                    | Cost                  |
| --------------- | ------------------------ | --------------------- |
| Lambda (fetch)  | 1000 × 3GB × 60s         | ~$3.00                |
| Lambda (other)  | 5000 invocations         | ~$0.50                |
| Step Functions  | 1000 state transitions   | ~$0.25                |
| DynamoDB        | 10K reads, 5K writes     | ~$0.02                |
| S3              | 500MB storage + requests | ~$0.05                |
| **Total Infra** |                          | **~$3.82/1000 pages** |

### Total Cost per 1000 Pages: ~$6.32

---

## Security Considerations

### 1. SSRF Prevention

```typescript
// Validate URLs before fetching
function validateUrl(url: string, config: CrawlConfig): boolean {
  const parsed = new URL(url);

  // Only allow HTTP(S)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false;
  }

  // Block internal IPs
  const hostname = parsed.hostname;
  if (isPrivateIP(hostname) || isLoopback(hostname)) {
    return false;
  }

  // Block AWS metadata endpoint
  if (hostname === '169.254.169.254') {
    return false;
  }

  // Verify domain is in allowed list
  if (!config.allowedDomains.includes(parsed.hostname)) {
    return false;
  }

  return true;
}
```

### 2. Content Security

- Sandboxed Lambda execution (no network access to VPC resources)
- S3 bucket with block public access
- Encrypted storage (S3 SSE, DynamoDB encryption at rest)
- VPC endpoints for AWS services (no internet egress from Lambda for AWS calls)

### 3. Tenant Isolation

- All data keyed by tenantId
- IAM policies scoped to tenant resources
- Rate limits enforced per tenant

---

## Future Enhancements

### Phase 2

- [ ] Incremental re-crawl (detect content changes)
- [ ] Webhook notifications on crawl completion
- [ ] Custom extraction schemas per tenant
- [ ] Screenshot capture for visual content
- [ ] PDF/document link following

### Phase 3

- [ ] Real-time crawl monitoring dashboard
- [ ] A/B testing for quality thresholds
- [ ] Machine learning for crawl prioritization
- [ ] Multi-region crawling for global sites
- [ ] API authentication for protected content

---

## References

- [Knowledge Base Service Architecture](./knowledge-base-service-architecture.md)
- [AWS Step Functions Distributed Map](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-distribute-map.html)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Playwright on AWS Lambda](https://playwright.dev/docs/docker)
- [robots.txt Specification](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)
