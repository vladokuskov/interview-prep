import 'server-only'
import { db } from '../db'
import { dueCards } from '../scheduler'
import { loadRubric } from '../grading/grade'
import type { QuestionRow, StoryRow } from '../db/types'

export type BehavioralPick = {
  id: number
  prompt: string
  storyTitle: string | null
  storyGaps: string[]
}

/** Square-bracketed placeholders in a seeded story are exactly what he has not rehearsed. */
const gapsIn = (story: StoryRow): string[] =>
  [story.situation, story.task, story.action, story.result]
    .flatMap((part) => part.match(/\[[^\]]+\]/g) ?? [])
    .map((g) => g.slice(1, -1))

export function pickBehavioral(excludeIds: number[] = []): BehavioralPick | null {
  const conn = db()
  const due = dueCards('question', 50)
    .map((c) => c.ref_id)
    .filter((id) => !excludeIds.includes(id))

  const exclusion = excludeIds.length ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
  const question = (
    due.length > 0
      ? conn.prepare(`SELECT * FROM questions WHERE id = ?`).get(due[0])
      : conn
          .prepare(
            `SELECT * FROM questions WHERE mode = 'behavioral' ${exclusion}
             ORDER BY (SELECT reps FROM cards k WHERE k.ref_type='question' AND k.ref_id=questions.id) IS NULL DESC,
                      RANDOM() LIMIT 1`,
          )
          .get(...excludeIds)
  ) as QuestionRow | undefined

  if (!question) return null

  const story = question.story_id
    ? (conn.prepare('SELECT * FROM stories WHERE id = ?').get(question.story_id) as StoryRow | undefined)
    : undefined

  return {
    id: question.id,
    prompt: question.prompt,
    storyTitle: story?.title ?? null,
    storyGaps: story ? gapsIn(story) : [],
  }
}

export function rubricLabels(mode: string): Record<string, string> {
  return Object.fromEntries(loadRubric(mode).criteria.map((c) => [c.key, c.label]))
}
