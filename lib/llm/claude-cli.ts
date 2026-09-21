import { spawn } from 'node:child_process'
import { z } from 'zod'
import { DEFAULT_MODEL, type CompleteOpts, type LLMProvider, type StreamOpts } from './types'

/**
 * Fallback provider: shells out to the Claude Code CLI, so it needs no API key
 * and bills against an existing subscription instead.
 *
 * Measured caveat, know this before choosing it: the CLI prepends its own
 * harness context on every invocation. A one-word reply still cost ~20k input
 * tokens with --system-prompt and --tools "" set, and ~37k without them. For
 * per-answer grading the SDK is both cheaper and several seconds faster, so
 * this exists only for getting started without a key.
 */
const MODEL_ALIAS: Record<string, string> = {
  'claude-sonnet-5': 'sonnet',
  'claude-opus-5': 'opus',
}

function run(system: string, prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--output-format', 'json', '--model', MODEL_ALIAS[model] ?? 'sonnet', '--system-prompt', system, '--tools', ''],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`))
      try {
        resolve(JSON.parse(out).result ?? '')
      } catch {
        reject(new Error(`could not parse claude output: ${out.slice(0, 300)}`))
      }
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

/** Models sometimes wrap JSON in prose or fences; pull out the first object. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`no JSON object in response: ${text.slice(0, 200)}`)
  return JSON.parse(candidate.slice(start, end + 1))
}

async function complete<T>(opts: CompleteOpts<T>): Promise<T> {
  const jsonSchema = z.toJSONSchema(opts.schema, { io: 'input' })
  const system = `${opts.system}\n\nRespond with a single JSON object matching this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}`
  const prompt = opts.messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
  const text = await run(system, prompt, opts.model ?? DEFAULT_MODEL)
  return opts.schema.parse(extractJson(text))
}

async function* stream(opts: StreamOpts): AsyncIterable<string> {
  // The CLI has no token-level streaming here, so this yields the whole reply once.
  const prompt = opts.messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
  yield await run(opts.system, prompt, opts.model ?? DEFAULT_MODEL)
}

export const claudeCliProvider: LLMProvider = { name: 'claude-cli', complete, stream }
