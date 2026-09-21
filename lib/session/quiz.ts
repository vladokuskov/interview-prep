import 'server-only'
import { db, parseJson } from '../db'
import { dueCards, getOrCreateCard, masteryStats } from '../scheduler'
import type { BankCardRow, BankRow } from '../db/types'

export type QuizCard = {
  id: number
  bank: string
  question: string
  answer: string
  tags: string[]
  verified: boolean
}

export type QuizMode = 'due' | 'rapid' | 'weak' | 'bank'

const toQuiz = (row: BankCardRow & { bank_title: string }): QuizCard => ({
  id: row.id,
  bank: row.bank_title,
  question: row.question,
  answer: row.answer,
  tags: parseJson<string[]>(row.tags, []),
  verified: row.verified === 1,
})

export function listBanks(): (BankRow & { cards: number; mastered: number; pct: number })[] {
  const banks = db().prepare('SELECT * FROM banks ORDER BY title').all() as BankRow[]
  return banks.map((bank) => {
    const ids = (
      db().prepare('SELECT id FROM bank_cards WHERE bank_id = ? AND killed = 0').all(bank.id) as { id: number }[]
    ).map((r) => r.id)
    const stats = masteryStats('bank_card', ids)
    return { ...bank, cards: ids.length, mastered: stats.mastered, pct: stats.pct }
  })
}

/**
 * Picks the next batch of cards.
 *
 * "due" respects FSRS. "rapid" deliberately ignores it: on an evening where you
 * would otherwise do nothing, volume beats optimal scheduling.
 */
export function pickCards(opts: { mode: QuizMode; limit: number; bankId?: number; tag?: string }): QuizCard[] {
  const conn = db()
  const base = `SELECT c.*, b.title AS bank_title FROM bank_cards c JOIN banks b ON b.id = c.bank_id WHERE c.killed = 0`

  if (opts.mode === 'due') {
    const due = dueCards('bank_card', opts.limit)
    if (due.length === 0) return []
    const ids = due.map((d) => d.ref_id)
    const rows = conn
      .prepare(`${base} AND c.id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as (BankCardRow & { bank_title: string })[]
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(toQuiz)
  }

  const clauses: string[] = []
  const params: unknown[] = []
  if (opts.bankId) {
    clauses.push('c.bank_id = ?')
    params.push(opts.bankId)
  }
  if (opts.tag) {
    clauses.push("c.tags LIKE ?")
    params.push(`%"${opts.tag}"%`)
  }
  // Unseen cards first, then random, so a sprint makes visible progress.
  const rows = conn
    .prepare(
      `${base} ${clauses.map((c) => `AND ${c}`).join(' ')}
       ORDER BY (SELECT reps FROM cards k WHERE k.ref_type = 'bank_card' AND k.ref_id = c.id) IS NULL DESC,
                RANDOM() LIMIT ?`,
    )
    .all(...params, opts.limit) as (BankCardRow & { bank_title: string })[]
  return rows.map(toQuiz)
}

export function weakTags(limit = 8): { tag: string; lapses: number }[] {
  const rows = db()
    .prepare(
      `SELECT c.tags AS tags, k.lapses AS lapses
       FROM cards k JOIN bank_cards c ON c.id = k.ref_id
       WHERE k.ref_type = 'bank_card' AND k.lapses > 0`,
    )
    .all() as { tags: string; lapses: number }[]

  const totals = new Map<string, number>()
  for (const row of rows) {
    for (const tag of parseJson<string[]>(row.tags, [])) {
      totals.set(tag, (totals.get(tag) ?? 0) + row.lapses)
    }
  }
  return [...totals.entries()]
    .map(([tag, lapses]) => ({ tag, lapses }))
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, limit)
}

export function ensureCards(ids: number[]) {
  for (const id of ids) getOrCreateCard('bank_card', id)
}
