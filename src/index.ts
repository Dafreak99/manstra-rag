import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './config/env.js'
import chatRouter from './routes/chat.js'
import telegramRouter from './routes/telegram.js'

/**
 * Mastra RAG Backend
 * 
 * RAG system using Mastra framework with built-in agent memory.
 * 
 * Architecture:
 * - Mastra Agent Memory: Automatic memory management
 *   - Working Memory: Recent message context
 *   - Semantic Recall: Retrieve past messages by meaning
 *   - Observational Memory: Automatic compression of long conversations
 * - No manual memory extraction needed
 * - Storage: PostgreSQL with pgvector for persistence
 */

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    framework: 'Mastra',
  })
})

// Routes
app.route('/chat', chatRouter)
app.route('/telegram', telegramRouter)

// Start server
const port = env.PORT
console.log(`🚀 Mastra RAG server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`)
  console.log(`📦 Using Mastra framework with built-in agent memory`)
  console.log(`💾 Storage: ${env.DATABASE_URL || ':memory:'}`)
})

