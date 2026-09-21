import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'prep-test-'))
process.env.PREP_DB_PATH = join(dir, 'test.db')

const { Rating, State } = await import('ts-fsrs')
const { reviewCard, getOrCreateCard, dueCards, isMastered, masteryStats } = await import('./scheduler')
const { db } = await import('./db')

beforeAll(() => {
  db().prepare("INSERT INTO banks (id, slug, title, source_url) VALUES (1, 's', 't', 'u')").run()
  for (let i = 1; i <= 3; i++) {
    db()
      .prepare('INSERT INTO bank_cards (id, bank_id, ord, question, answer) VALUES (?, 1, ?, ?, ?)')
      .run(i, i, `q${i}`, `a${i}`)
  }
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('scheduler', () => {
  it('creates a new card due immediately', () => {
    const card = getOrCreateCard('bank_card', 1)
    expect(card.reps).toBe(0)
    expect(card.state).toBe(State.New)
  })

  it('schedules a failed card sooner than a passed one', () => {
    const now = new Date('2026-09-21T10:00:00Z')
    const again = reviewCard('bank_card', 1, Rating.Again, now)
    const easy = reviewCard('bank_card', 2, Rating.Easy, now)
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(easy.due).getTime())
  })

  it('records a lapse and drops stability when a mastered card is failed', () => {
    let now = new Date('2026-09-21T10:00:00Z')
    // Push card 3 to a genuinely mature state.
    for (let i = 0; i < 6; i++) {
      const card = reviewCard('bank_card', 3, Rating.Easy, now)
      now = new Date(card.due)
    }
    const mature = getOrCreateCard('bank_card', 3)
    expect(isMastered(mature)).toBe(true)

    const lapsed = reviewCard('bank_card', 3, Rating.Again, now)
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.stability).toBeLessThan(mature.stability)
    expect(isMastered(lapsed)).toBe(false)
  })

  it('returns only cards that are actually due', () => {
    const due = dueCards('bank_card', 10, new Date('2026-09-21T10:05:00Z'))
    expect(due.every((c) => new Date(c.due) <= new Date('2026-09-21T10:05:00Z'))).toBe(true)
  })

  it('counts mastery rather than exposure', () => {
    const stats = masteryStats('bank_card', [1, 2, 3])
    expect(stats.total).toBe(3)
    expect(stats.seen).toBe(3)
    expect(stats.mastered).toBeLessThan(3)
  })
})

describe('pruneCards', () => {
  it('drops review state for rows that no longer exist, so rowid reuse cannot inherit it', async () => {
    const { pruneCards } = await import('./scheduler')
    db().prepare('INSERT INTO bank_cards (id, bank_id, ord, question, answer) VALUES (99, 1, 99, ?, ?)').run('q', 'a')
    reviewCard('bank_card', 99, Rating.Easy)
    expect(getOrCreateCard('bank_card', 99).reps).toBe(1)

    db().prepare('DELETE FROM bank_cards WHERE id = 99').run()
    const live = (db().prepare('SELECT id FROM bank_cards').all() as { id: number }[]).map((r) => r.id)
    expect(pruneCards('bank_card', live)).toBe(1)

    // A new row reusing id 99 must start from zero, not inherit the old history.
    db().prepare('INSERT INTO bank_cards (id, bank_id, ord, question, answer) VALUES (99, 1, 99, ?, ?)').run('new', 'a')
    expect(getOrCreateCard('bank_card', 99).reps).toBe(0)
  })
})
