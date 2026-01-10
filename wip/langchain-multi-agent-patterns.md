# LangChain Multi-Agent Patterns Reference

> **Status**: Reference Documentation
> **Last Updated**: 2026-01-10
> **Source**: [LangChain Multi-Agent Documentation](https://docs.langchain.com/oss/javascript/langchain/multi-agent)

## Overview

LangChain provides several patterns for building multi-agent systems. This document captures key information for designing a flexible system that allows users to configure agents for different use cases.

### Why Multi-Agent?

When developers need "multi-agent," they're usually looking for:

- **Context management**: Provide specialized knowledge without overwhelming the model's context window
- **Distributed development**: Allow different teams to develop and maintain capabilities independently
- **Parallelization**: Spawn specialized workers for subtasks and execute them concurrently

Multi-agent patterns are valuable when:

- A single agent has too many tools and makes poor decisions about which to use
- Tasks require specialized knowledge with extensive context
- You need to enforce sequential constraints that unlock capabilities only after certain conditions are met

---

## Pattern Summary

| Pattern       | How it Works                                                                   | Best For                                     |
| ------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **Subagents** | Main agent coordinates subagents as tools. All routing through main agent.     | Parallel execution, distributed development  |
| **Handoffs**  | Tools update state to trigger routing/config changes. Direct user interaction. | Sequential workflows, customer support flows |
| **Skills**    | Single agent loads specialized prompts/context on-demand.                      | Many specializations, progressive disclosure |
| **Router**    | Routing step classifies input and directs to specialized agents.               | Distinct verticals, parallel queries         |

### Pattern Selection Guide

| Capability              | Subagents  | Handoffs   | Skills     | Router     |
| ----------------------- | ---------- | ---------- | ---------- | ---------- |
| Distributed development | ⭐⭐⭐⭐⭐ | —          | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     |
| Parallelization         | ⭐⭐⭐⭐⭐ | —          | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ |
| Multi-hop               | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | —          |
| Direct user interaction | ⭐         | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     |

### Performance Comparison

| Pattern       | One-shot | Repeat Request | Multi-domain (3 agents) |
| ------------- | -------- | -------------- | ----------------------- |
| **Subagents** | 4 calls  | 8 calls (4+4)  | 5 calls, ~9K tokens     |
| **Handoffs**  | 3 calls  | 5 calls (3+2)  | 7+ calls, ~14K+ tokens  |
| **Skills**    | 3 calls  | 5 calls (3+2)  | 3 calls, ~15K tokens    |
| **Router**    | 3 calls  | 6 calls (3+3)  | 5 calls, ~9K tokens     |

**Key insights:**

- **Handoffs/Skills** are most efficient for repeated requests (stateful - saves calls on subsequent turns)
- **Subagents/Router** are most efficient for multi-domain queries (parallel execution, context isolation)
- **Subagents** has extra overhead per request (results flow back through main agent) but provides centralized control

---

## 1. Subagents Pattern

A central **supervisor agent** coordinates specialized **subagents** by calling them as tools.

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPERVISOR AGENT                         │
│                                                             │
│  "Route customer request to appropriate specialist"         │
│                                                             │
│  Tools: [call_billing_agent, call_shipping_agent, ...]      │
└─────────────────────────────────────────────────────────────┘
                    │                    │
         tool call  │                    │  tool call
                    ▼                    ▼
        ┌─────────────────┐    ┌─────────────────┐
        │ Billing Agent   │    │ Shipping Agent  │
        │ (subagent)      │    │ (subagent)      │
        │                 │    │                 │
        │ Tools: [...]    │    │ Tools: [...]    │
        └─────────────────┘    └─────────────────┘
```

### Key Characteristics

- **Centralized control**: All routing passes through the main agent
- **No direct user interaction**: Subagents return results to main agent, not user
- **Subagents via tools**: Subagents are invoked via tools
- **Parallel execution**: Main agent can invoke multiple subagents in a single turn
- **Stateless subagents**: Don't remember past interactions; all memory in main agent
- **Context isolation**: Each subagent works in clean context window

### When to Use

- Multiple distinct domains (e.g., calendar, email, CRM, database)
- Subagents don't need to converse directly with users
- Want centralized workflow control
- Need parallel execution of specialists

### Implementation

```typescript
import { createAgent, tool } from 'langchain';
import { z } from 'zod';

// Create a subagent
const billingAgent = createAgent({
  model: 'anthropic:claude-sonnet-4-20250514',
  tools: [lookupInvoice, processRefund],
  prompt: 'You are a billing specialist...',
});

// Wrap subagent as a tool for the supervisor
const callBillingAgent = tool(
  async ({ query }) => {
    const result = await billingAgent.invoke({
      messages: [{ role: 'user', content: query }],
    });
    return result.messages.at(-1)?.content;
  },
  {
    name: 'billing_specialist',
    description: 'Handle billing inquiries, invoices, refunds',
    schema: z.object({ query: z.string() }),
  }
);

// Supervisor agent with subagents as tools
const supervisorAgent = createAgent({
  model: 'anthropic:claude-sonnet-4-20250514',
  tools: [callBillingAgent, callShippingAgent, callTechSupportAgent],
  prompt: 'Route customer requests to the appropriate specialist...',
});
```

### Design Decisions

#### Sync vs Async Execution

| Mode  | Behavior                                 | Best For                               |
| ----- | ---------------------------------------- | -------------------------------------- |
| Sync  | Main agent waits for subagent            | When result needed to continue         |
| Async | Main agent continues while subagent runs | Independent tasks, user shouldn't wait |

#### Tool Patterns

| Pattern              | Description                              | Trade-off                         |
| -------------------- | ---------------------------------------- | --------------------------------- |
| Tool per agent       | Each subagent wrapped as separate tool   | More setup, more customization    |
| Single dispatch tool | One `task` tool dispatches by agent name | Simpler composition, less control |

**Single dispatch pattern:**

```typescript
const SUBAGENTS = {
  research: researchAgent,
  writer: writerAgent,
};

const task = tool(
  async ({ agentName, description }) => {
    const agent = SUBAGENTS[agentName];
    const result = await agent.invoke({
      messages: [{ role: 'user', content: description }],
    });
    return result.messages.at(-1)?.content;
  },
  {
    name: 'task',
    description: `Launch an ephemeral subagent. Available: research, writer`,
    schema: z.object({
      agentName: z.string(),
      description: z.string(),
    }),
  }
);
```

### Context Engineering

| Category         | Purpose                              | Impacts                |
| ---------------- | ------------------------------------ | ---------------------- |
| Subagent specs   | Ensure correct routing decisions     | Main agent routing     |
| Subagent inputs  | Ensure subagents execute well        | Subagent performance   |
| Subagent outputs | Ensure supervisor can act on results | Main agent performance |

**Subagent outputs tip**: Prompt subagents to include results in final message, or format response in code before returning.

---

## 2. Handoffs Pattern

Agents **transfer control** to each other via tool calls. State persists across turns.

```
┌─────────────────┐   transfer_to_specialist   ┌─────────────────┐
│ Triage Agent    │ ──────────────────────────▶│ Specialist Agent│
│                 │                            │                 │
│ • Collect info  │                            │ • Resolve issue │
│ • Identify need │                            │ • Can escalate  │
└─────────────────┘                            └─────────────────┘
        │                                              │
        │              Shared Conversation             │
        └──────────────────────────────────────────────┘
```

### Key Characteristics

- **State-driven behavior**: Behavior changes based on state variable
- **Tool-based transitions**: Tools update state to move between states
- **Direct user interaction**: Each state's configuration handles user messages directly
- **Persistent state**: State survives across conversation turns

### When to Use

- Enforce sequential constraints (unlock capabilities only after preconditions met)
- Agent needs to converse directly with user across different states
- Building multi-stage conversational flows
- Customer support scenarios (collect info before processing)

### Implementation Approaches

#### Single Agent with Middleware

One agent changes behavior based on state. Middleware adjusts system prompt and tools dynamically.

```typescript
import { tool, createAgent, wrapModelCall } from 'langchain';
import { Command } from '@langchain/langgraph';
import { ToolMessage } from 'langchain/messages';
import { z } from 'zod';

// State schema
const SupportState = z.object({
  currentStep: z.string().default('triage'),
  warrantyStatus: z.string().optional(),
});

// Tool that transitions to next step
const recordWarrantyStatus = tool(
  async ({ status }, config) => {
    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: `Warranty status recorded: ${status}`,
            tool_call_id: config.toolCall?.id!,
          }),
        ],
        warrantyStatus: status,
        currentStep: 'specialist', // Triggers transition
      },
    });
  },
  {
    name: 'record_warranty_status',
    description: 'Record warranty status and transition to specialist',
    schema: z.object({ status: z.string() }),
  }
);

// Middleware applies config based on current step
const applyStepConfig = wrapModelCall(async (request, handler) => {
  const step = request.state.currentStep || 'triage';

  const configs = {
    triage: {
      prompt: 'Collect warranty information before proceeding...',
      tools: [recordWarrantyStatus],
    },
    specialist: {
      prompt: `Provide solutions. Warranty: ${request.state.warrantyStatus}`,
      tools: [provideSolution, escalateToHuman],
    },
  };

  const config = configs[step];
  request = request.override({
    systemPrompt: config.prompt,
    tools: config.tools,
  });
  return handler(request);
});

const agent = createAgent({
  model,
  tools: [recordWarrantyStatus, provideSolution, escalateToHuman],
  stateSchema: SupportState,
  middleware: [applyStepConfig],
  checkpointer: new InMemorySaver(), // Persist state across turns
});
```

#### Multiple Agent Subgraphs

Distinct agents as separate graph nodes. Handoff tools navigate between nodes.

```typescript
import { tool, ToolRuntime } from '@langchain/core/tools';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { z } from 'zod';

const transferToSales = tool(
  async (_, { runtime }: { runtime: ToolRuntime }) => {
    const lastAiMessage = [...runtime.state.messages]
      .reverse()
      .find((msg): msg is AIMessage => msg instanceof AIMessage);

    const transferMessage = new ToolMessage({
      content: 'Transferred to sales agent',
      tool_call_id: runtime.toolCallId,
    });

    return new Command({
      goto: 'sales_agent',
      update: {
        activeAgent: 'sales_agent',
        messages: [lastAiMessage, transferMessage].filter(Boolean),
      },
      graph: Command.PARENT,
    });
  },
  {
    name: 'transfer_to_sales',
    description: 'Transfer to the sales agent.',
    schema: z.object({}),
  }
);
```

### Context Engineering for Handoffs

When handing off between agents, ensure valid conversation history:

1. Include the `AIMessage` containing the tool call
2. Include a `ToolMessage` acknowledging the handoff

Without this pairing, the receiving agent sees incomplete conversation.

**Tip**: Pass only the handoff pair, not full subagent history. Summarize if needed.

---

## 3. Skills Pattern

A **single agent** loads specialized prompts/knowledge **on-demand** via tools.

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN AGENT                             │
│                                                             │
│  Tool: load_skill(skill_name)                               │
│                                                             │
│  Loaded Skills: [sql_expert, legal_reviewer]                │
│  (Prompts added to context)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                    load_skill│
                              ▼
              ┌───────────────────────────────┐
              │         SKILL REGISTRY        │
              │                               │
              │  • sql_expert: "You are..."   │
              │  • legal_reviewer: "You are..." │
              │  • data_analyst: "You are..." │
              └───────────────────────────────┘
```

### Key Characteristics

- **Prompt-driven specialization**: Skills are primarily defined by specialized prompts
- **Progressive disclosure**: Skills become available based on context or user needs
- **Team distribution**: Different teams can develop and maintain skills independently
- **Lightweight composition**: Skills are simpler than full subagents
- **Single agent stays in control**: Just loads additional context

### When to Use

- Single agent with many possible specializations
- Don't need to enforce specific constraints between skills
- Different teams need to develop capabilities independently
- Examples: coding assistants (different languages), knowledge bases (different domains)

### Implementation

```typescript
import { tool, createAgent } from 'langchain';
import { z } from 'zod';

// Skill registry
const SKILLS = {
  write_sql: {
    prompt: `You are a SQL expert. When writing queries:
      - Use parameterized queries to prevent injection
      - Optimize for readability
      - Include comments for complex logic`,
    tools: [executeQuery, explainQuery],
  },
  review_legal_doc: {
    prompt: `You are a legal document reviewer. Focus on:
      - Identifying key terms and obligations
      - Highlighting potential risks
      - Summarizing in plain language`,
    tools: [extractClauses, summarizeDocument],
  },
};

const loadSkill = tool(
  async ({ skillName }) => {
    const skill = SKILLS[skillName];
    if (!skill) return `Skill '${skillName}' not found`;

    return JSON.stringify({
      loaded: true,
      prompt: skill.prompt,
      availableTools: skill.tools.map((t) => t.name),
    });
  },
  {
    name: 'load_skill',
    description: `Load a specialized skill. Available: ${Object.keys(SKILLS).join(', ')}`,
    schema: z.object({
      skillName: z.string().describe('Name of skill to load'),
    }),
  }
);

const agent = createAgent({
  model: 'gpt-4o',
  tools: [loadSkill],
  prompt:
    'You are a helpful assistant. Use load_skill to access specialized capabilities.',
});
```

### Extending the Pattern

- **Dynamic tool registration**: Loading a skill can also register new tools
- **Hierarchical skills**: Skills can define sub-skills in a tree structure

---

## 4. Router Pattern

A **routing step** classifies input and directs to specialized agents.

```
                         User Query
                              │
                              ▼
              ┌───────────────────────────────┐
              │           ROUTER              │
              │                               │
              │  Classify → [billing, tech]   │
              └───────────────────────────────┘
                    │                 │
         parallel   │                 │   parallel
                    ▼                 ▼
          ┌─────────────────┐  ┌─────────────────┐
          │ Billing Agent   │  │ Tech Agent      │
          └─────────────────┘  └─────────────────┘
                    │                 │
                    └────────┬────────┘
                             ▼
              ┌───────────────────────────────┐
              │         SYNTHESIZER           │
              │                               │
              │  Combine results into answer  │
              └───────────────────────────────┘
```

### Key Characteristics

- **Router decomposes the query**: Classification step determines which agents to invoke
- **Zero or more agents invoked in parallel**: Can fan-out to multiple specialists
- **Results synthesized**: Combine agent responses into coherent answer
- **Stateless by default**: Each request routed independently

### When to Use

- Distinct verticals (separate knowledge domains)
- Need to query multiple sources in parallel
- Want to synthesize results from multiple agents
- RAG-style multi-source knowledge bases

### Implementation

```typescript
import { Command, Send, StateGraph, START, END } from '@langchain/langgraph';

interface ClassificationResult {
  query: string;
  agent: string;
}

function classifyQuery(query: string): ClassificationResult[] {
  // Use LLM to classify query and determine which agents to invoke
  return [
    { query: 'billing portion', agent: 'billing_agent' },
    { query: 'tech portion', agent: 'tech_agent' },
  ];
}

// Router node - fan out to multiple agents using Send
function routeQuery(state: typeof State.State) {
  const classifications = classifyQuery(state.query);

  // Fan out to selected agents in parallel
  return classifications.map((c) => new Send(c.agent, { query: c.query }));
}

// Single agent routing using Command
function routeToSingleAgent(state: typeof State.State) {
  const classification = classifyQuery(state.query)[0];
  return new Command({ goto: classification.agent });
}

// Build graph
const builder = new StateGraph(State)
  .addNode('router', routeQuery)
  .addNode('billing_agent', billingAgent)
  .addNode('tech_agent', techAgent)
  .addNode('synthesizer', synthesizeResults)
  .addEdge(START, 'router')
  .addEdge('billing_agent', 'synthesizer')
  .addEdge('tech_agent', 'synthesizer')
  .addEdge('synthesizer', END);
```

### Stateless vs Stateful

| Approach         | Description                                  | Use Case                       |
| ---------------- | -------------------------------------------- | ------------------------------ |
| Stateless        | Each request routed independently            | Simple classification          |
| Tool wrapper     | Wrap router as tool for conversational agent | Add memory to stateless router |
| Full persistence | Router itself maintains state                | Complex multi-turn routing     |

**Tool wrapper approach:**

```typescript
const searchDocs = tool(
  async ({ query }) => {
    const result = await workflow.invoke({ query });
    return result.finalAnswer;
  },
  {
    name: 'search_docs',
    description: 'Search across multiple documentation sources',
    schema: z.object({ query: z.string() }),
  }
);

// Conversational agent uses router as a tool
const conversationalAgent = createAgent({
  model,
  tools: [searchDocs],
  prompt: 'You are a helpful assistant. Use search_docs to answer questions.',
});
```

---

## Mapping Patterns to Use Cases

| Use Case                           | Recommended Pattern | Why                                                |
| ---------------------------------- | ------------------- | -------------------------------------------------- |
| Customer support with stages       | **Handoffs**        | Sequential flow, collect info before acting        |
| Multi-department routing           | **Subagents**       | Parallel specialists, centralized control          |
| FAQ bot with many topics           | **Skills**          | Load topic-specific knowledge on demand            |
| Knowledge base search              | **Router**          | Query multiple sources in parallel, synthesize     |
| Sales qualification funnel         | **Handoffs**        | Must complete stages in order                      |
| Technical support with specialists | **Subagents**       | Route to billing/shipping/tech as needed           |
| Legal document analysis            | **Skills**          | Load contract/compliance/IP skills as needed       |
| Multi-language support             | **Skills**          | Load language-specific prompts                     |
| Order status + Product info        | **Router**          | Query order system and product catalog in parallel |

---

## Hybrid Approaches

Patterns can be combined:

### 1. Handoffs + Subagents

Main agent uses handoffs for stages, calls subagents for specialized tasks within a stage.

### 2. Router + Skills

Router dispatches to domain agents, each loads skills as needed.

### 3. Subagents + Skills

Supervisor coordinates subagents, subagents use skills for specialization.

### Example: Customer Support Hybrid

```
┌─────────────────────────────────────────────────────────────┐
│                    TRIAGE AGENT (Handoffs)                  │
│                                                             │
│  Stage 1: Identify customer, collect basic info             │
│  Stage 2: Classify issue type                               │
│  Stage 3: Route to specialist                               │
└─────────────────────────────────────────────────────────────┘
                              │
                   handoff_to_agent
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  SUPERVISOR (Subagents)                     │
│                                                             │
│  Tools: [billing_specialist, tech_specialist, ...]          │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
        ┌─────────────────┐    ┌─────────────────┐
        │ Billing Agent   │    │ Tech Agent      │
        │ (Skills)        │    │ (Skills)        │
        │                 │    │                 │
        │ load_skill:     │    │ load_skill:     │
        │ • refunds       │    │ • troubleshoot  │
        │ • invoicing     │    │ • diagnostics   │
        └─────────────────┘    └─────────────────┘
```

---

## References

- [Multi-Agent Overview](https://docs.langchain.com/oss/javascript/langchain/multi-agent)
- [Subagents Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents)
- [Handoffs Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/handoffs)
- [Skills Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/skills)
- [Router Pattern](https://docs.langchain.com/oss/javascript/langchain/multi-agent/router)
- [Custom Workflow](https://docs.langchain.com/oss/javascript/langchain/multi-agent/custom-workflow)
- [Context Engineering](https://docs.langchain.com/oss/javascript/langchain/context-engineering)
