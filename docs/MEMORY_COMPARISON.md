# Memory Management Comparison

## Original Project vs Mastra Project

### Overview

| Aspect | Original Project | Mastra Project |
|--------|-----------------|----------------|
| **Approach** | Manual memory management | Built-in automatic memory |
| **Complexity** | High (multiple services) | Low (framework handles it) |
| **Code Lines** | ~500+ lines across services | ~70 lines in agent config |
| **Infrastructure** | Postgres + pgvector + Redis + Workers | Postgres + pgvector only |

---

## Memory Architecture

### Original Project (Manual)

**Components:**
1. **Memory Service** (`memory-service.ts`)
   - Manual embedding generation
   - Manual vector similarity search
   - Manual memory storage/retrieval
   - Raw SQL queries for pgvector

2. **Memory Extraction Service** (`memory-extraction-service.ts`)
   - Custom LLM calls to extract memories
   - Manual prompt engineering
   - JSON parsing and validation

3. **Memory Extraction Worker** (`memory-extraction.worker.ts`)
   - Background job queue (BullMQ)
   - Requires Redis
   - Async processing after responses

4. **Context Builder** (`context-builder.ts`)
   - Manual context assembly
   - Combines: summary + recent messages + semantic memories
   - Manual prompt construction

**Flow:**
```
User Message
  ↓
1. Load conversation summary (manual DB query)
  ↓
2. Load last N messages (manual DB query)
  ↓
3. Generate embedding for query (manual)
  ↓
4. Vector similarity search (raw SQL)
  ↓
5. Build context manually
  ↓
6. Call LLM
  ↓
7. Store response (manual)
  ↓
8. Enqueue memory extraction (async worker)
  ↓
9. Worker extracts memory (LLM call)
  ↓
10. Store memory with embedding (manual)
```

### Mastra Project (Automatic)

**Components:**
1. **Agent Configuration** (`agent.ts`)
   - Single file with memory config
   - Framework handles everything

**Flow:**
```
User Message
  ↓
memoryAgent.generate(message, { memory: { resource, thread } })
  ↓
Mastra automatically:
  - Retrieves last 20 messages (working memory)
  - Performs semantic recall (vector search)
  - Uses observational memory (if needed)
  - Generates response
  - Stores messages and embeddings
```

---

## Memory Types

### Original Project

| Type | Implementation | Storage |
|------|---------------|---------|
| **Short-term** | Last N messages from DB | `messages` table |
| **Summary** | Manual LLM extraction | `chats.summary` column |
| **Semantic** | Manual extraction + embedding | `MemoryEmbedding` table with pgvector |

### Mastra Project

| Type | Implementation | Storage |
|------|---------------|---------|
| **Working Memory** | Last 20 messages (automatic) | `mastra_messages` table |
| **Semantic Recall** | Automatic vector search | `mastra_memory_embeddings` table |
| **Observational Memory** | Automatic compression | `mastra_observations` table |
| **Working Memory (structured)** | Key-value storage | `mastra_working_memory` table |

---

## Key Differences

### 1. Memory Extraction

**Original:**
- ✅ Custom extraction logic (full control)
- ✅ Importance scoring by LLM
- ❌ Requires background worker
- ❌ Requires Redis
- ❌ Manual prompt engineering
- ❌ Async processing (delayed)

**Mastra:**
- ✅ Automatic extraction
- ✅ Built-in importance handling
- ✅ No workers needed
- ✅ No Redis needed
- ✅ No prompt engineering
- ✅ Real-time processing

### 2. Embedding Generation

**Original:**
- Manual calls to embedding service
- Manual storage in database
- Manual vector operations

**Mastra:**
- Automatic embedding generation
- Automatic storage
- Automatic vector operations

### 3. Context Building

**Original:**
- Manual assembly of:
  - System role
  - User profile (from memories)
  - Conversation summary
  - Recent messages
  - New message
- Custom prompt construction

**Mastra:**
- Automatic context assembly
- Framework handles all memory types
- No manual prompt building

### 4. Vector Search

**Original:**
- Raw SQL queries with pgvector
- Manual similarity calculation
- Manual filtering by threshold
- Manual result formatting

**Mastra:**
- Automatic vector search
- Built-in similarity calculation
- Automatic filtering
- Automatic result formatting

### 5. Storage

**Original:**
- Manual schema design
- Manual table creation
- Manual migrations
- Custom Drizzle ORM setup

**Mastra:**
- Automatic schema creation
- Automatic migrations
- No manual setup needed

---

## Code Comparison

### Storing a Memory

**Original:**
```typescript
// 1. Extract memory (LLM call)
const extracted = await extractMemory({ conversationHistory, assistantResponse })

// 2. Generate embedding
const embedding = await generateEmbedding(extracted.text)

// 3. Store in database
await db.insert(schema.memoryEmbedding).values({
  userId,
  memoryText: extracted.text,
  embedding,
  importanceScore: extracted.importanceScore,
})
```

**Mastra:**
```typescript
// Automatic - just call the agent
await memoryAgent.generate(message, { memory: { resource, thread } })
// Mastra handles everything automatically
```

### Retrieving Memories

**Original:**
```typescript
// 1. Generate query embedding
const queryEmbedding = await generateEmbedding(query)

// 2. Raw SQL vector search
const results = await pgClient`
  SELECT *, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
  FROM "MemoryEmbedding"
  WHERE "userId" = ${userId}
  ORDER BY similarity DESC
  LIMIT ${limit}
`

// 3. Filter by threshold
const filtered = results.filter(r => r.similarity >= threshold)
```

**Mastra:**
```typescript
// Automatic - semantic recall is built-in
// Just call the agent, it retrieves relevant memories automatically
await memoryAgent.generate(message, { memory: { resource, thread } })
```

---

## Pros & Cons

### Original Project

**Pros:**
- ✅ Full control over extraction logic
- ✅ Custom importance scoring
- ✅ Can fine-tune every step
- ✅ Understand exactly what's happening

**Cons:**
- ❌ High complexity (500+ lines)
- ❌ Requires Redis for workers
- ❌ Manual embedding management
- ❌ Manual vector operations
- ❌ More infrastructure to maintain
- ❌ More code to debug

### Mastra Project

**Pros:**
- ✅ Simple (70 lines)
- ✅ No workers needed
- ✅ No Redis needed
- ✅ Automatic everything
- ✅ Less code to maintain
- ✅ Framework handles edge cases

**Cons:**
- ❌ Less control over extraction
- ❌ Framework abstraction (less visibility)
- ❌ Dependent on Mastra's implementation

---

## When to Use Which?

### Use Original Project If:
- You need custom memory extraction logic
- You want full control over importance scoring
- You need specific extraction patterns
- You're building a custom memory system

### Use Mastra Project If:
- You want simplicity and speed
- You're okay with framework defaults
- You want less infrastructure
- You prefer automatic memory management

---

## Summary

**Original Project:** Manual, customizable, complex
- 500+ lines of code
- Multiple services and workers
- Full control but high maintenance

**Mastra Project:** Automatic, simple, framework-managed
- 70 lines of code
- Single agent configuration
- Less control but zero maintenance

Both achieve similar results, but Mastra does it with 85% less code and zero infrastructure overhead.

