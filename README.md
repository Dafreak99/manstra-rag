# Mastra RAG System

A RAG (Retrieval-Augmented Generation) system built with the Mastra framework, featuring built-in agent memory capabilities.

## Overview

This project demonstrates how to build a RAG system using Mastra's agent memory features, eliminating the need for manual memory extraction and storage. Unlike the parent project which uses manual memory management with Postgres and pgvector, this implementation leverages Mastra's built-in memory system.

## Key Features

- **Built-in Agent Memory**: Automatic memory management without manual extraction
- **Working Memory**: Maintains recent message context (last 20 messages)
- **Semantic Recall**: Retrieves past messages based on meaning
- **Observational Memory**: Automatically compresses long conversations to preserve context
- **Simple Setup**: No need for complex memory extraction workers or manual embedding management
- **Telegram Bot Integration**: Full Telegram bot support with automatic memory management

## Architecture

### Memory System

Mastra handles memory automatically through:

1. **Working Memory**: Keeps the last N messages (default: 20) for immediate context
2. **Semantic Recall**: Uses embeddings to retrieve relevant past messages based on query meaning
3. **Observational Memory**: Background compression of old messages into dense observations, keeping context window small while preserving long-term memory

### Storage

Uses LibSQL (SQLite) for storage, which can be configured as:

- In-memory (`:memory:`) - for testing, data lost on restart
- File-based (`file:./data/mastra.db`) - for local persistence
- Remote LibSQL/Turso database - for production deployments

## Setup

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

### Installation

```bash
cd manstra
pnpm install
```

### Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update `.env` with your API keys:

```env
# Primary: Anthropic (if available, will be used)
# Uses Claude models (e.g., claude-3-5-sonnet-20241022)
ANTHROPIC_API_KEY=your_key_here

# Fallback: OpenRouter (used if no Anthropic key)
# Models automatically get 'openrouter/' prefix
# Default models: openrouter/x-ai/grok-4.1-fast (premium), openrouter/openai/gpt-oss-20b (default)
OPENROUTER_API_KEY=your_key_here
```

3. Configure database storage (optional):

```env
# In-memory (default, for testing)
DATABASE_URL=:memory:

# File-based (for local persistence)
DATABASE_URL=file:./data/mastra.db

# Remote LibSQL/Turso
DATABASE_URL=libsql://your-database-url
```

### Running

Development:

```bash
pnpm dev
```

Production:

```bash
pnpm build
pnpm start
```

The server runs on port **3001** by default (configured to avoid conflicts with the parent project on port 3000).

## API Endpoints

### POST `/chat/message`

Send a message to the Wingman AI agent with automatic memory management.

**Request:**

```json
{
  "userId": "uuid-of-user",
  "chatId": "uuid-of-chat-thread",
  "message": "Your message here"
}
```

**Response:**

```json
{
  "message": "Agent response",
  "usage": {
    "promptTokens": 100,
    "completionTokens": 50,
    "totalTokens": 150
  }
}
```

### GET `/chat/history`

Retrieve conversation history for a thread.

**Query Parameters:**

- `userId`: UUID of the user
- `chatId`: UUID of the chat thread

### GET `/health`

Health check endpoint.

### GET `/telegram/test`

Check Telegram bot status and configuration.

## How Memory Works

When you send a message with `userId` and `chatId`:

1. **Working Memory**: Mastra automatically includes the last 20 messages from this thread
2. **Semantic Recall**: Relevant past messages are retrieved based on semantic similarity to the current query
3. **Observational Memory**: For long conversations, old messages are compressed into observations automatically
4. **Storage**: All messages and memories are persisted to the configured storage backend

No manual memory extraction or embedding generation is needed - Mastra handles it all!

## Comparison with Parent Project

| Feature           | Parent Project             | Mastra Project   |
| ----------------- | -------------------------- | ---------------- |
| Memory Storage    | Manual Postgres + pgvector | Automatic LibSQL |
| Memory Extraction | Manual worker process      | Built-in         |
| Embeddings        | Manual generation          | Automatic        |
| Context Building  | Manual service             | Built-in         |
| Setup Complexity  | High                       | Low              |

## Project Structure

```
manstra/
├── src/
│   ├── agent.ts          # Mastra agent configuration with memory
│   ├── mastra.ts         # Main Mastra instance with storage
│   ├── config/
│   │   └── env.ts        # Environment configuration
│   ├── routes/
│   │   ├── chat.ts       # Chat API routes
│   │   └── telegram.ts   # Telegram bot integration
│   └── index.ts          # Server entry point
├── package.json
├── tsconfig.json
├── README.md
└── SETUP.md
```

## Telegram Bot

The project includes full Telegram bot integration. To set it up:

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Add `TELEGRAM_BOT_TOKEN` to your `.env` file
3. Start the server - the bot will automatically start listening for messages

The Telegram bot uses Mastra's memory system, so it automatically remembers context across conversations. Each Telegram user gets their own memory thread, and the bot maintains context seamlessly.

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [Agent Memory Guide](https://mastra.ai/docs/memory/overview)
- [Observational Memory](https://mastra.ai/docs/memory/observational-memory)
- [Semantic Recall](https://mastra.ai/docs/memory/semantic-recall)
