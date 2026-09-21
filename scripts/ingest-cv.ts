/**
 * One-shot: CV PDF -> roles, bullets and skills in the database.
 *
 *   npm run ingest -- "/path/to/CV.pdf"
 *
 * Re-running replaces the profile, so editing the PDF and re-ingesting is safe.
 */
import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { loadEnv } from '../lib/env'
import { db, toJson } from '../lib/db'
import { llm } from '../lib/llm'

loadEnv()

const Profile = z.object({
  roles: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      bullets: z.array(
        z.object({
          text: z.string(),
          tags: z.array(z.string()).describe('lowercase topic tags, e.g. ["aws","performance","llm"]'),
        }),
      ),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), category: z.string() })),
})

function pdfText(path: string): string {
  return execFileSync('python3', [
    '-c',
    `import sys
from pypdf import PdfReader
print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))`,
    path,
  ]).toString()
}

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error('usage: npm run ingest -- "/path/to/CV.pdf"')

  const raw = pdfText(path).replace(/\s+/g, ' ').trim()
  console.log(`read ${raw.length} characters from ${path}`)

  const profile = await llm().complete({
    system:
      'Extract structured profile data from a CV. Copy bullet text faithfully, only fixing spacing and ligature artifacts from PDF extraction. Do not summarise, embellish, or invent achievements.',
    messages: [{ role: 'user', content: raw }],
    schema: Profile,
    schemaName: 'profile',
    maxTokens: 6000,
  })

  const conn = db()
  conn.transaction(() => {
    conn.prepare('DELETE FROM bullets').run()
    conn.prepare('DELETE FROM roles').run()
    conn.prepare('DELETE FROM skills').run()

    profile.roles.forEach((role, i) => {
      const { lastInsertRowid } = conn
        .prepare(
          'INSERT INTO roles (company, title, location, start_date, end_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(role.company, role.title, role.location, role.start_date, role.end_date, i)
      const insertBullet = conn.prepare('INSERT INTO bullets (role_id, text, tags) VALUES (?, ?, ?)')
      for (const b of role.bullets) insertBullet.run(lastInsertRowid as number, b.text, toJson(b.tags))
    })

    const insertSkill = conn.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)')
    for (const s of profile.skills) insertSkill.run(s.name, s.category)
  })()

  const bullets = conn.prepare('SELECT COUNT(*) AS n FROM bullets').get() as { n: number }
  console.log(`stored ${profile.roles.length} roles, ${bullets.n} bullets, ${profile.skills.length} skills`)
  console.log('next: npm run seed:stories')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
