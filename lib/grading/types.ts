import { z } from 'zod'

export const CriterionScore = z.object({
  key: z.string(),
  score: z.number().min(1).max(5),
  /**
   * A verbatim span from the answer that justifies the score. The grader is
   * required to quote; a score with no quote is a score with no reasoning.
   * Use "" only when the answer genuinely lacks any relevant content.
   */
  evidence: z.string(),
  comment: z.string(),
})

export const GradeResult = z.object({
  criteria: z.array(CriterionScore),
  overall: z.number().min(1).max(5),
  strengths: z.array(z.string()),
  /** The single highest-leverage change, phrased as an instruction. */
  fix_next: z.string(),
  /** How an interviewer would most likely follow up on this answer. */
  likely_followup: z.string(),
})
export type GradeResult = z.infer<typeof GradeResult>

export const LanguageNote = z.object({
  type: z.enum(['grammar', 'article', 'tense', 'word_choice', 'filler', 'run_on']),
  original: z.string(),
  suggestion: z.string(),
  note: z.string(),
})

export const LanguageResult = z.object({
  clarity: z.number().min(1).max(5),
  fluency: z.number().min(1).max(5),
  filler_count: z.number().min(0),
  filler_examples: z.array(z.string()),
  notes: z.array(LanguageNote),
  /** The same answer as a strong non-native speaker would land it. Same content, better English. */
  polished: z.string(),
})
export type LanguageResult = z.infer<typeof LanguageResult>

export type Rubric = {
  mode: string
  criteria: { key: string; label: string; anchors: Record<string, string> }[]
}
