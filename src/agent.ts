import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { PostgresStore, PgVector } from '@mastra/pg'
import { fastembed } from '@mastra/fastembed'
import { env } from './config/env'
import { normalizeModelName } from './config/model-config.js'

/**
 * Mastra Agent with Memory
 *
 * Configured with:
 * - Working Memory: Last 20 messages for recent context
 * - Observational Memory: Automatic compression of long conversations
 * - Semantic Recall: Enabled with PgVector for similarity search
 *
 * Storage: Uses PostgreSQL for persistence
 * Vector Store: Uses PgVector for semantic recall
 */

// Create storage instance for agent memory
const storage = new PostgresStore({
  id: 'pg-agent-storage',
  connectionString: env.DATABASE_URL!,
})

// Create vector store for semantic recall
const vector = new PgVector({
  id: 'pg-agent-vector',
  connectionString: env.DATABASE_URL!,
})

/**
 * Creates a Mastra agent with memory and specified model
 * This allows dynamic model selection for premium/default routing
 */
function createAgentWithModel(model: string) {
  // Normalize model name to ensure OpenRouter models have prefix
  const normalizedModel = normalizeModelName(model)
  console.log('Creating agent with model:', normalizedModel)
  return new Agent({
    id: 'wingman-memory-agent',
    name: 'Wingman AI Memory Agent',
    instructions: `You are Wingman AI, a helpful and empathetic dating and chat advice assistant.

Your role is to:
- Provide thoughtful, personalized dating and relationship advice
- Help users improve their communication skills in dating contexts
- Remember important details about the user's personality, preferences, and past experiences
- Be supportive, non-judgmental, and encouraging
- Give practical, actionable advice

You maintain context across conversations and remember important details about each user.`,
    memory: new Memory({
      storage,
      vector,
      // Embedder: Use OpenRouter format (same as model)
      embedder: fastembed,
      options: {
        // Working Memory: Keep last N messages for immediate context
        lastMessages: 20,
        // Observational Memory: Automatically compress long conversations
        observationalMemory: {
          model: env.PREMIUM_MODEL,
          observation: {
            messageTokens: 20_000,
          },
        },
        // Semantic Recall: Enabled with PgVector
        semanticRecall: {
          topK: 3, // Retrieve 3 most similar messages
          messageRange: 2, // Include 2 messages before and after each match
          scope: 'resource', // Search within the resource's conversation
        },
      },
    }),
    model: normalizedModel, // Use the normalized model
  })
}

// Default agent (uses DEFAULT_MODEL)
export const memoryAgent = createAgentWithModel(env.DEFAULT_MODEL)

// Export function to get agent with specific model
export function getAgentForModel(model: string) {
  return createAgentWithModel(model)
}
