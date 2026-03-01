import { env, getProvider } from './env'

/**
 * Model configuration utility
 *
 * Ensures OpenRouter models have the 'openrouter/' prefix
 * and provides helper functions for model selection
 */

/**
 * Normalizes a model name to ensure OpenRouter models have the prefix
 *
 * Rules:
 * - If using OpenRouter and model doesn't start with 'openrouter/', add the prefix
 * - If using Anthropic, return model as-is (no prefix needed)
 * - If model already has 'openrouter/' prefix, keep it
 */
export function normalizeModelName(model: string): string {
  const provider = getProvider()

  // If using OpenRouter and model doesn't have prefix, add it
  if (provider === 'openrouter' && !model.startsWith('openrouter/')) {
    return `openrouter/${model}`
  }

  // For Anthropic or already-prefixed models, return as-is
  return model
}

/**
 * Gets the premium model, ensuring proper formatting
 */
export function getPremiumModel(): string {
  return normalizeModelName(env.PREMIUM_MODEL)
}

/**
 * Gets the default model, ensuring proper formatting
 */
export function getDefaultModel(): string {
  return normalizeModelName(env.DEFAULT_MODEL)
}

/**
 * Checks if a model name is an OpenRouter model
 */
export function isOpenRouterModel(model: string): boolean {
  return model.startsWith('openrouter/')
}

/**
 * Checks if a model name is an Anthropic model
 */
export function isAnthropicModel(model: string): boolean {
  return model.startsWith('claude-') || model.includes('anthropic')
}
