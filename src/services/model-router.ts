import {
  getPremiumModel,
  getDefaultModel,
  normalizeModelName,
} from '../config/model-config.js'

/**
 * Model Router Service for Mastra Project
 *
 * Routes requests to appropriate AI models based on message content.
 *
 * Routing logic:
 * - Premium model: images OR complex reasoning detected
 * - Default model: standard text messages
 */

export interface RoutingDecision {
  model: string
  reason: string
}

export interface MessageAnalysis {
  hasImages: boolean
  requiresComplexReasoning: boolean
  messageLength: number
  attachments?: unknown[]
}

/**
 * Analyzes message to determine routing requirements
 */
export function analyzeMessage(
  message: string,
  attachments?: unknown[],
): MessageAnalysis {
  const hasImages =
    attachments?.some((att) => {
      // Check if attachment is an image
      if (typeof att !== 'object' || att === null || !('type' in att)) {
        return false
      }

      const attachmentType = att.type
      return (
        attachmentType === 'image' ||
        (typeof attachmentType === 'string' &&
          attachmentType.startsWith('image/'))
      )
    }) || false

  const messageLength = message.length

  // Heuristics for complex reasoning:
  // - Long messages (>500 chars) often need more reasoning
  // - Questions with multiple parts
  // - Messages containing specific keywords
  const complexReasoningKeywords = [
    'analyze',
    'compare',
    'strategy',
    'plan',
    'complex',
    'multiple',
    'consider',
    'evaluate',
  ]

  const requiresComplexReasoning =
    messageLength > 500 ||
    complexReasoningKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword),
    ) ||
    (message.match(/\?/g) || []).length > 2 // Multiple questions

  return {
    hasImages,
    requiresComplexReasoning,
    messageLength,
    attachments,
  }
}

/**
 * Routes message to appropriate model
 */
export function routeMessage(
  message: string,
  attachments?: unknown[],
  premiumModel?: string,
  defaultModel?: string,
): RoutingDecision {
  const analysis = analyzeMessage(message, attachments)

  // Use normalized model names (ensures OpenRouter models have prefix)
  const premium = premiumModel
    ? normalizeModelName(premiumModel)
    : getPremiumModel()
  const defaultModelName = defaultModel
    ? normalizeModelName(defaultModel)
    : getDefaultModel()

  if (analysis.hasImages) {
    return {
      model: premium,
      reason: 'Message contains images - using premium multimodal model',
    }
  }

  if (analysis.requiresComplexReasoning) {
    return {
      model: premium,
      reason: 'Message requires complex reasoning - using premium model',
    }
  }

  return {
    model: defaultModelName,
    reason: 'Standard text message - using default model',
  }
}
