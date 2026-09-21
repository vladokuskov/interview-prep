import { createEmptyCard, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { db } from './db'
import type { CardRow, RefType } from './db/types'

const f = fsrs()

/** A card counts as mastered once FSRS expects it to survive three weeks. */
export const MASTERY_STABILITY_DAYS = 21

export function scoreToRating(score: number): Grade {
  if (score < 2) return Rating.Again
  if (score < 3) return Rating.Hard
  if (score < 4.5) return Rating.Good
  return Rating.Easy
}

function rowToFsrs(row: CardRow): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    learning_steps: row.learning_steps,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

export function getOrCreateCard(refType: RefType, refId: number, now = new Date()): CardRow {
  const conn = db()
  const existing = conn
    .prepare('SELECT * FROM cards WHERE ref_type = ? AND ref_id = ?')
    .get(refType, refId) as CardRow | undefined
  if (existing) return existing

  const fresh = createEmptyCard(now)
  conn
    .prepare(
      `INSERT INTO cards (ref_type, ref_id, due, stability, difficulty, elapsed_days,
         scheduled_days, reps, lapses, learning_steps, state, last_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      refType,
      refId,
      fresh.due.toISOString(),
      fresh.stability,
      fresh.difficulty,
      fresh.elapsed_days,
      fresh.scheduled_days,
      fresh.reps,
      fresh.lapses,
      fresh.learning_steps,
      fresh.state,
    )
  return conn.prepare('SELECT * FROM cards WHERE ref_type = ? AND ref_id = ?').get(refType, refId) as CardRow
}

export function reviewCard(refType: RefType, refId: number, rating: Grade, now = new Date()): CardRow {
  const row = getOrCreateCard(refType, refId, now)
  const next = f.next(rowToFsrs(row), now, rating).card

  db()
    .prepare(
      `UPDATE cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?,
         scheduled_days = ?, reps = ?, lapses = ?, learning_steps = ?, state = ?, last_review = ?
       WHERE ref_type = ? AND ref_id = ?`,
    )
    .run(
      next.due.toISOString(),
      next.stability,
      next.difficulty,
      next.elapsed_days,
      next.scheduled_days,
      next.reps,
      next.lapses,
      next.learning_steps,
      next.state,
      (next.last_review ?? now).toISOString(),
      refType,
      refId,
    )

  return db().prepare('SELECT * FROM cards WHERE ref_type = ? AND ref_id = ?').get(refType, refId) as CardRow
}

export function dueCards(refType: RefType, limit: number, now = new Date()): CardRow[] {
  return db()
    .prepare('SELECT * FROM cards WHERE ref_type = ? AND due <= ? ORDER BY due ASC LIMIT ?')
    .all(refType, now.toISOString(), limit) as CardRow[]
}

export function isMastered(row: CardRow): boolean {
  return row.state === State.Review && row.stability >= MASTERY_STABILITY_DAYS
}

/** Percent mastered, not percent seen. Percent seen is a vanity metric. */
export function masteryStats(refType: RefType, refIds: number[]) {
  if (refIds.length === 0) return { total: 0, seen: 0, mastered: 0, pct: 0 }
  const placeholders = refIds.map(() => '?').join(',')
  const rows = db()
    .prepare(`SELECT * FROM cards WHERE ref_type = ? AND ref_id IN (${placeholders})`)
    .all(refType, ...refIds) as CardRow[]
  const mastered = rows.filter(isMastered).length
  return {
    total: refIds.length,
    seen: rows.filter((r) => r.reps > 0).length,
    mastered,
    pct: Math.round((mastered / refIds.length) * 100),
  }
}

/**
 * Drops scheduling state whose target no longer exists.
 *
 * This matters because SQLite reassigns rowids after a bulk delete: re-running
 * a seed script would otherwise let a brand new question inherit the review
 * history of an unrelated old one, silently corrupting its due date. Seed
 * scripts call this straight after deleting, before inserting replacements.
 */
export function pruneCards(refType: RefType, liveIds: number[]): number {
  const conn = db()
  if (liveIds.length === 0) {
    return conn.prepare('DELETE FROM cards WHERE ref_type = ?').run(refType).changes
  }
  const placeholders = liveIds.map(() => '?').join(',')
  return conn
    .prepare(`DELETE FROM cards WHERE ref_type = ? AND ref_id NOT IN (${placeholders})`)
    .run(refType, ...liveIds).changes
}
