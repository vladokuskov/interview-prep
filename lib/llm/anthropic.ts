import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { DEFAULT_MODEL, type CompleteOpts, type LLMProvider, type StreamOpts } from './types'

let _client: Anthropic | null = null

function client(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.')
  }
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Structured output via a single forced tool call. This is far more reliable
 * than asking for JSON in prose and parsing whatever comes back.
 */
async function complete<T>(opts: CompleteOpts<T>): Promise<T> {
  const name = opts.schemaName ?? 'result'
  const jsonSchema = z.toJSONSchema(opts.schema, { io: 'input' }) as Record<string, unknown>

  const res = await client().messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
    tools: [{ name, description: 'Return the result in this exact shape.', input_schema: jsonSchema as never }],
    tool_choice: { type: 'tool', name },
  })

  const block = res.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error(`Model did not return the ${name} tool call`)
  }
  return opts.schema.parse(block.input)
}

async function* stream(opts: StreamOpts): AsyncIterable<string> {
  const res = client().messages.stream({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: opts.messages,
  })
  for await (const event of res) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}

export const anthropicProvider: LLMProvider = { name: 'anthropic', complete, stream }
