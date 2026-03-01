# Mastra Storage Structure Documentation

This document explains how Mastra stores memory data in PostgreSQL.

## Overview

Mastra automatically creates and manages database tables when you configure storage. The structure is managed internally by Mastra, but you can inspect it to understand how your data is stored.

## Database Tables Created by Mastra

When you use `PostgresStore` and `PgVector`, Mastra creates several tables:

### Core Memory Tables

1. **`mastra_messages`** - Stores all messages (user and assistant)
   - `id` - Unique message ID
   - `resource_id` - User/entity identifier (e.g., `telegram_123456`)
   - `thread_id` - Conversation thread identifier (e.g., `thread_123456`)
   - `role` - Message role (`user`, `assistant`, `system`)
   - `content` - Message text content
   - `created_at` - Timestamp
   - `metadata` - Additional metadata (JSONB)

2. **`mastra_memory_embeddings`** - Stores embeddings for semantic recall (if enabled)
   - `id` - Unique embedding ID
   - `resource_id` - User/entity identifier
   - `thread_id` - Conversation thread identifier
   - `content` - Original text content
   - `embedding` - Vector embedding (pgvector type)
   - `created_at` - Timestamp
   - `metadata` - Additional metadata (JSONB)

3. **`mastra_observations`** - Stores compressed observations (if observational memory enabled)
   - `id` - Unique observation ID
   - `resource_id` - User/entity identifier
   - `thread_id` - Conversation thread identifier
   - `content` - Compressed observation content
   - `created_at` - Timestamp
   - `metadata` - Additional metadata (JSONB)

4. **`mastra_working_memory`** - Stores structured working memory data
   - `id` - Unique record ID
   - `resource_id` - User/entity identifier
   - `key` - Memory key (e.g., `user_preference`, `user_name`)
   - `value` - Memory value (JSONB)
   - `updated_at` - Last update timestamp

### Supporting Tables

5. **`mastra_resources`** - Tracks resources (users/entities)
   - `id` - Resource ID
   - `created_at` - Creation timestamp

6. **`mastra_threads`** - Tracks conversation threads
   - `id` - Thread ID
   - `resource_id` - Owner resource ID
   - `created_at` - Creation timestamp
   - `updated_at` - Last update timestamp

## How Data is Organized

### Resource and Thread Pattern

Mastra uses a **resource/thread** pattern to organize memory:

- **Resource** (`resource_id`): A stable identifier for a user or entity
  - Example: `telegram_123456` (Telegram user ID)
  - Example: `user-abc-123` (UUID from your system)
  
- **Thread** (`thread_id`): An ID that isolates a specific conversation
  - Example: `thread_123456` (same as Telegram user ID for private chats)
  - Example: `thread_group_789` (for group chats)
  - Example: `chat-uuid-xyz` (UUID from your system)

### Message Storage Flow

When you call `agent.generate()` with memory:

```typescript
await memoryAgent.generate('My name is John', {
  memory: {
    resource: 'telegram_123456',  // → stored in resource_id
    thread: 'thread_123456',       // → stored in thread_id
  },
})
```

**What happens:**

1. **Message Storage**: 
   - User message stored in `mastra_messages` table
   - `role` = `'user'`
   - `content` = `'My name is John'`
   - `resource_id` = `'telegram_123456'`
   - `thread_id` = `'thread_123456'`

2. **Embedding Creation** (if semantic recall enabled):
   - Text converted to embedding vector
   - Stored in `mastra_memory_embeddings` table
   - Used for future semantic searches

3. **Working Memory** (if structured data detected):
   - Key-value pairs stored in `mastra_working_memory`
   - Example: `key='user_name'`, `value='John'`

4. **Assistant Response**:
   - Assistant message stored in `mastra_messages` table
   - `role` = `'assistant'`
   - `content` = agent's response

## Inspecting Your Database

### Using the Inspection Script

Run the inspection script to see your database structure:

```bash
pnpm db:inspect
```

This will show:
- All tables in your database
- Column schemas for each table
- Row counts
- Sample data from each table
- Vector column information

### Manual Database Inspection

Connect to PostgreSQL:

```bash
# Using docker-compose
docker exec -it manstra-postgres psql -U postgres -d manstra_ai

# Or using psql directly
psql postgresql://postgres:yourpassword@localhost:5434/manstra_ai
```

**View all Mastra tables:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'mastra_%'
ORDER BY table_name;
```

**View messages for a specific user:**
```sql
SELECT 
  id,
  resource_id,
  thread_id,
  role,
  content,
  created_at
FROM mastra_messages
WHERE resource_id = 'telegram_123456'
ORDER BY created_at DESC
LIMIT 20;
```

**View working memory:**
```sql
SELECT 
  resource_id,
  key,
  value,
  updated_at
FROM mastra_working_memory
WHERE resource_id = 'telegram_123456';
```

**View embeddings (if semantic recall enabled):**
```sql
SELECT 
  id,
  resource_id,
  thread_id,
  content,
  created_at
FROM mastra_memory_embeddings
WHERE resource_id = 'telegram_123456'
ORDER BY created_at DESC
LIMIT 10;
```

## Understanding the Structure

### Message History Storage

Messages are stored chronologically in `mastra_messages`:

```
mastra_messages
├── id (UUID)
├── resource_id (text) → "telegram_123456"
├── thread_id (text) → "thread_123456"
├── role (text) → "user" | "assistant" | "system"
├── content (text) → "My name is John"
├── created_at (timestamp)
└── metadata (jsonb) → {"source": "telegram", ...}
```

### Working Memory Storage

Structured data is stored as key-value pairs:

```
mastra_working_memory
├── id (UUID)
├── resource_id (text) → "telegram_123456"
├── key (text) → "user_name" | "user_preference" | "user_goal"
├── value (jsonb) → "John" | {"theme": "dark"} | {"goal": "lose weight"}
└── updated_at (timestamp)
```

### Semantic Recall Storage

Embeddings are stored for similarity search:

```
mastra_memory_embeddings
├── id (UUID)
├── resource_id (text) → "telegram_123456"
├── thread_id (text) → "thread_123456"
├── content (text) → Original message text
├── embedding (vector) → [0.123, -0.456, ...] (1536 dimensions)
├── created_at (timestamp)
└── metadata (jsonb)
```

## How Mastra Retrieves Memory

### Working Memory (lastMessages: 20)

When you call the agent, Mastra:

1. Queries `mastra_messages` table:
   ```sql
   SELECT * FROM mastra_messages
   WHERE resource_id = 'telegram_123456'
     AND thread_id = 'thread_123456'
   ORDER BY created_at DESC
   LIMIT 20
   ```

2. Includes these messages in the agent's context window

### Semantic Recall (if enabled)

When semantic recall is enabled:

1. Converts your query to an embedding
2. Searches `mastra_memory_embeddings` using vector similarity:
   ```sql
   SELECT content, embedding <=> query_embedding as distance
   FROM mastra_memory_embeddings
   WHERE resource_id = 'telegram_123456'
   ORDER BY distance ASC
   LIMIT 5
   ```
3. Retrieves relevant past messages based on semantic similarity
4. Includes them in the agent's context

### Observational Memory (if enabled)

For long conversations:

1. Observer agent compresses old messages
2. Stores compressed observations in `mastra_observations`
3. Replaces raw message history with dense observations
4. Preserves long-term memory in compact format

## Key Points

1. **Automatic Schema Management**: Mastra creates and manages all tables automatically
2. **Resource/Thread Isolation**: Each user and conversation thread is isolated
3. **No Manual Queries Needed**: Mastra handles all storage and retrieval
4. **Structured Storage**: Messages, embeddings, and working memory are stored separately
5. **Metadata Support**: All tables support JSONB metadata for custom data

## Example: How Your Info is Stored

When you send: "My name is John and I love pizza"

**In `mastra_messages`:**
```json
{
  "id": "msg-uuid-123",
  "resource_id": "telegram_123456",
  "thread_id": "thread_123456",
  "role": "user",
  "content": "My name is John and I love pizza",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**In `mastra_memory_embeddings` (if semantic recall enabled):**
```json
{
  "id": "emb-uuid-456",
  "resource_id": "telegram_123456",
  "thread_id": "thread_123456",
  "content": "My name is John and I love pizza",
  "embedding": [0.123, -0.456, 0.789, ...], // 1536 dimensions
  "created_at": "2024-01-15T10:30:00Z"
}
```

**In `mastra_working_memory` (if structured extraction enabled):**
```json
[
  {
    "resource_id": "telegram_123456",
    "key": "user_name",
    "value": "John",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  {
    "resource_id": "telegram_123456",
    "key": "user_preference",
    "value": {"favorite_food": "pizza"},
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

## Next Steps

1. **Run the inspection script**: `pnpm db:inspect` to see your actual database structure
2. **Query your data**: Use the SQL examples above to explore your stored messages
3. **Monitor growth**: Check table sizes to understand storage usage
4. **Customize metadata**: Use metadata fields to store custom information

