import type { ZodType } from 'zod'

/** Sonnet handles almost everything; Opus is reserved for design-round judgment. */
export type ModelId = 'claude-sonnet-5' | 'claude-opus-5'

export type Msg = { role: 'user' | 'assistant'; content: string }

export type CompleteOpts<T> = {
  system: string
  messages: Msg[]
  schema: ZodType<T>
  /** Name of the structured result, shown to the model as a tool name. */
  schemaName?: string
  model?: ModelId
  maxTokens?: number
}

export type StreamOpts = {
  system: string
  messages: Msg[]
  model?: ModelId
  maxTokens?: number
}

export type LLMProvider = {
  name: string
  complete<T>(opts: CompleteOpts<T>): Promise<T>
  stream(opts: StreamOpts): AsyncIterable<string>
}

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-5'
export const JUDGE_MODEL: ModelId = 'claude-opus-5'
