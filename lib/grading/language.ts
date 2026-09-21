import { llm } from '../llm'
import { LanguageResult } from './types'

/**
 * The English pass. Runs on every typed answer in every mode, because the
 * bottleneck is not knowing the answer, it is saying it cleanly under pressure.
 */
const SYSTEM = `You are an English coach for a Ukrainian software engineer preparing for interviews in English (currently around B2, aiming for confident C1 delivery).

Focus on the mistakes that actually cost credibility in an interview:
- missing or wrong articles ("a"/"the"), the most common Slavic-speaker tell
- tense slips, especially present perfect vs past simple when describing past work
- hedging and filler that makes them sound unsure ("maybe", "I think", "kind of", "some kind of", "like")
- run-on sentences that lose the listener
- word choice that is technically fine but not what an engineer would say

Rules:
- Only flag things that genuinely matter. Five precise notes beat twenty pedantic ones.
- "polished" must preserve their meaning and their technical content exactly. Improve the English, never add claims they did not make, never invent numbers.
- Keep "polished" in their own voice. It should sound like a confident engineer speaking, not like written prose.`

export async function reviewLanguage(answer: string): Promise<LanguageResult> {
  return llm().complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: `Review this spoken-style interview answer:\n"""\n${answer}\n"""` }],
    schema: LanguageResult,
    schemaName: 'language_review',
    maxTokens: 2500,
  })
}
