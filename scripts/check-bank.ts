/**
 * Prints a random sample of imported cards so you can eyeball parse quality
 * before drilling. A mangled bank teaches you wrong answers, so this is not
 * an optional step.
 *
 *   npm run check:bank -- typescript-100 [count]
 */
import { loadEnv } from '../lib/env'
import { db } from '../lib/db'
import type { BankCardRow } from '../lib/db/types'

loadEnv()

const slug = process.argv[2]
const count = Number(process.argv[3] ?? 20)
if (!slug) throw new Error('usage: npm run check:bank -- <slug> [count]')

const bank = db().prepare('SELECT * FROM banks WHERE slug = ?').get(slug) as { id: number; title: string } | undefined
if (!bank) throw new Error(`no bank "${slug}"`)

const cards = db()
  .prepare('SELECT * FROM bank_cards WHERE bank_id = ? AND killed = 0 ORDER BY RANDOM() LIMIT ?')
  .all(bank.id, count) as BankCardRow[]

for (const c of cards) {
  console.log(`\n\x1b[1m#${c.ord}  ${c.question}\x1b[0m  [${JSON.parse(c.tags).join(', ')}]`)
  console.log(c.answer.slice(0, 400).replace(/\n{2,}/g, '\n'))
  if (c.answer.length > 400) console.log(`  ... (${c.answer.length} chars total)`)
}
console.log(`\n${cards.length} cards sampled from "${bank.title}".`)
console.log('If more than one or two are mangled, fix lib/banks/parse.ts before drilling.')
