# Workspaces Service Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-10

## Context & Problem Statement

### Business Need

Tenants operate multiple communication channels across different platforms (Facebook Pages, Instagram accounts, WhatsApp numbers, Zalo OAs). These channels often need to be grouped and managed together based on business units, brands, or regions.

**Example Scenario:**

A retail company has:

- Facebook Page A (Brand X)
- Instagram A (Brand X)
- Facebook Page B (Brand Y)
- WhatsApp B (Brand Y)

They want to:

- Group Facebook Page A + Instagram A together as "Brand X"
- Apply the same AI agent behavior, branding, and guidelines to both
- Use the same knowledge base (products, FAQs) for both channels
- View unified analytics and insights for Brand X
- Separately manage Brand Y with different configurations

**Current Challenges:**

- **No logical grouping**: Channels exist as flat list under tenant
- **Configuration duplication**: Same agent/knowledge settings repeated per channel
- **Fragmented insights**: Analytics scattered across individual channels
- **Inconsistent experience**: Hard to maintain brand consistency across channels
- **Manual coordination**: Updating one channel doesn't update related channels

### Solution

Build a **Workspaces Service** that:

1. **Groups channels** into logical workspaces (by brand, region, business unit)
2. **Centralizes configuration** for AI agents, knowledge bases, and branding
3. **Enforces consistency** across all channels in a workspace
4. **Aggregates insights** and analytics at the workspace level
5. **Enables inheritance** of settings from workspace to channel (with overrides)

### Relationship to Other Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACES SERVICE                                │
│                                                                             │
│  Workspace: "Brand X"                                                       │
│  ├── Channels: [Facebook A, Instagram A]                                    │
│  ├── AI Config: Agent + Triggers + Knowledge Collections                    │
│  ├── Brand Profile: Name, Tone, Guidelines                                  │
│  └── Insights: Aggregated metrics                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         │ owns               │ configures         │ uses               │ queries
         ▼                    ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Conversations   │  │ AI Agents       │  │ Knowledge Base  │  │ Analytics       │
│ Service         │  │ Service         │  │ Service         │  │ (Future)        │
│                 │  │                 │  │                 │  │                 │
│ • Channels      │  │ • Agents        │  │ • Collections   │  │ • Metrics       │
│ • Conversations │  │ • Triggers      │  │ • Documents     │  │ • Reports       │
│ • Messages      │  │ • Sessions      │  │ • Records       │  │ • Dashboards    │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACES SERVICE                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Workspace Management                          │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                        WORKSPACE                                │  │  │
│  │  │                                                                 │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │  │  │
│  │  │  │ Brand       │  │ AI          │  │ Knowledge               │ │  │  │
│  │  │  │ Profile     │  │ Config      │  │ Config                  │ │  │  │
│  │  │  │             │  │             │  │                         │ │  │  │
│  │  │  │ • Name      │  │ • Agent ID  │  │ • Collection IDs        │ │  │  │
│  │  │  │ • Tone      │  │ • Triggers  │  │ • Search settings       │ │  │  │
│  │  │  │ • Guidelines│  │ • Model     │  │ • Auto-context          │ │  │  │
│  │  │  │ • Persona   │  │ • Tools     │  │                         │ │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │  │  │
│  │  │                                                                 │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │                    CHANNELS                              │   │  │  │
│  │  │  │                                                          │   │  │  │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │  │  │
│  │  │  │  │ Facebook │  │ Instagram│  │ WhatsApp │  │ Zalo     │ │   │  │  │
│  │  │  │  │ Page A   │  │ A        │  │ (opt.)   │  │ (opt.)   │ │   │  │  │
│  │  │  │  │          │  │          │  │          │  │          │ │   │  │  │
│  │  │  │  │ Override:│  │ Override:│  │ Override:│  │ Override:│ │   │  │  │
│  │  │  │  │ (none)   │  │ (none)   │  │ tone     │  │ language │ │   │  │  │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Data Layer                                    │  │
│  │                                                                       │  │
│  │  DynamoDB                                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ • Workspaces         - Workspace definitions                     │ │  │
│  │  │ • WorkspaceChannels  - Channel-to-workspace mappings             │ │  │
│  │  │ • BrandProfiles      - Branding configuration                    │ │  │
│  │  │ • AIConfigs          - AI agent configuration per workspace      │ │  │
│  │  │ • KnowledgeConfigs   - Knowledge base bindings                   │ │  │
│  │  │ • ChannelOverrides   - Channel-specific overrides                │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Internal API (ORPC + IAM Auth)                     │  │
│  │                                                                       │  │
│  │  Workspaces:                       Channels:                          │  │
│  │  • workspaces.create               • workspaces.addChannel            │  │
│  │  • workspaces.get                  • workspaces.removeChannel         │  │
│  │  • workspaces.update               • workspaces.listChannels          │  │
│  │  • workspaces.delete               • workspaces.setChannelOverride    │  │
│  │  • workspaces.list                                                    │  │
│  │                                                                       │  │
│  │  Brand Profile:                    AI Config:                         │  │
│  │  • brandProfiles.get               • aiConfigs.get                    │  │
│  │  • brandProfiles.update            • aiConfigs.update                 │  │
│  │                                    • aiConfigs.getEffective           │  │
│  │  Knowledge Config:                                                    │  │
│  │  • knowledgeConfigs.get            Resolution:                        │  │
│  │  • knowledgeConfigs.update         • resolve.forChannel               │  │
│  │                                    • resolve.forConversation          │  │
│  │  Insights:                                                            │  │
│  │  • insights.getWorkspaceMetrics                                       │  │
│  │  • insights.getChannelComparison                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                              ▲
                    │ Events                       │ Internal API Calls
                    ▼                              │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI AGENTS SERVICE                              │
│                                                                             │
│  When processing a conversation:                                            │
│  1. Get channel's workspace via workspaces.resolve.forChannel               │
│  2. Load effective AI config (workspace + channel overrides)                │
│  3. Load brand profile for persona/tone                                     │
│  4. Load knowledge collections for RAG                                      │
│  5. Execute agent with complete context                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Workspace

A **Workspace** is a logical grouping of channels that share configuration, branding, and analytics.

| Field          | Description                                          |
| -------------- | ---------------------------------------------------- |
| `tenantId`     | Owning tenant                                        |
| `workspaceId`  | Unique identifier (ULID)                             |
| `name`         | Human-readable name (e.g., "Brand X", "APAC Region") |
| `description`  | Purpose of this workspace                            |
| `type`         | `brand` \| `region` \| `department` \| `custom`      |
| `channelCount` | Number of channels in workspace                      |
| `isDefault`    | If true, new channels auto-join this workspace       |
| `status`       | `active` \| `archived`                               |
| `createdAt`    | Creation timestamp                                   |
| `updatedAt`    | Last update timestamp                                |

**Workspace Types:**

| Type         | Description                          | Example Use Case   |
| ------------ | ------------------------------------ | ------------------ |
| `brand`      | Group channels by brand/product line | "Nike", "Jordan"   |
| `region`     | Group channels by geographic region  | "APAC", "Europe"   |
| `department` | Group channels by business function  | "Sales", "Support" |
| `custom`     | Tenant-defined grouping              | "VIP Customers"    |

### Brand Profile

A **Brand Profile** defines the brand identity and communication guidelines for a workspace.

| Field                | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `workspaceId`        | Parent workspace                                      |
| `brandName`          | Brand name for customer-facing messages               |
| `tagline`            | Brand tagline (optional)                              |
| `persona`            | AI persona description (friendly, professional, etc.) |
| `toneOfVoice`        | Communication tone guidelines                         |
| `language`           | Primary language (`en`, `vi`, `zh`, etc.)             |
| `supportedLanguages` | List of supported languages                           |
| `responseGuidelines` | Do's and don'ts for AI responses                      |
| `signatureTemplate`  | Message signature template                            |
| `businessHours`      | Operating hours for human handoff                     |
| `escalationMessage`  | Message when escalating to human                      |
| `customFields`       | Additional brand-specific fields                      |

**Example Brand Profile:**

```json
{
  "workspaceId": "ws-brand-x",
  "brandName": "TechGadgets",
  "tagline": "Innovation at your fingertips",
  "persona": "A friendly and knowledgeable tech advisor who is enthusiastic about helping customers find the perfect gadget",
  "toneOfVoice": {
    "style": "conversational",
    "formality": "casual-professional",
    "enthusiasm": "high",
    "empathy": "high"
  },
  "language": "en",
  "supportedLanguages": ["en", "es", "fr"],
  "responseGuidelines": {
    "dos": [
      "Use the customer's name when available",
      "Provide specific product recommendations",
      "Offer alternatives when items are out of stock",
      "Thank customers for their patience"
    ],
    "donts": [
      "Never make promises about delivery times without checking",
      "Avoid technical jargon unless the customer uses it first",
      "Don't discuss competitor products negatively",
      "Never share internal pricing or discount information"
    ]
  },
  "signatureTemplate": "Thanks for chatting with TechGadgets! - Your Tech Team",
  "businessHours": {
    "timezone": "America/New_York",
    "schedule": {
      "monday": { "start": "09:00", "end": "18:00" },
      "tuesday": { "start": "09:00", "end": "18:00" },
      "wednesday": { "start": "09:00", "end": "18:00" },
      "thursday": { "start": "09:00", "end": "18:00" },
      "friday": { "start": "09:00", "end": "17:00" },
      "saturday": null,
      "sunday": null
    }
  },
  "escalationMessage": "I'm connecting you with a TechGadgets specialist who can better assist you. Please hold for a moment."
}
```

### AI Config

An **AI Config** defines the AI agent behavior for a workspace.

| Field                  | Description                                |
| ---------------------- | ------------------------------------------ |
| `workspaceId`          | Parent workspace                           |
| `agentId`              | Primary agent for this workspace           |
| `fallbackAgentId`      | Agent to use if primary fails              |
| `triggers`             | Trigger configurations for this workspace  |
| `modelOverrides`       | Model/temperature overrides (optional)     |
| `toolPermissions`      | Which tools are enabled/disabled           |
| `maxTurnsPerSession`   | Override for max conversation turns        |
| `handoffBehavior`      | `escalate` \| `end` \| `queue`             |
| `autoResponseEnabled`  | Whether AI auto-responds to new messages   |
| `autoResponseDelay`    | Delay before AI responds (ms)              |
| `humanTakeoverEnabled` | Allow humans to take over AI conversations |
| `sentimentEscalation`  | Auto-escalate on negative sentiment        |

**Example AI Config:**

```json
{
  "workspaceId": "ws-brand-x",
  "agentId": "agent-support-v2",
  "fallbackAgentId": "agent-basic-faq",
  "triggers": [
    {
      "eventType": "message.new",
      "conditions": {
        "all": [
          {
            "field": "message.direction",
            "operator": "eq",
            "value": "inbound"
          },
          { "field": "conversation.status", "operator": "eq", "value": "open" }
        ]
      },
      "priority": 100
    }
  ],
  "modelOverrides": {
    "model": "anthropic.claude-3-sonnet",
    "temperature": 0.7,
    "maxTokens": 1024
  },
  "toolPermissions": {
    "send_message": true,
    "search_products": true,
    "lookup_order": true,
    "process_refund": false,
    "handoff_to_human": true
  },
  "maxTurnsPerSession": 15,
  "handoffBehavior": "escalate",
  "autoResponseEnabled": true,
  "autoResponseDelay": 2000,
  "humanTakeoverEnabled": true,
  "sentimentEscalation": {
    "enabled": true,
    "threshold": -0.5,
    "escalateAfterTurns": 3
  }
}
```

### Knowledge Config

A **Knowledge Config** binds knowledge collections to a workspace.

| Field                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `workspaceId`           | Parent workspace                                  |
| `collectionBindings`    | List of knowledge collection bindings             |
| `searchSettings`        | Default search parameters                         |
| `autoContextEnabled`    | Auto-inject relevant knowledge into agent context |
| `autoContextMaxResults` | Max knowledge results to inject                   |
| `autoContextThreshold`  | Min relevance score for auto-context              |

**Collection Binding:**

```typescript
interface CollectionBinding {
  collectionId: string; // Knowledge collection ID
  collectionType: 'unstructured' | 'structured';
  purpose: string; // Description for AI context
  priority: number; // Search priority (higher = searched first)
  enabled: boolean; // Whether to include in searches
  toolName?: string; // Custom tool name for structured collections
}
```

**Example Knowledge Config:**

```json
{
  "workspaceId": "ws-brand-x",
  "collectionBindings": [
    {
      "collectionId": "col-products-brand-x",
      "collectionType": "structured",
      "purpose": "Product catalog for TechGadgets brand",
      "priority": 100,
      "enabled": true,
      "toolName": "search_products"
    },
    {
      "collectionId": "col-faqs-brand-x",
      "collectionType": "structured",
      "purpose": "Frequently asked questions about TechGadgets",
      "priority": 90,
      "enabled": true,
      "toolName": "search_faqs"
    },
    {
      "collectionId": "col-policies",
      "collectionType": "unstructured",
      "purpose": "Return, shipping, and warranty policies",
      "priority": 80,
      "enabled": true
    },
    {
      "collectionId": "col-help-articles",
      "collectionType": "unstructured",
      "purpose": "Product setup guides and troubleshooting",
      "priority": 70,
      "enabled": true
    }
  ],
  "searchSettings": {
    "defaultLimit": 5,
    "hybridWeights": {
      "vector": 0.7,
      "keyword": 0.3
    },
    "minScore": 0.6
  },
  "autoContextEnabled": true,
  "autoContextMaxResults": 3,
  "autoContextThreshold": 0.75
}
```

### Channel Override

A **Channel Override** allows customizing workspace settings for a specific channel.

| Field                | Description                             |
| -------------------- | --------------------------------------- |
| `workspaceId`        | Parent workspace                        |
| `channelId`          | Channel being customized                |
| `brandOverrides`     | Partial brand profile overrides         |
| `aiOverrides`        | Partial AI config overrides             |
| `knowledgeOverrides` | Additional/different knowledge bindings |
| `enabled`            | Whether overrides are active            |

**Example Channel Override:**

```json
{
  "workspaceId": "ws-brand-x",
  "channelId": "ch-whatsapp-latam",
  "brandOverrides": {
    "language": "es",
    "signatureTemplate": "Gracias por contactar TechGadgets! - Tu equipo de Tech",
    "escalationMessage": "Te estoy conectando con un especialista..."
  },
  "aiOverrides": {
    "modelOverrides": {
      "model": "anthropic.claude-3-haiku"
    },
    "autoResponseDelay": 1000
  },
  "knowledgeOverrides": {
    "additionalBindings": [
      {
        "collectionId": "col-faqs-spanish",
        "collectionType": "structured",
        "purpose": "Spanish FAQs for LATAM market",
        "priority": 95,
        "enabled": true
      }
    ]
  },
  "enabled": true
}
```

### Workspace Membership

Tracks which channels belong to which workspace.

| Field         | Description                          |
| ------------- | ------------------------------------ |
| `tenantId`    | Owning tenant                        |
| `workspaceId` | Workspace                            |
| `channelId`   | Channel (from Conversations Service) |
| `addedAt`     | When channel was added to workspace  |
| `addedBy`     | User who added the channel           |

**Constraints:**

- A channel can only belong to **one workspace** at a time
- A channel can be moved between workspaces
- A channel without a workspace uses tenant-level defaults

---

## Configuration Resolution

When the AI Agents Service processes a conversation, it needs the effective configuration for that channel. The Workspaces Service provides a resolution API that merges configurations.

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Configuration Resolution                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. Input: channelId
         │
         ▼
2. Look up workspace for channel
         │
         ├─► Channel has workspace → Continue to step 3
         │
         └─► No workspace → Return tenant defaults (or error)
         │
         ▼
3. Load workspace configurations:
   ├─► Brand Profile (workspace level)
   ├─► AI Config (workspace level)
   └─► Knowledge Config (workspace level)
         │
         ▼
4. Check for channel overrides
         │
         ├─► Overrides exist → Merge with workspace config
         │
         └─► No overrides → Use workspace config as-is
         │
         ▼
5. Return effective configuration:
   {
     workspace: { ... },
     brandProfile: { ... },      // Merged
     aiConfig: { ... },          // Merged
     knowledgeConfig: { ... },   // Merged
     channelId: "...",
     resolvedAt: "..."
   }
```

### Resolution API

```typescript
// Resolve configuration for a specific channel
const config = await workspacesClient.resolve.forChannel({
  channelId: 'ch-facebook-page-a',
});

// Response
{
  workspace: {
    workspaceId: 'ws-brand-x',
    name: 'Brand X',
    type: 'brand',
  },
  brandProfile: {
    brandName: 'TechGadgets',
    persona: '...',
    toneOfVoice: { ... },
    language: 'en',            // May be overridden at channel level
    responseGuidelines: { ... },
    // ... merged with channel overrides
  },
  aiConfig: {
    agentId: 'agent-support-v2',
    triggers: [ ... ],
    modelOverrides: { ... },   // May be overridden at channel level
    toolPermissions: { ... },
    // ... merged with channel overrides
  },
  knowledgeConfig: {
    collectionBindings: [ ... ], // Combined workspace + channel bindings
    searchSettings: { ... },
    autoContextEnabled: true,
  },
  channelId: 'ch-facebook-page-a',
  resolvedAt: '2026-01-10T10:30:00Z',
}

// Resolve for a conversation (includes conversation context)
const config = await workspacesClient.resolve.forConversation({
  conversationId: 'conv-12345',
});
// Adds: conversation metadata, participant info, message history summary
```

### Merge Strategy

| Config Type        | Merge Behavior                                       |
| ------------------ | ---------------------------------------------------- |
| Brand Profile      | Channel overrides replace workspace values (shallow) |
| AI Config          | Channel overrides replace workspace values (shallow) |
| Model Overrides    | Deep merge (channel values take precedence)          |
| Tool Permissions   | Deep merge (channel can only restrict, not expand)   |
| Knowledge Bindings | Concat (channel adds to workspace bindings)          |
| Search Settings    | Channel overrides replace workspace values           |

---

## System Prompt Generation

The Workspaces Service can generate a complete system prompt for an agent based on workspace configuration.

### System Prompt Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           System Prompt Structure                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. BASE AGENT INSTRUCTIONS (from AI Agents Service)                        │
│     "You are a customer support agent..."                                   │
│                                                                             │
│  2. BRAND CONTEXT (from Workspaces Service)                                 │
│     "You represent {brandName}. {tagline}"                                  │
│     "Your persona: {persona}"                                               │
│                                                                             │
│  3. TONE & STYLE GUIDELINES                                                 │
│     "Communication style: {toneOfVoice.style}"                              │
│     "Formality level: {toneOfVoice.formality}"                              │
│                                                                             │
│  4. RESPONSE GUIDELINES                                                     │
│     "DO: {responseGuidelines.dos}"                                          │
│     "DON'T: {responseGuidelines.donts}"                                     │
│                                                                             │
│  5. KNOWLEDGE CONTEXT                                                       │
│     "You have access to the following knowledge sources:"                   │
│     "- {collectionBindings[0].purpose}"                                     │
│     "- {collectionBindings[1].purpose}"                                     │
│                                                                             │
│  6. CHANNEL-SPECIFIC CONTEXT                                                │
│     "Current channel: {channelPlatform}"                                    │
│     "Language preference: {language}"                                       │
│                                                                             │
│  7. BUSINESS CONTEXT                                                        │
│     "Business hours: {businessHours}"                                       │
│     "Current time: {currentTime} ({timezone})"                              │
│     "Within business hours: {isBusinessHours}"                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Generated System Prompt Example

```markdown
# Agent Instructions

You are a customer support agent for TechGadgets.

## Brand Identity

You represent **TechGadgets** - "Innovation at your fingertips"

Your persona: A friendly and knowledgeable tech advisor who is enthusiastic about helping customers find the perfect gadget.

## Communication Guidelines

**Style:** Conversational, casual-professional
**Enthusiasm:** High - be excited to help!
**Empathy:** High - acknowledge customer feelings

### Do's:

- Use the customer's name when available
- Provide specific product recommendations
- Offer alternatives when items are out of stock
- Thank customers for their patience

### Don'ts:

- Never make promises about delivery times without checking
- Avoid technical jargon unless the customer uses it first
- Don't discuss competitor products negatively
- Never share internal pricing or discount information

## Available Knowledge

You have access to:

- **Product Catalog**: TechGadgets product information, specs, and pricing
- **FAQs**: Common questions about orders, shipping, and returns
- **Policies**: Return, shipping, and warranty policies
- **Help Articles**: Product setup guides and troubleshooting

Use the appropriate search tools to find accurate information before responding.

## Current Context

- **Channel**: Facebook Messenger
- **Language**: English
- **Business Hours**: Mon-Fri 9AM-6PM EST (currently within hours)

## Escalation

If you cannot help the customer or they request a human:
"I'm connecting you with a TechGadgets specialist who can better assist you. Please hold for a moment."
```

---

## Insights & Analytics

Workspaces enable aggregated analytics across grouped channels.

### Workspace Metrics

| Metric                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `totalConversations`    | Total conversations across all workspace channels |
| `activeConversations`   | Currently open conversations                      |
| `avgResponseTime`       | Average time to first response                    |
| `avgResolutionTime`     | Average time to resolve/close conversation        |
| `automationRate`        | % of conversations fully handled by AI            |
| `handoffRate`           | % of conversations escalated to humans            |
| `customerSatisfaction`  | Average CSAT score (if collected)                 |
| `sentimentDistribution` | Breakdown of positive/neutral/negative            |
| `topIntents`            | Most common customer intents                      |
| `topProducts`           | Most discussed products (from knowledge queries)  |

### Insights API

```typescript
// Get workspace-level metrics
const metrics = await workspacesClient.insights.getWorkspaceMetrics({
  workspaceId: 'ws-brand-x',
  period: 'last_7_days',
  granularity: 'daily',
});

// Response
{
  workspaceId: 'ws-brand-x',
  period: {
    start: '2026-01-03T00:00:00Z',
    end: '2026-01-10T00:00:00Z',
  },
  summary: {
    totalConversations: 1250,
    activeConversations: 45,
    avgResponseTime: 8500,        // ms
    avgResolutionTime: 420000,    // ms (7 minutes)
    automationRate: 0.78,
    handoffRate: 0.12,
    customerSatisfaction: 4.2,    // out of 5
  },
  timeSeries: [
    {
      date: '2026-01-03',
      conversations: 180,
      responseTime: 9200,
      automationRate: 0.75,
    },
    // ... more days
  ],
  byChannel: [
    {
      channelId: 'ch-facebook-a',
      channelName: 'Facebook Page A',
      conversations: 520,
      automationRate: 0.82,
    },
    {
      channelId: 'ch-instagram-a',
      channelName: 'Instagram A',
      conversations: 730,
      automationRate: 0.74,
    },
  ],
}

// Compare channels within workspace
const comparison = await workspacesClient.insights.getChannelComparison({
  workspaceId: 'ws-brand-x',
  period: 'last_30_days',
});
```

---

## Service Structure

```
services/workspaces/
├── functions/
│   └── src/
│       ├── internal-api/
│       │   ├── handler.ts           # Express + ORPC setup
│       │   ├── router.ts            # ORPC router
│       │   ├── workspaces.ts        # Workspace CRUD
│       │   ├── channels.ts          # Channel membership
│       │   ├── brand-profiles.ts    # Brand profile operations
│       │   ├── ai-configs.ts        # AI configuration
│       │   ├── knowledge-configs.ts # Knowledge bindings
│       │   ├── overrides.ts         # Channel overrides
│       │   ├── resolve.ts           # Configuration resolution
│       │   └── insights.ts          # Analytics endpoints
│       │
│       ├── events/
│       │   ├── channel-created.ts   # Auto-add to default workspace
│       │   └── channel-deleted.ts   # Remove from workspace
│       │
│       └── lib/
│           ├── db/
│           │   ├── workspaces.ts    # Workspace repository
│           │   ├── memberships.ts   # Channel-workspace mappings
│           │   ├── brand-profiles.ts
│           │   ├── ai-configs.ts
│           │   ├── knowledge-configs.ts
│           │   └── overrides.ts
│           │
│           ├── resolution/
│           │   ├── resolver.ts      # Config resolution logic
│           │   ├── merger.ts        # Config merge utilities
│           │   └── prompt-builder.ts # System prompt generation
│           │
│           └── insights/
│               ├── aggregator.ts    # Metrics aggregation
│               └── queries.ts       # Analytics queries
│
├── infra/
│   ├── Main.ts                      # Stack definition
│   ├── Api.ts                       # Internal API setup
│   └── Database.ts                  # DynamoDB tables
│
├── sst.config.ts
└── package.json
```

---

## Internal API Contract

### Workspaces

```typescript
// packages/contract-internal-api/src/workspaces.ts

export const createWorkspace = oc
  .route({ method: 'POST', path: '/workspaces' })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      type: z.enum(['brand', 'region', 'department', 'custom']),
      isDefault: z.boolean().default(false),
    })
  )
  .output(WorkspaceSchema);

export const getWorkspace = oc
  .route({ method: 'GET', path: '/workspaces/{workspaceId}' })
  .input(z.object({ workspaceId: z.string() }))
  .output(WorkspaceSchema);

export const listWorkspaces = oc
  .route({ method: 'GET', path: '/workspaces' })
  .input(
    z.object({
      status: z.enum(['active', 'archived']).optional(),
      type: z.enum(['brand', 'region', 'department', 'custom']).optional(),
    })
  )
  .output(z.array(WorkspaceSchema));
```

### Channel Membership

```typescript
export const addChannel = oc
  .route({ method: 'POST', path: '/workspaces/{workspaceId}/channels' })
  .input(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
    })
  )
  .output(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
      addedAt: z.string(),
    })
  );

export const removeChannel = oc
  .route({
    method: 'DELETE',
    path: '/workspaces/{workspaceId}/channels/{channelId}',
  })
  .input(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
    })
  )
  .output(z.object({ success: z.boolean() }));

export const listChannels = oc
  .route({ method: 'GET', path: '/workspaces/{workspaceId}/channels' })
  .input(z.object({ workspaceId: z.string() }))
  .output(z.array(ChannelMembershipSchema));

export const getChannelWorkspace = oc
  .route({ method: 'GET', path: '/channels/{channelId}/workspace' })
  .input(z.object({ channelId: z.string() }))
  .output(WorkspaceSchema.nullable());
```

### Configuration

```typescript
export const getBrandProfile = oc
  .route({ method: 'GET', path: '/workspaces/{workspaceId}/brand-profile' })
  .input(z.object({ workspaceId: z.string() }))
  .output(BrandProfileSchema);

export const updateBrandProfile = oc
  .route({ method: 'PATCH', path: '/workspaces/{workspaceId}/brand-profile' })
  .input(
    z.object({
      workspaceId: z.string(),
      brandName: z.string().optional(),
      tagline: z.string().optional(),
      persona: z.string().optional(),
      toneOfVoice: ToneOfVoiceSchema.optional(),
      language: z.string().optional(),
      supportedLanguages: z.array(z.string()).optional(),
      responseGuidelines: ResponseGuidelinesSchema.optional(),
      signatureTemplate: z.string().optional(),
      businessHours: BusinessHoursSchema.optional(),
      escalationMessage: z.string().optional(),
    })
  )
  .output(BrandProfileSchema);

export const getAIConfig = oc
  .route({ method: 'GET', path: '/workspaces/{workspaceId}/ai-config' })
  .input(z.object({ workspaceId: z.string() }))
  .output(AIConfigSchema);

export const updateAIConfig = oc
  .route({ method: 'PATCH', path: '/workspaces/{workspaceId}/ai-config' })
  .input(AIConfigUpdateSchema)
  .output(AIConfigSchema);

export const getKnowledgeConfig = oc
  .route({ method: 'GET', path: '/workspaces/{workspaceId}/knowledge-config' })
  .input(z.object({ workspaceId: z.string() }))
  .output(KnowledgeConfigSchema);

export const updateKnowledgeConfig = oc
  .route({
    method: 'PATCH',
    path: '/workspaces/{workspaceId}/knowledge-config',
  })
  .input(KnowledgeConfigUpdateSchema)
  .output(KnowledgeConfigSchema);
```

### Resolution

```typescript
export const resolveForChannel = oc
  .route({ method: 'GET', path: '/resolve/channel/{channelId}' })
  .input(z.object({ channelId: z.string() }))
  .output(ResolvedConfigSchema);

export const resolveForConversation = oc
  .route({ method: 'GET', path: '/resolve/conversation/{conversationId}' })
  .input(z.object({ conversationId: z.string() }))
  .output(ResolvedConfigWithContextSchema);

export const generateSystemPrompt = oc
  .route({ method: 'POST', path: '/resolve/system-prompt' })
  .input(
    z.object({
      channelId: z.string(),
      includeKnowledgeContext: z.boolean().default(true),
      additionalContext: z.record(z.string()).optional(),
    })
  )
  .output(
    z.object({
      systemPrompt: z.string(),
      metadata: z.object({
        workspaceId: z.string(),
        brandName: z.string(),
        language: z.string(),
        generatedAt: z.string(),
      }),
    })
  );
```

### Channel Overrides

```typescript
export const setChannelOverride = oc
  .route({
    method: 'PUT',
    path: '/workspaces/{workspaceId}/channels/{channelId}/override',
  })
  .input(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
      brandOverrides: BrandOverridesSchema.optional(),
      aiOverrides: AIOverridesSchema.optional(),
      knowledgeOverrides: KnowledgeOverridesSchema.optional(),
      enabled: z.boolean().default(true),
    })
  )
  .output(ChannelOverrideSchema);

export const getChannelOverride = oc
  .route({
    method: 'GET',
    path: '/workspaces/{workspaceId}/channels/{channelId}/override',
  })
  .input(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
    })
  )
  .output(ChannelOverrideSchema.nullable());

export const deleteChannelOverride = oc
  .route({
    method: 'DELETE',
    path: '/workspaces/{workspaceId}/channels/{channelId}/override',
  })
  .input(
    z.object({
      workspaceId: z.string(),
      channelId: z.string(),
    })
  )
  .output(z.object({ success: z.boolean() }));
```

---

## Infrastructure

### DynamoDB Tables

**Workspaces Table:**

| Key | Type | Description      |
| --- | ---- | ---------------- |
| PK  | S    | `TENANT#<id>`    |
| SK  | S    | `WORKSPACE#<id>` |

GSI: `DefaultWorkspace` - Query default workspace for tenant

**Memberships Table:**

| Key | Type | Description               |
| --- | ---- | ------------------------- |
| PK  | S    | `WORKSPACE#<workspaceId>` |
| SK  | S    | `CHANNEL#<channelId>`     |

GSI: `ChannelLookup` - PK: `CHANNEL#<channelId>`, SK: `WORKSPACE#<workspaceId>`

**Configurations Table (Single Table):**

| Key | Type | Description                                       |
| --- | ---- | ------------------------------------------------- |
| PK  | S    | `WORKSPACE#<id>`                                  |
| SK  | S    | `CONFIG#brand` / `CONFIG#ai` / `CONFIG#knowledge` |

**Overrides Table:**

| Key | Type | Description               |
| --- | ---- | ------------------------- |
| PK  | S    | `WORKSPACE#<workspaceId>` |
| SK  | S    | `OVERRIDE#<channelId>`    |

### EventBridge Integration

```typescript
// Listen for channel events from Conversations Service
{
  eventPattern: {
    source: ['conversations-service'],
    detailType: ['channel.created', 'channel.deleted'],
  },
  targets: [channelEventHandler],
}

// Emit workspace events
{
  source: 'workspaces-service',
  detailType: [
    'workspace.created',
    'workspace.updated',
    'workspace.deleted',
    'workspace.channel.added',
    'workspace.channel.removed',
    'workspace.config.updated',
  ],
}
```

---

## Integration with AI Agents Service

### Agent Execution Flow

```
1. Message arrives in Conversations Service
                │
                ▼
2. EventBridge: conversations.message.new
                │
                ▼
3. AI Agents Service: Event Router
   │
   │ Call: workspaces.resolve.forChannel(channelId)
   │
   ▼
4. Workspaces Service returns:
   {
     workspace,
     brandProfile,
     aiConfig,
     knowledgeConfig,
   }
                │
                ▼
5. AI Agents Service: Build context
   │
   ├─► Generate system prompt (using brand profile)
   ├─► Configure agent (using aiConfig.agentId)
   ├─► Setup tools (using aiConfig.toolPermissions)
   └─► Bind knowledge (using knowledgeConfig.collectionBindings)
                │
                ▼
6. Execute agent with full context
                │
                ▼
7. Agent responds using brand voice and workspace knowledge
```

### Context Builder Integration

```typescript
// In AI Agents Service: context-builder.ts

import { workspacesClient } from '~/internal-api/workspaces';

async function buildAgentContext(
  channelId: string,
  conversationId: string,
  message: string
): Promise<AgentContext> {
  // 1. Resolve workspace configuration
  const config = await workspacesClient.resolve.forChannel({ channelId });

  if (!config.workspace) {
    throw new Error(`Channel ${channelId} is not assigned to a workspace`);
  }

  // 2. Generate system prompt with brand context
  const { systemPrompt } = await workspacesClient.resolve.generateSystemPrompt({
    channelId,
    includeKnowledgeContext: true,
    additionalContext: {
      conversationId,
      currentMessage: message,
    },
  });

  // 3. Get agent configuration
  const agentId = config.aiConfig.agentId;
  const agent = await agentsClient.agents.get({ agentId });

  // 4. Build tool list based on permissions
  const enabledTools = Object.entries(config.aiConfig.toolPermissions)
    .filter(([_, enabled]) => enabled)
    .map(([toolName]) => toolName);

  // 5. Build knowledge tool bindings
  const knowledgeTools = config.knowledgeConfig.collectionBindings
    .filter((b) => b.enabled)
    .map((binding) => ({
      toolName: binding.toolName || 'search_knowledge',
      collectionId: binding.collectionId,
      collectionType: binding.collectionType,
    }));

  return {
    systemPrompt,
    agent,
    tools: enabledTools,
    knowledgeTools,
    modelConfig: config.aiConfig.modelOverrides,
    brandProfile: config.brandProfile,
    workspace: config.workspace,
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Service scaffolding (sst.config, infra)
- [ ] DynamoDB tables (Workspaces, Memberships, Configurations, Overrides)
- [ ] Workspace CRUD API
- [ ] Channel membership API
- [ ] Basic resolution API (channel → workspace lookup)

### Phase 2: Configuration

- [ ] Brand Profile management
- [ ] AI Config management
- [ ] Knowledge Config management
- [ ] Channel overrides
- [ ] Configuration merge logic

### Phase 3: Resolution & Integration

- [ ] Full resolution API with merging
- [ ] System prompt generation
- [ ] AI Agents Service integration
- [ ] EventBridge integration (channel events)

### Phase 4: UI Integration

- [ ] Workspace management UI
- [ ] Channel assignment interface
- [ ] Brand profile editor
- [ ] AI configuration editor
- [ ] Knowledge binding UI

### Phase 5: Insights

- [ ] Workspace metrics aggregation
- [ ] Channel comparison
- [ ] Analytics dashboard
- [ ] Export/reporting

---

## Open Questions

### Design Decisions

- [ ] **Hierarchy**: Should workspaces support nesting (workspace → sub-workspace)?
- [ ] **Templates**: Should we provide workspace templates for common setups?
- [ ] **Versioning**: Should configurations be versioned for rollback?
- [ ] **Sharing**: Can configurations be shared across workspaces?

### Product Decisions

- [ ] **Limits**: Max workspaces per tenant? Max channels per workspace?
- [ ] **Migration**: How to migrate existing channels to workspaces?
- [ ] **Defaults**: What happens to channels without a workspace?
- [ ] **Permissions**: Should workspace access be role-based?

### Future Considerations

- [ ] **Multi-tenant workspaces**: Share workspace across tenants (franchise model)?
- [ ] **Workspace marketplace**: Sell/share workspace configurations?
- [ ] **A/B testing**: Test different configurations across channels?
- [ ] **Audit trail**: Track all configuration changes?

---

## References

### Related Services

- [AI Agents Service Architecture](./ai-agents-service-architecture.md)
- [Knowledge Base Service Architecture](./knowledge-base-service-architecture.md)
- [Conversations Service Architecture](./conversations-service-architecture.md)

### Patterns

- [IAC Patterns](../docs/iac-patterns.md)
- [Internal API](../docs/internal-api.md)
