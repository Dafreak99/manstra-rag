import { Hono } from 'hono'
import { Bot, Context } from 'grammy'
import { env } from '../config/env'
import { getAgentForModel } from '../agent'
import { routeMessage } from '../services/model-router'

// Initialize Telegram bot if token is provided
let bot: Bot | null = null
if (env.TELEGRAM_BOT_TOKEN) {
  console.log('🤖 Initializing Telegram bot with grammy...')
  bot = new Bot(env.TELEGRAM_BOT_TOKEN)
  console.log('✅ Telegram bot initialized')
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN not found in environment variables')
}

/**
 * Helper function to convert Telegram user ID to Mastra resource ID
 * Mastra uses resource/thread pattern for memory isolation
 */
function getResourceId(telegramUserId: number): string {
  // Convert Telegram user ID to a stable string identifier
  return `telegram_${telegramUserId}`
}

/**
 * Helper function to get thread ID for Telegram chat
 * For simplicity, we use one thread per user (their private chat)
 * In production, you might want separate threads for group chats
 */
function getThreadId(telegramChatId: number, telegramUserId: number): string {
  // For private chats, use user ID as thread
  // For group chats, use chat ID
  if (telegramChatId === telegramUserId) {
    return `thread_${telegramUserId}`
  }
  return `thread_${telegramChatId}`
}

/**
 * Helper function to download image from Telegram
 */
async function downloadTelegramImage(
  fileId: string,
): Promise<{ url?: string; data?: string }> {
  if (!bot) {
    throw new Error('Telegram bot not initialized')
  }

  try {
    // Get file info using grammy's API
    const file = await bot.api.getFile(fileId)

    // Construct download URL
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    // Download the file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    // Convert to base64 for storage
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return {
      url: fileUrl,
      data: `data:${contentType};base64,${base64}`,
    }
  } catch (error) {
    console.error('Error downloading Telegram image:', error)
    throw error
  }
}

/**
 * Process incoming Telegram message using Mastra agent
 *
 * Mastra automatically handles:
 * - Working memory (last N messages)
 * - Semantic recall (relevant past messages)
 * - Observational memory (compressed long-term context)
 */
async function processTelegramMessage(
  telegramUserId: number,
  telegramChatId: number,
  messageText: string | undefined,
  photoFileId?: string,
) {
  console.log('🔄 Processing Telegram message with Mastra agent...')

  // Get Mastra resource and thread IDs
  const resourceId = getResourceId(telegramUserId)
  const threadId = getThreadId(telegramChatId, telegramUserId)

  console.log('👤 Resource ID:', resourceId)
  console.log('💬 Thread ID:', threadId)

  // Build message content
  let messageContent = messageText || ''
  let attachments:
    | Array<{ type: string; url?: string; data?: string }>
    | undefined

  // Handle image attachments
  if (photoFileId) {
    try {
      const imageData = await downloadTelegramImage(photoFileId)
      attachments = [
        {
          type: 'image',
          url: imageData.url,
          data: imageData.data,
        },
      ]
      // For multimodal models, we'll pass the image data
      // For now, append image info to message for text-only models
      messageContent = messageContent
        ? `${messageContent}\n[Image attached: ${imageData.url}]`
        : '[Image attached]'
      console.log('🖼️ Image downloaded and attached')
    } catch (error) {
      console.error('Failed to download image:', error)
      // Continue without image attachment
    }
  }

  if (!messageContent.trim() && !photoFileId) {
    throw new Error('No message content or image provided')
  }

  console.log('📝 Message:', messageContent.substring(0, 100))

  // Route to appropriate model based on content
  const routing = routeMessage(
    messageContent,
    attachments,
    env.PREMIUM_MODEL,
    env.DEFAULT_MODEL,
  )
  console.log('🎯 Routing decision:', routing)

  // Get agent with the routed model
  const agent = getAgentForModel(routing.model)
  console.log('🤖 Using model:', routing.model, 'Reason:', routing.reason)

  // Call Mastra agent with memory context
  // The agent automatically handles:
  // - Working memory (last N messages)
  // - Semantic recall (relevant past messages)
  // - Observational memory (compressed long-term context)
  console.log('🤖 Calling Mastra agent...')
  const response = await agent.generate(messageContent, {
    memory: {
      resource: resourceId,
      thread: threadId,
    },
  })

  console.log(
    '✅ Mastra agent response received',
    JSON.stringify(response, null, 2),
  )
  console.log('📊 Usage:', response.usage)

  return {
    message: response.text,
    usage: response.usage,
    model: routing.model,
    routingReason: routing.reason,
  }
}

// Set up message handlers when bot is initialized
if (bot) {
  // Handle text messages
  bot.on('message:text', async (ctx: Context) => {
    console.log('🔄 Handling text message...')

    if (!ctx.chat || !ctx.message) {
      console.error('❌ Missing chat or message in context')
      return
    }

    const chatId = ctx.chat.id
    const userId = ctx.from?.id
    const messageText = ctx.message.text

    console.log('💬 Text message received')
    console.log('👤 User ID:', userId)
    console.log('💬 Chat ID:', chatId)
    console.log('📝 Message text:', messageText?.substring(0, 100))

    if (!userId) {
      console.error('❌ No user ID in message')
      return
    }

    // Skip if it's a command
    if (messageText?.startsWith('/')) {
      console.log('⏭️ Skipping command message')
      return
    }

    try {
      console.log('🚀 Starting message processing...')
      const result = await processTelegramMessage(userId, chatId, messageText)

      console.log('🔍 Result:', {
        messageLength: result.message?.length || 0,
        usage: result.usage,
      })

      // Check if response is empty
      if (!result.message || result.message.trim().length === 0) {
        console.error('❌ Empty response from Mastra agent')
        throw new Error('Mastra agent returned empty response')
      }

      console.log('✅ Message processed successfully')
      console.log('🤖 AI Response:', result.message.substring(0, 100) + '...')

      // Send response back to Telegram
      await ctx.reply(result.message)
      console.log('📤 Response sent to Telegram')
    } catch (error) {
      console.error('❌ Error processing Telegram message:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('Error details:', errorMessage)
      await ctx.reply(
        `Sorry, I encountered an error: ${errorMessage}. Please try again later.`,
      )
    }
  })

  // Handle photo messages
  bot.on('message:photo', async (ctx: Context) => {
    if (!ctx.chat || !ctx.message) {
      console.error('❌ Missing chat or message in context')
      return
    }

    const chatId = ctx.chat.id
    const userId = ctx.from?.id
    const messageText = ctx.message.caption
    const photos = ctx.message.photo

    console.log('🖼️ Photo message received')
    console.log('👤 User ID:', userId)
    console.log('💬 Chat ID:', chatId)
    console.log('📝 Caption:', messageText)
    console.log('🖼️ Has photo:', !!photos)

    if (!userId) {
      console.error('❌ No user ID in message')
      return
    }

    // Get the largest photo (last in array)
    let photoFileId: string | undefined
    if (photos && photos.length > 0) {
      photoFileId = photos[photos.length - 1].file_id
      console.log('📷 Photo file ID:', photoFileId)
    }

    try {
      console.log('🚀 Starting message processing...')
      const result = await processTelegramMessage(
        userId,
        chatId,
        messageText,
        photoFileId,
      )

      console.log('✅ Message processed successfully')
      console.log('🤖 AI Response:', result.message.substring(0, 100) + '...')

      // Send response back to Telegram
      await ctx.reply(result.message)
      console.log('📤 Response sent to Telegram')
    } catch (error) {
      console.error('❌ Error processing Telegram message:', error)
      await ctx.reply(
        'Sorry, I encountered an error processing your message. Please try again later.',
      )
    }
  })

  // Handle errors
  bot.catch((err) => {
    const error =
      err.error instanceof Error ? err.error : new Error(String(err.error))
    console.error('❌ Telegram bot error:', error)
    if (err.ctx) {
      console.error('Context:', err.ctx)
    }
  })

  // Start the bot (using long polling)
  bot.start()
  console.log('👂 Telegram bot listening for messages...')
}

// Export router (mostly empty since we're using polling, not HTTP routes)
const telegramRouter = new Hono()

// Keep a test endpoint for checking bot status
telegramRouter.get('/test', async (c) => {
  return c.json({
    botConfigured: !!bot,
    hasToken: !!env.TELEGRAM_BOT_TOKEN,
    polling: bot ? 'active' : 'inactive',
  })
})

export default telegramRouter
