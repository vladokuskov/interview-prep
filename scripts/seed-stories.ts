/**
 * Turns CV bullets into STAR story skeletons plus the question phrasings that
 * each story answers. The skeletons are drafts: the model only reshapes what
 * the bullet already says, and you fill in the real detail in the UI.
 *
 *   npm run seed:stories
 */
import { z } from 'zod'
import { loadEnv } from '../lib/env'
import { db, parseJson, toJson } from '../lib/db'
import { llm } from '../lib/llm'
import { pruneCards } from '../lib/scheduler'
import type { BulletRow } from '../lib/db/types'

loadEnv()

const Draft = z.object({
  title: z.string().describe('short handle, e.g. "LCP 4.1s -> 1.9s"'),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  metrics: z.string().describe('the measurable outcome, or "" if the bullet has none'),
  tags: z.array(z.string()),
  questions: z.array(z.string()).describe('4-6 real interview question phrasings this story answers'),
})

const SYSTEM = `You turn a CV bullet into a STAR story skeleton for interview practice.

Hard rules:
- Use only what the bullet states. Never invent numbers, company names, team sizes or outcomes.
- Where the bullet does not say something, write a short bracketed prompt for the candidate to fill, e.g. "[what was breaking before?]". These gaps are the point: they are what he needs to recall and rehearse.
- Keep each part to one or two sentences. This is a skeleton he speaks from, not an essay.
- The questions must be phrasings interviewers actually use, not restatements of the bullet.`

async function main() {
  const conn = db()
  const bullets = conn.prepare('SELECT * FROM bullets ORDER BY id').all() as BulletRow[]
  if (bullets.length === 0) throw new Error('no bullets found: run `npm run ingest -- "/path/to/CV.pdf"` first')

  conn.prepare('DELETE FROM questions WHERE source = ?').run('from_cv')
  conn.prepare('DELETE FROM stories').run()

  // Scrap the scheduling history too. SQLite reuses rowids after a bulk delete,
  // so leaving it behind would hand a fresh question someone else's due date.
  const dropped =
    pruneCards('question', (conn.prepare('SELECT id FROM questions').all() as { id: number }[]).map((r) => r.id)) +
    pruneCards('story', [])
  if (dropped > 0) console.log(`cleared ${dropped} stale review records from the previous seed\n`)

  for (const bullet of bullets) {
    const draft = await llm().complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: `CV bullet:\n${bullet.text}` }],
      schema: Draft,
      schemaName: 'story_draft',
      maxTokens: 1500,
    })

    const tags = [...new Set([...parseJson<string[]>(bullet.tags, []), ...draft.tags])]
    const { lastInsertRowid } = conn
      .prepare(
        `INSERT INTO stories (bullet_id, title, situation, task, action, result, metrics, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(bullet.id, draft.title, draft.situation, draft.task, draft.action, draft.result, draft.metrics, toJson(tags))

    const insertQ = conn.prepare(
      "INSERT INTO questions (mode, prompt, tags, source, story_id) VALUES ('behavioral', ?, ?, 'from_cv', ?)",
    )
    for (const q of draft.questions) insertQ.run(q, toJson(tags), lastInsertRowid as number)

    console.log(`  ${draft.title}  (${draft.questions.length} questions)`)
  }

  const counts = conn
    .prepare("SELECT (SELECT COUNT(*) FROM stories) AS s, (SELECT COUNT(*) FROM questions WHERE source='from_cv') AS q")
    .get() as { s: number; q: number }
  console.log(`\nseeded ${counts.s} stories and ${counts.q} question phrasings`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
