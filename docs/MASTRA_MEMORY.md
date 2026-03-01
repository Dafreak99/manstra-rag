# Mastra Memory System Documentation

Based on the official Mastra documentation: [Memory Overview](https://mastra.ai/docs/memory/overview)

## Overview

Mastra's memory system enables agents to remember user messages, agent replies, and tool results across interactions. This provides the context needed for agents to stay consistent, maintain conversation flow, and produce better answers over time.

Mastra supports four complementary memory types that work together to provide comprehensive context management:

1. **Message History** - Recent messages from current conversation
2. **Working Memory** - Persistent, structured user data
3. **Semantic Recall** - Retrieves relevant messages from older conversations based on semantic meaning
4. **Observational Memory** - Background compression of conversations into dense observations

---

## 1. Message History

**Purpose**: Keeps recent messages from the current conversation so they can be rendered in the UI and used to maintain short-term continuity within the exchange.

**Key Characteristics**:
- Stores recent messages from the current conversation thread
- Used for UI rendering and short-term context
- Maintains continuity within a single exchange
- Automatically managed by Mastra

**When to Use**:
- When you need to display recent messages in your UI
- For maintaining short-term conversation continuity
- Basic conversation context without long-term memory needs

**Configuration**:
```typescript
memory: new Memory({
  storage,
  options: {
    lastMessages: 20, // Keep last N messages
  },
})
```

---

## 2. Working Memory

**Purpose**: Stores persistent, structured user data such as names, preferences, and goals.

**Key Characteristics**:
- Stores structured, persistent user data
- Examples: user names, preferences, goals, settings
- Persists across conversations
- Structured format (not just raw messages)

**When to Use**:
- Storing user preferences and settings
- Maintaining user profiles and personal information
- Tracking user goals and objectives
- Any structured data that should persist across sessions

**Use Cases**:
- User preferences (e.g., "prefers dark mode", "language: Spanish")
- Personal information (e.g., "name: John", "location: New York")
- Goals and objectives (e.g., "fitness goal: lose 10 pounds")
- Application state that needs to persist

---

## 3. Semantic Recall

**Purpose**: Retrieves relevant messages from older conversations based on semantic meaning rather than exact keywords, mirroring how humans recall information by association.

**Key Characteristics**:
- Uses semantic similarity, not exact keyword matching
- Requires a vector database (e.g., PgVector, Pinecone)
- Requires an embedding model
- Can retrieve relevant information from any past conversation
- Works like human memory - recalls by meaning/association

**Requirements**:
- **Vector Database**: Must configure a vector store (PgVector, Pinecone, etc.)
- **Embedding Model**: Needs an embedding model to convert text to vectors
- **Storage**: Can use separate vector database or same database with vector support

**When to Use**:
- When you need to recall relevant past conversations
- For context-aware responses based on historical interactions
- When exact keyword matching isn't sufficient
- For RAG (Retrieval-Augmented Generation) applications

**Configuration**:
```typescript
import { PgVector } from '@mastra/pg'

const vector = new PgVector({
  id: 'pg-agent-vector',
  connectionString: process.env.DATABASE_URL!,
})

memory: new Memory({
  storage,
  vector, // Vector store for semantic recall
  options: {
    semanticRecall: true, // Enable semantic recall
  },
})
```

**How It Works**:
1. Messages are converted to embeddings using an embedding model
2. Embeddings are stored in the vector database
3. When generating a response, the query is converted to an embedding
4. Vector database performs similarity search to find relevant past messages
5. Retrieved messages are included in the agent's context

---

## 4. Observational Memory

**Purpose**: Uses background Observer and Reflector agents to maintain a dense observation log that replaces raw message history as it grows, keeping the context window small while preserving long-term memory across conversations.

**Key Characteristics**:
- **Observer Agent**: Runs in the background to compress old messages
- **Reflector Agent**: Creates dense observations from compressed messages
- Automatically compresses conversations as they grow
- Keeps context window small while preserving long-term memory
- Replaces raw message history with dense observations

**How It Works**:
1. As conversations grow, raw message history becomes too large
2. Observer agent runs in the background to compress old messages
3. Reflector agent creates dense observations from compressed content
4. These observations replace raw messages in the context window
5. Long-term memory is preserved in a compact format

**When to Use**:
- Long-running conversations that exceed context limits
- When you need to preserve long-term memory without filling context window
- For applications with extensive conversation history
- When context window size is a concern

**Configuration**:
```typescript
memory: new Memory({
  storage,
  options: {
    observationalMemory: {
      // Uses default model (google/gemini-2.5-flash) or customize
      observation: {
        messageTokens: 20_000, // Threshold for compression
      },
    },
  },
})
```

**Customization**:
- Can specify custom model for Observer and Reflector
- Can configure message token thresholds
- Can adjust compression behavior

---

## Memory Processors

**Purpose**: When combined memory exceeds the model's context limit, memory processors can filter, trim, or prioritize content so the most relevant information is preserved.

**Functions**:
- **Filter**: Remove less relevant information
- **Trim**: Reduce content size while preserving meaning
- **Prioritize**: Ensure most important information is kept

**When to Use**:
- When memory exceeds context window limits
- To optimize which information is included
- To balance between recent and relevant historical context

---

## Storage Configuration

Before enabling memory, you must configure a storage adapter. Mastra supports several databases:

### Supported Storage Providers:
- **PostgreSQL** (with pgvector for semantic recall)
- **MongoDB**
- **LibSQL** (SQLite fork)
- **More options** available in [Storage documentation](https://mastra.ai/docs/memory/storage)

### Storage Configuration Levels:

**Instance Level** (Shared across all agents):
```typescript
import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: 'mastra-storage',
    connectionString: process.env.DATABASE_URL,
  }),
})
```

**Agent Level** (Dedicated per agent):
```typescript
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { PostgresStore, PgVector } from '@mastra/pg'

const storage = new PostgresStore({
  id: 'agent-storage',
  connectionString: process.env.DATABASE_URL!,
})

const vector = new PgVector({
  id: 'agent-vector',
  connectionString: process.env.DATABASE_URL!,
})

export const agent = new Agent({
  memory: new Memory({
    storage, // Agent-specific storage
    vector,  // Agent-specific vector store
  }),
})
```

### Vector Database Options:

For semantic recall, you can use:
- **Same database** with vector support (e.g., PostgreSQL + pgvector)
- **Separate vector database** (e.g., Pinecone alongside PostgreSQL)
- **LibSQL** with vector support

---

## Memory Context in Agent Calls

When calling an agent with memory, you provide a `memory` object with:

- **`resource`**: A stable identifier for the user or entity (e.g., `userId`)
- **`thread`**: An ID that isolates a specific conversation or session (e.g., `chatId`)

```typescript
const response = await agent.generate('Remember my favorite color is blue.', {
  memory: {
    resource: 'user-123',
    thread: 'conversation-123',
  },
})
```

**Important**: Each thread has an owner (`resourceId`) that cannot be changed after creation. Avoid reusing the same thread ID for threads with different owners.

---

## Debugging Memory

When [tracing](https://mastra.ai/docs/observability/tracing/overview) is enabled, you can inspect exactly which messages the agent uses for context in each request.

The trace output shows:
- All memory included in the agent's context window
- Recent message history
- Messages recalled via semantic recall
- How memory retrieval is working

This visibility helps you:
- Understand why an agent made specific decisions
- Verify that memory retrieval is working as expected
- Debug memory-related issues
- Optimize memory configuration

---

## Memory Types Comparison

| Memory Type | Purpose | Persistence | Requires Vector DB | Use Case |
|------------|---------|-------------|-------------------|----------|
| **Message History** | Recent messages | Session-based | No | UI rendering, short-term context |
| **Working Memory** | Structured user data | Persistent | No | User preferences, profiles |
| **Semantic Recall** | Relevant past messages | Persistent | Yes | Context-aware responses |
| **Observational Memory** | Compressed long-term memory | Persistent | No | Long conversations, context limits |

---

## Best Practices

1. **Start Simple**: Begin with message history and working memory, add semantic recall and observational memory as needed

2. **Choose Appropriate Storage**: 
   - Use PostgreSQL + pgvector for production with semantic recall
   - Use LibSQL for simpler setups or development
   - Use separate vector DBs for large-scale applications

3. **Configure at Agent Level**: When agents need different memory configurations, configure storage at the agent level

4. **Monitor Memory Usage**: Use tracing to understand how memory is being used and optimize accordingly

5. **Balance Memory Types**: Combine memory types based on your needs:
   - Message history for recent context
   - Working memory for user data
   - Semantic recall for relevant past conversations
   - Observational memory for long-term compression

---

## References

- [Memory Overview](https://mastra.ai/docs/memory/overview)
- [Message History](https://mastra.ai/docs/memory/message-history)
- [Working Memory](https://mastra.ai/docs/memory/working-memory)
- [Semantic Recall](https://mastra.ai/docs/memory/semantic-recall)
- [Observational Memory](https://mastra.ai/docs/memory/observational-memory)
- [Storage Documentation](https://mastra.ai/docs/memory/storage)
- [Memory Configuration Reference](https://mastra.ai/reference/memory/memory-class)
- [Tracing Documentation](https://mastra.ai/docs/observability/tracing/overview)

---

## Implementation in This Project

In the `manstra` project, we're using:

- **Storage**: PostgreSQL with `PostgresStore`
- **Vector Store**: PgVector for semantic recall
- **Memory Types Enabled**:
  - ✅ Working Memory (last 20 messages)
  - ✅ Semantic Recall (with PgVector)
  - ✅ Observational Memory (automatic compression)

See `src/agent.ts` for the complete configuration.

