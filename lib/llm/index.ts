import { anthropicProvider } from './anthropic'
import { claudeCliProvider } from './claude-cli'
import type { LLMProvider } from './types'

export * from './types'

/** LLM_PROVIDER=claude-cli swaps in the no-API-key path. Default is the SDK. */
export function llm(): LLMProvider {
  return process.env.LLM_PROVIDER === 'claude-cli' ? claudeCliProvider : anthropicProvider
}
