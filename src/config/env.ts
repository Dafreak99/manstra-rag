import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  PREMIUM_MODEL: z.string().optional(),
  DEFAULT_MODEL: z.string().optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
})

const rawEnv = envSchema.parse(process.env)

/**
 * Determines which provider to use based on available API keys
 * Priority: Anthropic > OpenRouter
 */
export function getProvider(): 'anthropic' | 'openrouter' {
  if (rawEnv.ANTHROPIC_API_KEY) {
    return 'anthropic'
  }
  if (rawEnv.OPENROUTER_API_KEY) {
    return 'openrouter'
  }
  // Default to openrouter even without key (might be set elsewhere)
  return 'openrouter'
}

/**
 * Normalizes OpenRouter model names to ensure they have the 'openrouter/' prefix
 */
function normalizeOpenRouterModel(
  model: string | undefined,
  defaultModel: string,
): string {
  if (!model) {
    return defaultModel
  }
  // If model doesn't have the prefix, add it
  if (!model.startsWith('openrouter/')) {
    return `openrouter/${model}`
  }
  return model
}

/**
 * Gets the appropriate model names based on available provider
 */
export function getModelConfig() {
  const provider = getProvider()

  if (provider === 'anthropic') {
    return {
      premium: rawEnv.PREMIUM_MODEL || 'claude-3-5-sonnet-20241022',
      default: rawEnv.DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
    }
  } else {
    // OpenRouter models need the 'openrouter/' prefix
    // Normalize user-provided models to ensure they have the prefix
    return {
      premium: normalizeOpenRouterModel(
        rawEnv.PREMIUM_MODEL,
        'openrouter/x-ai/grok-4.1-fast',
      ),
      default: normalizeOpenRouterModel(
        rawEnv.DEFAULT_MODEL,
        'openrouter/openai/gpt-oss-20b',
      ),
    }
  }
}

const modelConfig = getModelConfig()

export const env = {
  ...rawEnv,
  PREMIUM_MODEL: modelConfig.premium,
  DEFAULT_MODEL: modelConfig.default,
}
