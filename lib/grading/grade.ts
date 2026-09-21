import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JUDGE_MODEL, llm, type ModelId } from '../llm'
import { GradeResult, type Rubric } from './types'

const cache = new Map<string, Rubric>()

export function loadRubric(mode: string): Rubric {
  const hit = cache.get(mode)
  if (hit) return hit
  const path = join(process.cwd(), 'lib', 'grading', 'rubrics', `${mode}.json`)
  const rubric = JSON.parse(readFileSync(path, 'utf8')) as Rubric
  cache.set(mode, rubric)
  return rubric
}

function renderRubric(rubric: Rubric): string {
  return rubric.criteria
    .map((c) => {
      const anchors = Object.entries(c.anchors)
        .map(([score, text]) => `    ${score} = ${text}`)
        .join('\n')
      return `- ${c.key} (${c.label}):\n${anchors}`
    })
    .join('\n')
}

const SYSTEM = `You are a demanding but fair interview coach grading a practice answer.

Rules you must follow:
1. Score every criterion against the anchor descriptions given. Match the anchor, do not average your feelings.
2. For every criterion, quote a verbatim span from the candidate's answer as evidence. If the answer contains nothing relevant to that criterion, use an empty string and score it low. Never invent a quote.
3. Do not inflate. A 3 means competent-but-unremarkable and should be your most common score. Reserve 5 for answers you would repeat to another interviewer as an example.
4. "fix_next" must be one actionable instruction, not a list and not encouragement.
5. "likely_followup" is the question a real interviewer would most probably ask next, given exactly what was said.`

export async function grade(opts: {
  mode: string
  prompt: string
  answer: string
  context?: string
  model?: ModelId
}): Promise<GradeResult> {
  const rubric = loadRubric(opts.mode)
  const user = [
    `Interview question:\n${opts.prompt}`,
    opts.context ? `Background on the candidate:\n${opts.context}` : '',
    `Candidate's answer:\n"""\n${opts.answer}\n"""`,
    `Grade against these criteria:\n${renderRubric(rubric)}`,
    `Return one entry per criterion, using exactly these keys: ${rubric.criteria.map((c) => c.key).join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await llm().complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
    schema: GradeResult,
    schemaName: 'grade',
    model: opts.model ?? (opts.mode === 'system_design' ? JUDGE_MODEL : undefined),
    maxTokens: 3000,
  })

  return enforceEvidence(result, opts.answer)
}

/**
 * The grader is told to quote verbatim. Models paraphrase anyway, so anything
 * that is not actually present in the answer is dropped rather than shown as
 * though the candidate said it.
 */
export function enforceEvidence(result: GradeResult, answer: string): GradeResult {
  const haystack = normalise(answer)
  return {
    ...result,
    criteria: result.criteria.map((c) => ({
      ...c,
      evidence: c.evidence && haystack.includes(normalise(c.evidence)) ? c.evidence : '',
    })),
  }
}

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
