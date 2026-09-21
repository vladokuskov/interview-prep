/**
 * Checks the judge against answers graded by hand. LLM graders inflate and
 * drift, especially after a prompt edit, so run this whenever you touch a
 * rubric or a grading prompt.
 *
 *   npm run eval:grader
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from '../lib/env'
import { grade } from '../lib/grading/grade'

loadEnv()

type Golden = { id: string; prompt: string; answer: string; expected_overall: number; note: string }

const TOLERANCE = 1.0

async function main() {
  const golden = JSON.parse(
    readFileSync(join(process.cwd(), 'evals', 'golden', 'behavioral.json'), 'utf8'),
  ) as Golden[]

  let failures = 0
  let drift = 0

  for (const g of golden) {
    const result = await grade({ mode: 'behavioral', prompt: g.prompt, answer: g.answer })
    const delta = result.overall - g.expected_overall
    drift += delta
    const ok = Math.abs(delta) <= TOLERANCE
    if (!ok) failures++

    const missingQuotes = result.criteria.filter((c) => !c.evidence).length
    console.log(
      `${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${g.id.padEnd(24)} ` +
        `expected ${g.expected_overall.toFixed(1)}  got ${result.overall.toFixed(1)}  ` +
        `(${delta >= 0 ? '+' : ''}${delta.toFixed(1)})  unquoted:${missingQuotes}/${result.criteria.length}`,
    )
    if (!ok) console.log(`     ${g.note}\n     fix_next: ${result.fix_next}`)
  }

  const bias = drift / golden.length
  console.log(`\nmean bias ${bias >= 0 ? '+' : ''}${bias.toFixed(2)} (positive means the judge is being generous)`)
  if (Math.abs(bias) > 0.5) console.log('\x1b[33mBias over 0.5: tighten the rubric anchors before trusting scores.\x1b[0m')

  if (failures > 0) {
    console.log(`\n${failures}/${golden.length} outside the ${TOLERANCE} point tolerance`)
    process.exit(1)
  }
  console.log(`\nall ${golden.length} within ${TOLERANCE} point`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
