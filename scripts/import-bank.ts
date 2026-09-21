/**
 * Imports a question bank from a public markdown README.
 *
 *   npm run import:bank -- ts        # Top 100 TypeScript
 *   npm run import:bank -- js        # 1000 JavaScript
 *   npm run import:bank -- react     # React (MIT)
 *
 * Licensing: these are read into a local SQLite file for personal study and are
 * never redistributed. Banks without an explicit license are marked as such
 * below, and data/ is gitignored so nothing is republished by accident.
 */
import { loadEnv } from '../lib/env'
import { db, toJson } from '../lib/db'
import { parseBank, type BankFormat } from '../lib/banks/parse'
import { pruneCards } from '../lib/scheduler'

loadEnv()

type Source = { slug: string; title: string; url: string; format: BankFormat; license: string }

const SOURCES: Record<string, Source> = {
  // Note: there is no large, complete, English-language TypeScript bank on
  // GitHub. The popular "Top 100 TypeScript" repo publishes only 15 answers and
  // gates the rest behind a signup, so it is not worth importing. The biggest
  // open TS bank is MIT-licensed but written in Ukrainian; it is included for
  // concept recall, with the caveat that drilling it does not practise English.
  'ts-ua': {
    slug: 'typescript-ua',
    title: 'TypeScript Questions (Ukrainian)',
    url: 'https://raw.githubusercontent.com/DevLoversTeam/typescript-interview-questions/main/README.md',
    format: 'details',
    license: 'MIT',
  },
  js: {
    slug: 'javascript-1000',
    title: '1000 JavaScript Questions',
    url: 'https://raw.githubusercontent.com/sudheerj/javascript-interview-questions/master/README.md',
    format: 'sudheerj',
    license: 'no license file (personal study only, do not redistribute)',
  },
  react: {
    slug: 'react-500',
    title: 'React Interview Questions',
    url: 'https://raw.githubusercontent.com/sudheerj/reactjs-interview-questions/master/README.md',
    format: 'sudheerj',
    license: 'MIT',
  },
}

async function main() {
  const key = process.argv[2]
  const source = SOURCES[key]
  if (!source) throw new Error(`usage: npm run import:bank -- <${Object.keys(SOURCES).join('|')}>`)

  const res = await fetch(source.url)
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${source.url}`)
  const cards = parseBank(await res.text(), source.format)
  if (cards.length === 0) throw new Error('parsed 0 cards: the upstream format probably changed')

  const conn = db()
  conn.transaction(() => {
    conn
      .prepare(
        `INSERT INTO banks (slug, title, source_url, license) VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET title = excluded.title, source_url = excluded.source_url,
           license = excluded.license, imported_at = datetime('now')`,
      )
      .run(source.slug, source.title, source.url, source.license)
    const bank = conn.prepare('SELECT id FROM banks WHERE slug = ?').get(source.slug) as { id: number }

    // Replace the cards but leave FSRS state alone: scheduling lives in `cards`,
    // keyed by bank_card id, and ords are stable upstream.
    const insert = conn.prepare(
      `INSERT INTO bank_cards (bank_id, ord, question, answer, tags) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(bank_id, ord) DO UPDATE SET question = excluded.question,
         answer = excluded.answer, tags = excluded.tags`,
    )
    for (const c of cards) insert.run(bank.id, c.ord, c.question, c.answer, toJson(c.tags))

    // Drop cards that no longer exist upstream (or that the parser used to
    // pick up by mistake), so a re-import cleans rather than accumulates.
    const keep = cards.map((c) => c.ord)
    const stale = conn
      .prepare(`DELETE FROM bank_cards WHERE bank_id = ? AND ord NOT IN (${keep.map(() => '?').join(',')})`)
      .run(bank.id, ...keep)
    if (stale.changes > 0) console.log(`pruned ${stale.changes} stale cards`)

    const live = (conn.prepare('SELECT id FROM bank_cards').all() as { id: number }[]).map((r) => r.id)
    const orphaned = pruneCards('bank_card', live)
    if (orphaned > 0) console.log(`pruned ${orphaned} orphaned review records`)
  })()

  const tagCounts = cards
    .flatMap((c) => c.tags)
    .reduce<Record<string, number>>((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {})
  const median = [...cards].sort((a, b) => a.answer.length - b.answer.length)[Math.floor(cards.length / 2)]

  console.log(`imported ${cards.length} cards into "${source.slug}" (${source.license})`)
  console.log(`median answer length: ${median.answer.length} chars`)
  console.log('tags:', Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(' '))
  console.log('\nNow read 20 cards yourself before you drill this bank:  npm run check:bank -- ' + source.slug)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
