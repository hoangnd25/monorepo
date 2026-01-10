# AI Agents Service Architecture

> **Status**: Draft - High Level Architecture
> **Last Updated**: 2026-01-10

## Context & Problem Statement

### Business Need

Building on the Conversations Service, tenants need the ability to automate customer interactions using AI-powered agents. Currently, businesses face challenges:

- **Manual response burden**: Human agents must handle every conversation, even routine inquiries
- **Inconsistent responses**: Different agents may provide varying answers to the same questions
- **Limited availability**: Human agents can't provide 24/7 coverage cost-effectively
- **Scaling constraints**: Hiring and training human agents is slow and expensive

### Solution

Build an **AI Agents Service** that:

1. **Defines agents** with custom instructions, tools, and behaviors
2. **Triggers agent execution** when conversations match configured conditions
3. **Processes conversations** using LLM capabilities (AWS Bedrock)
4. **Executes tools** to take actions (reply, trigger flows, call APIs, etc.)
5. **Supports handoffs** between agents and to human operators
6. **Maintains conversation context** across multiple turns

### Relationship to Conversations Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVERSATIONS SERVICE                               │
│                                                                             │
│  • Receives messages from external channels (Facebook, Instagram, etc.)     │
│  • Normalizes and stores conversation history                               │
│  • Emits events when new messages arrive                                    │
│  • Provides APIs to send replies back through channels                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ EventBridge: conversations.message.new
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS SERVICE                                 │
│                                                                             │
│  • Evaluates triggers to determine if agent should respond                  │
│  • Loads agent configuration (instructions, tools, model settings)          │
│  • Invokes LLM with conversation context                                    │
│  • Executes tool calls (including sending replies via Conversations API)    │
│  • Manages agent handoffs and escalations                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL EVENTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ Conversations     │  │ Trigger Service   │  │ Manual Invocation     │   │
│  │ Service           │  │ (Future)          │  │ (API Call)            │   │
│  │                   │  │                   │  │                       │   │
│  │ message.new       │  │ schedule.trigger  │  │ agents.invoke         │   │
│  │ message.updated   │  │ webhook.received  │  │                       │   │
│  └─────────┬─────────┘  └─────────┬─────────┘  └───────────┬───────────┘   │
│            │                      │                        │               │
└────────────┼──────────────────────┼────────────────────────┼───────────────┘
             │                      │                        │
             └──────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS SERVICE                                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Event Router                                  │  │
│  │                                                                       │  │
│  │  1. Receive event (EventBridge / API Gateway)                         │  │
│  │  2. Evaluate triggers for tenant                                      │  │
│  │  3. Determine which agent(s) should process                           │  │
│  │  4. Queue agent execution                                             │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Agent Execution Engine                           │  │
│  │                                                                       │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐   │  │
│  │  │ Context     │    │ LangChain   │    │ Tool Executor           │   │  │
│  │  │ Builder     │───▶│ Agent       │───▶│                         │   │  │
│  │  │             │    │             │    │ • send_message          │   │  │
│  │  │ • History   │    │ • Planning  │    │ • trigger_flow          │   │  │
│  │  │ • Memories  │    │ • Reasoning │    │ • handoff_to_agent      │   │  │
│  │  │ • Tools     │    │ • Tool Use  │    │ • handoff_to_human      │   │  │
│  │  │ • Metadata  │    │             │    │ • call_subagent         │   │  │
│  │  └─────────────┘    └─────────────┘    │ • fetch_data            │   │  │
│  │                                        │ • custom_webhook        │   │  │
│  │                                        └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Data Layer                                  │    │
│  │                                                                     │    │
│  │  DynamoDB                          S3                               │    │
│  │  ┌──────────────────────────┐     ┌────────────────────────────┐   │    │
│  │  │ • Agents                 │     │ • Agent instructions       │   │    │
│  │  │ • Triggers               │     │ • Tool schemas             │   │    │
│  │  │ • Tools                  │     │ • Execution logs           │   │    │
│  │  │ • Agent Sessions         │     │                            │   │    │
│  │  │ • Execution History      │     │                            │   │    │
│  │  └──────────────────────────┘     └────────────────────────────┘   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Internal API (ORPC + IAM Auth)                     │  │
│  │                                                                       │  │
│  │  Agents:                         Triggers:                            │  │
│  │  • agents.create                 • triggers.create                    │  │
│  │  • agents.get                    • triggers.list                      │  │
│  │  • agents.update                 • triggers.update                    │  │
│  │  • agents.delete                 • triggers.delete                    │  │
│  │  • agents.list                                                        │  │
│  │  • agents.invoke                 Tools:                               │  │
│  │                                  • tools.create                       │  │
│  │  Sessions:                       • tools.list                         │  │
│  │  • sessions.get                  • tools.update                       │  │
│  │  • sessions.list                 • tools.delete                       │  │
│  │  • sessions.handoff                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
             │                                    │
             │ Tool: send_message                 │ Tool: trigger_flow
             ▼                                    ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   Conversations Service     │    │   Flows Service (Future)    │
│                             │    │                             │
│   messages.send             │    │   flows.trigger             │
└─────────────────────────────┘    └─────────────────────────────┘
```

---

## Core Concepts

### Agent

An **Agent** is an AI-powered entity configured to handle specific types of interactions.

| Field             | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `tenantId`        | Owning tenant                                                |
| `agentId`         | Unique identifier (ULID)                                     |
| `name`            | Human-readable name                                          |
| `description`     | Purpose of this agent (shown to LLM for routing decisions)   |
| `type`            | `standard` \| `supervisor` \| `router`                       |
| `systemPrompt`    | Base instructions for the agent's behavior                   |
| `model`           | Bedrock model identifier (e.g., `anthropic.claude-3-sonnet`) |
| `modelConfig`     | Temperature, max tokens, etc.                                |
| `tools`           | List of tool IDs this agent can use                          |
| `subAgents`       | List of agent IDs this agent can invoke (supervisor pattern) |
| `skills`          | List of skill IDs this agent can load (skills pattern)       |
| `steps`           | Step definitions for handoff pattern (see below)             |
| `maxTurns`        | Maximum conversation turns before requiring handoff          |
| `handoffBehavior` | What to do when max turns reached (`escalate` / `end`)       |
| `status`          | `active` \| `inactive` \| `draft`                            |
| `createdAt`       | Creation timestamp                                           |
| `updatedAt`       | Last update timestamp                                        |

**Agent Types:**

| Type         | Description                                           | Pattern Used    |
| ------------ | ----------------------------------------------------- | --------------- |
| `standard`   | Single agent with tools, optionally with skills/steps | Skills/Handoffs |
| `supervisor` | Coordinates subagents as tools                        | Subagents       |
| `router`     | Classifies input and routes to specialized agents     | Router          |

**Steps (for Handoff Pattern):**

```typescript
interface AgentStep {
  stepId: string;
  name: string;
  systemPrompt: string; // Prompt for this step
  tools: string[]; // Tools available in this step
  transitionTools: string[]; // Tools that can transition to other steps
  isInitial?: boolean; // Starting step
  isFinal?: boolean; // Can end conversation
}
```

**Example Agent with Steps:**

```json
{
  "agentId": "agent-123",
  "name": "Customer Support Agent",
  "type": "standard",
  "steps": [
    {
      "stepId": "triage",
      "name": "Triage",
      "systemPrompt": "Greet customer and identify their issue type...",
      "tools": ["get_customer_info"],
      "transitionTools": ["transition_to_billing", "transition_to_tech"],
      "isInitial": true
    },
    {
      "stepId": "billing",
      "name": "Billing Support",
      "systemPrompt": "Help with billing inquiries...",
      "tools": ["lookup_invoice", "process_refund"],
      "transitionTools": ["escalate_to_human", "resolve_issue"]
    },
    {
      "stepId": "tech",
      "name": "Technical Support",
      "systemPrompt": "Help with technical issues...",
      "tools": ["run_diagnostics", "create_ticket"],
      "transitionTools": ["escalate_to_human", "resolve_issue"]
    }
  ]
}
```

### Skill

A **Skill** is a specialized prompt/context that can be loaded on-demand.

| Field         | Description                                     |
| ------------- | ----------------------------------------------- |
| `tenantId`    | Owning tenant (null for system skills)          |
| `skillId`     | Unique identifier (ULID)                        |
| `name`        | Skill name (used in load_skill tool)            |
| `description` | What this skill does (shown to LLM)             |
| `prompt`      | Specialized instructions when skill is active   |
| `tools`       | Additional tools available when skill is loaded |
| `parentSkill` | Parent skill ID (for hierarchical skills)       |
| `status`      | `active` \| `inactive`                          |

**Example Skills:**

```json
[
  {
    "skillId": "skill-sql",
    "name": "sql_expert",
    "description": "SQL query writing and optimization",
    "prompt": "You are a SQL expert. Write efficient, secure queries...",
    "tools": ["execute_query", "explain_query"]
  },
  {
    "skillId": "skill-refund",
    "name": "refund_processor",
    "description": "Process customer refund requests",
    "prompt": "You handle refund requests. Verify eligibility, calculate amount...",
    "tools": ["check_order", "process_refund", "send_confirmation"]
  }
]
```

### Trigger

A **Trigger** defines conditions under which an agent should be activated.

| Field        | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `tenantId`   | Owning tenant                                                    |
| `triggerId`  | Unique identifier (ULID)                                         |
| `name`       | Human-readable name                                              |
| `agentId`    | Agent to invoke when triggered                                   |
| `eventType`  | Event to listen for (`message.new`, `schedule`, `webhook`, etc.) |
| `conditions` | Filter conditions (channel, keywords, time, etc.)                |
| `priority`   | Evaluation order (lower = higher priority)                       |
| `status`     | `active` \| `inactive`                                           |

**Example Conditions:**

```json
{
  "all": [
    {
      "field": "channel.platform",
      "operator": "in",
      "value": ["facebook", "instagram"]
    },
    { "field": "conversation.status", "operator": "eq", "value": "open" },
    { "field": "message.direction", "operator": "eq", "value": "inbound" }
  ],
  "any": [
    { "field": "message.text", "operator": "contains", "value": "help" },
    { "field": "message.text", "operator": "contains", "value": "support" }
  ]
}
```

### Tool

A **Tool** is a capability an agent can invoke to take actions.

| Field         | Description                                      |
| ------------- | ------------------------------------------------ |
| `tenantId`    | Owning tenant (null for system tools)            |
| `toolId`      | Unique identifier                                |
| `type`        | `system` \| `custom`                             |
| `name`        | Function name (used in LLM tool calling)         |
| `description` | What the tool does (shown to LLM)                |
| `parameters`  | JSON Schema for tool parameters                  |
| `handler`     | Execution config (Lambda ARN, webhook URL, etc.) |
| `status`      | `active` \| `inactive`                           |

**System Tools (Built-in):**

| Tool Name          | Description                              |
| ------------------ | ---------------------------------------- |
| `send_message`     | Send a reply via Conversations Service   |
| `handoff_to_human` | Escalate to human operator               |
| `handoff_to_agent` | Transfer to another agent                |
| `end_conversation` | Mark conversation as resolved            |
| `trigger_flow`     | Start an automation flow                 |
| `set_context`      | Store information in session memory      |
| `get_context`      | Retrieve information from session memory |

**Custom Tools (Tenant-defined):**

| Handler Type | Description                              |
| ------------ | ---------------------------------------- |
| `webhook`    | HTTP POST to tenant's endpoint           |
| `lambda`     | Invoke tenant's Lambda function (future) |

### Agent Session

An **Agent Session** tracks the state of an agent processing a conversation.

| Field             | Description                                         |
| ----------------- | --------------------------------------------------- |
| `tenantId`        | Owning tenant                                       |
| `sessionId`       | Unique identifier (ULID)                            |
| `conversationId`  | Linked conversation in Conversations Service        |
| `agentId`         | Currently active agent                              |
| `status`          | `active` \| `handed_off` \| `completed` \| `failed` |
| `turnCount`       | Number of agent turns in this session               |
| `memory`          | Key-value store for session context                 |
| `parentSessionId` | If handed off from another agent                    |
| `handoffReason`   | Why handoff occurred                                |
| `startedAt`       | When session started                                |
| `endedAt`         | When session ended                                  |

### Execution Record

An **Execution Record** logs each agent invocation for debugging and analytics.

| Field           | Description                            |
| --------------- | -------------------------------------- |
| `executionId`   | Unique identifier (ULID)               |
| `sessionId`     | Parent session                         |
| `agentId`       | Agent that executed                    |
| `triggerId`     | Trigger that initiated (if applicable) |
| `input`         | Input context (message, metadata)      |
| `modelRequest`  | Request sent to Bedrock                |
| `modelResponse` | Response from Bedrock                  |
| `toolCalls`     | Tools invoked and their results        |
| `output`        | Final output/action taken              |
| `latencyMs`     | Execution duration                     |
| `tokenUsage`    | Input/output tokens consumed           |
| `status`        | `success` \| `failed` \| `timeout`     |
| `error`         | Error details if failed                |
| `createdAt`     | Timestamp                              |

---

## AWS Bedrock Integration

### Supported Models

| Model                       | Use Case                  | Notes                  |
| --------------------------- | ------------------------- | ---------------------- |
| `anthropic.claude-3-sonnet` | General purpose, balanced | Recommended default    |
| `anthropic.claude-3-haiku`  | Fast, cost-effective      | Simple queries         |
| `anthropic.claude-3-opus`   | Complex reasoning         | Premium tier           |
| `amazon.titan-text-express` | Basic tasks               | Lower cost alternative |

### Model Configuration

```typescript
interface ModelConfig {
  modelId: string;
  temperature?: number; // 0-1, default 0.7
  maxTokens?: number; // Max output tokens, default 1024
  topP?: number; // Nucleus sampling
  stopSequences?: string[]; // Stop generation tokens
}
```

### Bedrock Invocation Pattern

```typescript
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-west-2' });

async function invokeModel(
  modelId: string,
  messages: Message[],
  tools: Tool[],
  config: ModelConfig
): Promise<ModelResponse> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      messages,
      tools: tools.map(formatToolForClaude),
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  const response = await client.send(command);
  return JSON.parse(new TextDecoder().decode(response.body));
}
```

---

## Multi-Agent Patterns

LangChain provides several patterns for building multi-agent systems. The Agent `type` field determines which pattern is used.

> **Detailed Reference**: See [LangChain Multi-Agent Patterns Reference](./langchain-multi-agent-patterns.md) for implementation details, code examples, and pattern comparison.

### Quick Pattern Overview

| Pattern       | Agent Type   | How it Works                                           | Best For                            |
| ------------- | ------------ | ------------------------------------------------------ | ----------------------------------- |
| **Subagents** | `supervisor` | Main agent coordinates subagents as tools              | Parallel execution, multi-domain    |
| **Handoffs**  | `standard`   | Single agent with steps, tools trigger state changes   | Sequential workflows, support flows |
| **Skills**    | `standard`   | Single agent loads specialized prompts on-demand       | Many specializations, progressive   |
| **Router**    | `router`     | Routing step classifies input and dispatches to agents | Distinct verticals, parallel RAG    |

### Pattern Selection by Use Case

| Use Case                     | Pattern   | Why                                         |
| ---------------------------- | --------- | ------------------------------------------- |
| Customer support with stages | Handoffs  | Sequential flow, collect info before acting |
| Multi-department routing     | Subagents | Parallel specialists, centralized control   |
| FAQ bot with many topics     | Skills    | Load topic-specific knowledge on demand     |
| Knowledge base search        | Router    | Query multiple sources in parallel          |
| Sales qualification funnel   | Handoffs  | Must complete stages in order               |

### Performance Notes

- **Handoffs/Skills**: Most efficient for repeated requests (stateful - saves calls on subsequent turns)
- **Subagents/Router**: Most efficient for multi-domain queries (parallel execution, context isolation)
- **Subagents**: Extra overhead per request (results flow back through main agent) but provides centralized control

---

## LangChain Integration

### Why LangChain?

- **Abstraction**: Unified interface across different LLM providers
- **Tool calling**: Built-in support for function/tool calling
- **Memory**: Conversation memory management
- **Agents**: ReAct and other agent patterns out of the box
- **Streaming**: Support for streaming responses

### Agent Architecture with LangChain

```typescript
import { ChatBedrockConverse } from '@langchain/aws';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';

// Initialize model
const model = new ChatBedrockConverse({
  model: 'anthropic.claude-3-sonnet-20240229-v1:0',
  region: 'us-west-2',
  temperature: 0.7,
});

// Create tools
const tools = [
  sendMessageTool,
  handoffToHumanTool,
  triggerFlowTool,
  // ... custom tools
];

// Create agent with memory
const checkpointer = new MemorySaver();

const agent = createReactAgent({
  llm: model,
  tools,
  checkpointSaver: checkpointer,
});

// Invoke agent
const result = await agent.invoke(
  {
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: newMessage },
    ],
  },
  {
    configurable: {
      thread_id: sessionId,
    },
  }
);
```

### Tool Definition Pattern

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const sendMessageTool = tool(
  async ({ message, conversationId }) => {
    // Call Conversations Service internal API
    await conversationsClient.messages.send({
      conversationId,
      content: { text: message },
    });
    return `Message sent successfully`;
  },
  {
    name: 'send_message',
    description: 'Send a message to the customer in the current conversation',
    schema: z.object({
      message: z.string().describe('The message text to send'),
      conversationId: z.string().describe('The conversation ID'),
    }),
  }
);

const handoffToAgentTool = tool(
  async ({ targetAgentId, reason, sessionId }) => {
    // Create new session for target agent
    // Update current session status to handed_off
    return `Handed off to agent ${targetAgentId}`;
  },
  {
    name: 'handoff_to_agent',
    description: 'Transfer the conversation to another specialized agent',
    schema: z.object({
      targetAgentId: z.string().describe('The ID of the agent to hand off to'),
      reason: z.string().describe('Why the handoff is needed'),
      sessionId: z.string().describe('Current session ID'),
    }),
  }
);
```

### Memory Management

```typescript
// Session memory stored in DynamoDB
interface SessionMemory {
  // Conversation summary (compressed history)
  summary?: string;

  // Key facts extracted during conversation
  facts: Record<string, string>;

  // User preferences/context
  userContext: Record<string, unknown>;

  // Handoff context from previous agents
  handoffContext?: {
    fromAgentId: string;
    reason: string;
    relevantInfo: Record<string, unknown>;
  };
}
```

---

## Agent Execution Flow

### Message Processing Flow

```
1. EventBridge receives: conversations.message.new
                    │
                    ▼
2. Event Router Lambda triggered
                    │
                    ▼
3. Load tenant's active triggers
                    │
                    ▼
4. Evaluate triggers against event
   (check conditions, priority order)
                    │
                    ▼
5. Matching trigger found?
   ├─ No  → Exit (no agent processing)
   │
   └─ Yes → Continue
                    │
                    ▼
6. Check for existing active session for this conversation
   ├─ Exists → Load session, continue with current agent
   │
   └─ None  → Create new session for triggered agent
                    │
                    ▼
7. Build execution context:
   • Load agent configuration
   • Load conversation history (from Conversations Service)
   • Load session memory
   • Prepare tool definitions
                    │
                    ▼
8. Invoke LangChain agent with context
                    │
                    ▼
9. Agent processes and returns action(s):
   ├─ Tool call: send_message
   │   └─ Execute tool → Call Conversations Service
   │
   ├─ Tool call: handoff_to_agent
   │   └─ Create new session → Invoke target agent
   │
   ├─ Tool call: handoff_to_human
   │   └─ Update session status → Emit escalation event
   │
   └─ Text response (no tool)
       └─ Auto-send via send_message tool
                    │
                    ▼
10. Update session state:
    • Increment turn count
    • Update memory
    • Check max turns
                    │
                    ▼
11. Log execution record
                    │
                    ▼
12. Max turns reached?
    ├─ No  → Done
    │
    └─ Yes → Execute handoff behavior
            (escalate or end)
```

### Handoff Flow

```
┌─────────────────┐     handoff_to_agent      ┌─────────────────┐
│   Agent A       │ ─────────────────────────▶│   Agent B       │
│   (General)     │                           │   (Specialist)  │
└─────────────────┘                           └─────────────────┘
        │                                              │
        │ Session A                                    │ Session B
        │ status: handed_off                           │ status: active
        │ handoffTo: Session B                         │ parentSession: A
        │                                              │
        ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Conversation                             │
│                   (Conversations Service)                       │
└─────────────────────────────────────────────────────────────────┘

Handoff Context Passed:
{
  fromAgentId: "agent-a-id",
  fromSessionId: "session-a-id",
  reason: "Customer asking about billing, need specialist",
  relevantInfo: {
    customerIntent: "billing inquiry",
    orderNumber: "ORD-12345",
    previousSummary: "Customer greeted, identified billing question"
  }
}
```

---

## Service Structure

```
services/ai-agents/
├── functions/
│   └── src/
│       ├── event-router/
│       │   ├── handler.ts           # EventBridge handler
│       │   ├── trigger-evaluator.ts # Evaluate trigger conditions
│       │   └── types.ts
│       │
│       ├── agent-executor/
│       │   ├── handler.ts           # Agent execution entry point
│       │   ├── context-builder.ts   # Build execution context
│       │   ├── langchain-agent.ts   # LangChain agent setup
│       │   └── memory-manager.ts    # Session memory operations
│       │
│       ├── tools/
│       │   ├── index.ts             # Tool registry
│       │   ├── send-message.ts      # Send message tool
│       │   ├── handoff.ts           # Handoff tools
│       │   ├── trigger-flow.ts      # Flow trigger tool
│       │   ├── context.ts           # Context get/set tools
│       │   └── custom-webhook.ts    # Custom webhook executor
│       │
│       ├── internal-api/
│       │   ├── router.ts            # ORPC router
│       │   ├── agents.ts            # Agent CRUD handlers
│       │   ├── triggers.ts          # Trigger CRUD handlers
│       │   ├── tools.ts             # Tool CRUD handlers
│       │   └── sessions.ts          # Session handlers
│       │
│       └── lib/
│           ├── db/
│           │   ├── agents.ts        # Agent repository
│           │   ├── triggers.ts      # Trigger repository
│           │   ├── tools.ts         # Tool repository
│           │   ├── sessions.ts      # Session repository
│           │   └── executions.ts    # Execution log repository
│           │
│           ├── bedrock/
│           │   ├── client.ts        # Bedrock client wrapper
│           │   └── models.ts        # Model configurations
│           │
│           └── events.ts            # EventBridge helpers
│
├── infra/
│   ├── Main.ts                      # Stack definition
│   ├── Api.ts                       # Internal API setup
│   ├── Database.ts                  # DynamoDB tables
│   ├── EventRouter.ts               # EventBridge rules
│   └── Permissions.ts               # IAM for Bedrock, etc.
│
├── sst.config.ts
└── package.json
```

---

## Internal API Contract

### Agents

```typescript
// packages/contract-internal-api/src/ai-agents.ts

export const createAgent = oc
  .route({ method: 'POST', path: '/agents' })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      systemPrompt: z.string(),
      model: z.string().default('anthropic.claude-3-sonnet'),
      modelConfig: ModelConfigSchema.optional(),
      tools: z.array(z.string()).default([]),
      subAgents: z.array(z.string()).default([]),
      maxTurns: z.number().default(10),
      handoffBehavior: z.enum(['escalate', 'end']).default('escalate'),
    })
  )
  .output(AgentSchema);

export const invokeAgent = oc
  .route({ method: 'POST', path: '/agents/{agentId}/invoke' })
  .input(
    z.object({
      agentId: z.string(),
      conversationId: z.string(),
      message: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
  )
  .output(
    z.object({
      sessionId: z.string(),
      executionId: z.string(),
      actions: z.array(ActionSchema),
    })
  );
```

### Triggers

```typescript
export const createTrigger = oc
  .route({ method: 'POST', path: '/triggers' })
  .input(
    z.object({
      name: z.string(),
      agentId: z.string(),
      eventType: z.enum(['message.new', 'schedule', 'webhook', 'manual']),
      conditions: TriggerConditionsSchema,
      priority: z.number().default(100),
    })
  )
  .output(TriggerSchema);
```

### Sessions

```typescript
export const getSession = oc
  .route({ method: 'GET', path: '/sessions/{sessionId}' })
  .input(z.object({ sessionId: z.string() }))
  .output(SessionSchema);

export const handoffSession = oc
  .route({ method: 'POST', path: '/sessions/{sessionId}/handoff' })
  .input(
    z.object({
      sessionId: z.string(),
      targetType: z.enum(['agent', 'human']),
      targetAgentId: z.string().optional(),
      reason: z.string(),
    })
  )
  .output(
    z.object({
      newSessionId: z.string().optional(),
      status: z.string(),
    })
  );
```

---

## Infrastructure

### DynamoDB Tables

**Agents Table:**

| Key | Type | Description   |
| --- | ---- | ------------- |
| PK  | S    | `TENANT#<id>` |
| SK  | S    | `AGENT#<id>`  |

GSI: `AgentsByStatus` - Query agents by status

**Triggers Table:**

| Key | Type | Description    |
| --- | ---- | -------------- |
| PK  | S    | `TENANT#<id>`  |
| SK  | S    | `TRIGGER#<id>` |

GSI: `TriggersByEvent` - Query triggers by event type

**Sessions Table:**

| Key | Type | Description    |
| --- | ---- | -------------- |
| PK  | S    | `TENANT#<id>`  |
| SK  | S    | `SESSION#<id>` |

GSI: `SessionsByConversation` - Query sessions by conversation ID

**Executions Table:**

| Key | Type | Description             |
| --- | ---- | ----------------------- |
| PK  | S    | `SESSION#<id>`          |
| SK  | S    | `EXEC#<timestamp>#<id>` |

TTL: 30 days for execution records

### IAM Permissions

```typescript
// Bedrock access
{
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
  resources: ['arn:aws:bedrock:*::foundation-model/*'],
}

// Conversations Service API access
{
  actions: ['execute-api:Invoke'],
  resources: [`arn:aws:execute-api:${region}:${account}:${apiId}/*`],
}

// EventBridge
{
  actions: ['events:PutEvents'],
  resources: [`arn:aws:events:${region}:${account}:event-bus/default`],
}
```

### EventBridge Rules

```typescript
// Listen for new messages from Conversations Service
{
  eventPattern: {
    source: ['conversations-service'],
    detailType: ['message.new'],
  },
  targets: [eventRouterLambda],
}
```

---

## Architecture Decisions

### Execution Model

**Decision**: Start with **synchronous Lambda**, migrate to **Step Functions** for long-running agents in Phase 3.

| Approach       | Pros                                    | Cons                           | When to Use           |
| -------------- | --------------------------------------- | ------------------------------ | --------------------- |
| Sync Lambda    | Simple, low latency, easy debugging     | 15min timeout, no pause/resume | Most agent executions |
| Step Functions | Long-running, durable, visual debugging | More complex, higher latency   | Complex multi-agent   |
| Lambda + Queue | Async processing, retry handling        | Eventual consistency           | High-volume triggers  |

**Recommendation**:

- Phase 1-2: Synchronous Lambda with 5-minute timeout (sufficient for most agent tasks)
- Phase 3+: Add Step Functions for supervisor agents coordinating multiple subagents
- Use SQS queue between EventBridge and agent executor for buffering and retry

### Streaming Responses

**Decision**: **Defer to Phase 5**. Start with complete responses.

- Bedrock supports streaming via `InvokeModelWithResponseStream`
- LangChain supports streaming with `streamEvents()` API
- Requires WebSocket or SSE connection from UI
- Complexity: Need to handle partial tool calls, state management

**Implementation approach when ready**:

1. API Gateway WebSocket for real-time updates
2. Session-based connection management
3. Progressive rendering in UI

### Concurrency Handling

**Decision**: **Optimistic locking with DynamoDB** + **SQS FIFO queue per conversation**.

```
Message 1 arrives → SQS FIFO (conversationId as group) → Agent processes
Message 2 arrives → Queued behind Message 1 (same group)
Message 3 (different convo) → Processes in parallel
```

- Use DynamoDB conditional writes on session `version` field
- SQS FIFO ensures ordered processing per conversation
- Parallel processing across different conversations

### Rate Limiting

**Decision**: **Per-tenant limits** tracked in DynamoDB with sliding window.

| Limit Type          | Default | Storage                     |
| ------------------- | ------- | --------------------------- |
| Invocations/minute  | 60      | DynamoDB (TTL-based)        |
| Tokens/day          | 100,000 | DynamoDB (daily aggregates) |
| Concurrent sessions | 10      | DynamoDB (session count)    |

- Tenants can purchase higher limits (store in tenant config)
- Emit CloudWatch metrics for monitoring
- Return 429 with `Retry-After` header when limited

### Memory Persistence

**Decision**: **DynamoDB** for session memory (not Redis).

| Factor       | DynamoDB           | Redis                       |
| ------------ | ------------------ | --------------------------- |
| Persistence  | Durable by default | Requires persistence config |
| Cost         | Pay per request    | Always-on instance          |
| Ops overhead | Serverless         | Cluster management          |
| Latency      | ~5-10ms            | ~1-2ms                      |

- Session memory is key-value with moderate access frequency
- DynamoDB single-digit millisecond latency is acceptable
- Consistent with existing codebase patterns (no Redis currently)
- Consider DAX cache layer if latency becomes an issue

### History Window

**Decision**: **Configurable per agent** with smart defaults.

| Setting          | Default | Description                              |
| ---------------- | ------- | ---------------------------------------- |
| `maxMessages`    | 20      | Maximum conversation messages in context |
| `maxTokens`      | 4000    | Token budget for history                 |
| `summarizeAfter` | 10      | Summarize older messages after N turns   |

**Strategy**:

1. Include last N messages (configurable)
2. For longer conversations, summarize older messages
3. Always include: first message, key extracted facts, last N messages
4. Store summary in session memory for efficiency

### Execution Logs

**Decision**: **DynamoDB with TTL** (30 days), archive to **S3** for long-term.

| Storage      | Retention | Use Case                        |
| ------------ | --------- | ------------------------------- |
| DynamoDB     | 30 days   | Recent debugging, analytics     |
| S3 (Parquet) | 1 year    | Compliance, historical analysis |

- TTL on DynamoDB automatically cleans up old records
- DynamoDB Streams → Lambda → S3 for archival
- S3 enables Athena queries for analytics

### Custom Tool Security

**Decision**: **Signed webhook requests** with tenant secrets + **request sandboxing**.

```typescript
interface CustomToolConfig {
  webhookUrl: string;
  secretKey: string; // Tenant-provided, stored encrypted in Secrets Manager
  timeout: number; // Max 30 seconds
  allowedHeaders: string[]; // Whitelist of headers to pass
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}
```

**Security measures**:

1. HMAC signature on request body using tenant's secret
2. Include timestamp to prevent replay attacks
3. Timeout enforcement (max 30s)
4. Response size limits (max 1MB)
5. No PII in webhook payloads by default (opt-in)
6. Audit logging of all custom tool invocations

### Agent Handoff Depth

**Decision**: **Maximum 3 levels** of agent handoffs.

```
Level 0: Initial agent (e.g., Triage)
Level 1: First handoff (e.g., Billing Specialist)
Level 2: Second handoff (e.g., Refund Processor)
Level 3: Final level - must resolve or escalate to human
```

- Prevents infinite loops
- Tracked in session: `handoffDepth` counter
- At max depth, only `handoff_to_human` and `end_conversation` tools available

### Human Handoff Notification

**Decision**: **EventBridge event** + **WebSocket push** to UI.

```typescript
// Event emitted on human handoff
{
  source: 'ai-agents-service',
  detailType: 'session.handoff.human',
  detail: {
    tenantId: 'tenant-123',
    sessionId: 'session-456',
    conversationId: 'conv-789',
    reason: 'Customer requested human assistance',
    priority: 'high',
    context: { /* relevant session memory */ }
  }
}
```

- UI subscribes to tenant-specific events via WebSocket
- Also update conversation status in Conversations Service
- Optional: Send notification via tenant's preferred channel (email, Slack, etc.)

### Token Budgets

**Decision**: **Hierarchical limits** - tenant → agent → session.

| Level   | Limit Type | Purpose                           |
| ------- | ---------- | --------------------------------- |
| Tenant  | Daily cap  | Overall cost control              |
| Agent   | Per-invoke | Prevent runaway single executions |
| Session | Cumulative | Limit long conversations          |

```typescript
interface TokenLimits {
  tenant: {
    dailyInputTokens: number; // e.g., 1,000,000
    dailyOutputTokens: number; // e.g., 500,000
  };
  agent: {
    maxInputTokens: number; // e.g., 8,000 per invocation
    maxOutputTokens: number; // e.g., 2,000 per invocation
  };
  session: {
    maxTotalTokens: number; // e.g., 50,000 across all turns
  };
}
```

### Caching Strategy

**Decision**: **Multi-layer caching** with appropriate TTLs.

| Data               | Cache Layer     | TTL   | Invalidation      |
| ------------------ | --------------- | ----- | ----------------- |
| Agent config       | Lambda memory   | 5 min | On agent update   |
| Tool definitions   | Lambda memory   | 5 min | On tool update    |
| Session memory     | None (DynamoDB) | N/A   | N/A               |
| Trigger conditions | Lambda memory   | 1 min | On trigger update |

- Use SSM Parameter Store for config with caching
- Lambda environment variables for static config
- Consider ElastiCache only if sub-millisecond latency needed

### Cold Start Mitigation

**Decision**: **Provisioned Concurrency** for agent executor Lambda.

| Environment | Provisioned Concurrency | Reason               |
| ----------- | ----------------------- | -------------------- |
| Production  | 5-10                    | Ensure fast response |
| Staging     | 1-2                     | Cost savings         |
| Development | 0                       | Accept cold starts   |

- Agent executor Lambda is most latency-sensitive
- Event router can tolerate cold starts (async)
- Monitor P99 latency, adjust provisioned concurrency

---

## Open Questions (Remaining)

### Future Considerations

- [ ] **Multi-region**: Should agents be region-specific or global?
- [ ] **A/B testing**: How to test different agent prompts/configs?
- [ ] **Versioning**: How to handle agent version rollbacks?
- [ ] **Analytics**: What metrics are most valuable to surface to tenants?

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Service scaffolding (sst.config, infra)
- [ ] DynamoDB tables (Agents, Triggers, Sessions, Executions)
- [ ] Basic Agent CRUD API
- [ ] Bedrock integration with Claude
- [ ] Simple agent invocation (no tools)

### Phase 2: Core Agent Capabilities

- [ ] LangChain integration
- [ ] System tools (send_message, handoff_to_human)
- [ ] Session management
- [ ] Trigger evaluation engine
- [ ] EventBridge integration with Conversations Service

### Phase 3: Advanced Features

- [ ] Agent-to-agent handoffs
- [ ] Custom webhook tools
- [ ] Session memory management
- [ ] Execution logging and debugging

### Phase 4: UI Integration

- [ ] Agent builder UI in main-ui
- [ ] Trigger configuration UI
- [ ] Session monitoring dashboard
- [ ] Execution history viewer

### Phase 5: Optimization

- [ ] Streaming responses
- [ ] Token usage tracking and limits
- [ ] Performance optimization
- [ ] Analytics and insights

---

## References

### AWS Bedrock

- [Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [Bedrock Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/)
- [Claude on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html)

### LangChain

- [LangChain.js Documentation](https://js.langchain.com/docs/)
- [LangChain AWS Integration](https://js.langchain.com/docs/integrations/platforms/aws)
- [LangGraph Agents](https://langchain-ai.github.io/langgraphjs/)
- [Tool Calling](https://js.langchain.com/docs/concepts/tool_calling)

### LangChain Multi-Agent Patterns

- [Multi-Agent Overview](https://docs.langchain.com/oss/javascript/langchain/multi-agent) - Pattern comparison and selection guide
- [Subagents Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents) - Supervisor coordinating subagents as tools
- [Handoffs Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/handoffs) - State-driven transitions between agents/steps
- [Skills Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/skills) - On-demand loading of specialized prompts
- [Router Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/router) - Input classification and parallel dispatch
- [Context Engineering](https://docs.langchain.com/oss/javascript/langchain/context-engineering) - Managing what each agent sees

### Related Services

- [Conversations Service Architecture](./conversations-service-architecture.md)
