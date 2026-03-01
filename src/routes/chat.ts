import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { memoryAgent } from '../agent.js'

const chatRouter = new Hono()

/**
 * POST /chat/message
 *
 * Main endpoint for sending messages to Wingman AI using Mastra agent memory.
 *
 * Request flow:
 * 1. Receive message with resource (userId) and thread (chatId)
 * 2. Call Mastra agent with memory context
 * 3. Agent automatically:
 *    - Retrieves relevant past messages (working memory)
 *    - Retrieves semantic memories (semantic recall)
 *    - Uses observational memory for long conversations
 * 4. Return agent response
 */
const messageSchema = z.object({
  userId: z.string().uuid(),
  chatId: z.string().uuid(),
  message: z.string().min(1),
})

chatRouter.post('/message', zValidator('json', messageSchema), async (c) => {
  try {
    const { userId, chatId, message } = c.req.valid('json')

    // Call Mastra agent with memory context
    // The agent automatically handles:
    // - Working memory (last N messages)
    // - Semantic recall (relevant past messages)
    // - Observational memory (compressed long-term context)
    const response = await memoryAgent.generate(message, {
      memory: {
        resource: userId,
        thread: chatId,
      },
    })

    return c.json({
      message: response.text,
      usage: response.usage,
    })
  } catch (error) {
    console.error('Error processing chat message:', error)
    return c.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * GET /chat/history
 *
 * Retrieve conversation history for a thread.
 * Mastra handles this automatically through memory, but this endpoint
 * can be used to inspect stored messages.
 */
chatRouter.get(
  '/history',
  zValidator(
    'query',
    z.object({
      userId: z.string().uuid(),
      chatId: z.string().uuid(),
    }),
  ),
  async (c) => {
    try {
      const { userId, chatId } = c.req.valid('query')

      // Mastra memory stores messages automatically
      // You can retrieve them using the memory API if needed
      // For now, we'll return a simple response
      return c.json({
        message: 'History retrieval can be implemented using Mastra memory API',
        userId,
        chatId,
      })
    } catch (error) {
      console.error('Error retrieving history:', error)
      return c.json(
        {
          error: 'Failed to retrieve history',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  },
)

export default chatRouter
