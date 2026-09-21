'use server'

import { Rating } from 'ts-fsrs'
import { db, toJson } from '@/lib/db'
import { reviewCard } from '@/lib/scheduler'
import { grade } from '@/lib/grading/grade'
import { reviewLanguage } from '@/lib/grading/language'
import { countWords } from '@/lib/text'
import { scoreToRating } from '@/lib/scheduler'
import type { GradeResult, LanguageResult } from '@/lib/grading/types'

const RATINGS = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const
export type SelfGrade = keyof typeof RATINGS

/** Quiz cards are self-graded: no model call, so a rep costs nothing and is instant. */
export async function reviewQuizCard(cardId: number, self: SelfGrade, durationMs: number) {
  const rating = RATINGS[self]
  reviewCard('bank_card', cardId, rating)
  db()
    .prepare(
      `INSERT INTO attempts (ref_type, ref_id, mode, answer_text, duration_ms, score, transcript_source)
       VALUES ('bank_card', ?, 'quiz', ?, ?, ?, 'self')`,
    )
    .run(cardId, self, durationMs, rating)
  return { ok: true as const }
}

export async function killCard(cardId: number) {
  db().prepare('UPDATE bank_cards SET killed = 1 WHERE id = ?').run(cardId)
  return { ok: true as const }
}

export async function verifyCard(cardId: number) {
  db().prepare('UPDATE bank_cards SET verified = 1 WHERE id = ?').run(cardId)
  return { ok: true as const }
}

export type AnswerFeedback = { grade: GradeResult; language: LanguageResult }

/** Behavioral and design answers: graded by the model, then scheduled from that score. */
export async function submitAnswer(input: {
  questionId: number
  answer: string
  durationMs: number
}): Promise<AnswerFeedback> {
  const question = db().prepare('SELECT * FROM questions WHERE id = ?').get(input.questionId) as
    | { id: number; mode: string; prompt: string; story_id: number | null; tags: string }
    | undefined
  if (!question) throw new Error('question not found')

  const story = question.story_id
    ? (db().prepare('SELECT * FROM stories WHERE id = ?').get(question.story_id) as
        | { title: string; situation: string; task: string; action: string; result: string; metrics: string }
        | undefined)
    : undefined

  const context = story
    ? `The candidate has prepared this story for questions like this one:
Title: ${story.title}
Situation: ${story.situation}
Task: ${story.task}
Action: ${story.action}
Result: ${story.result}
Metrics: ${story.metrics}

Text in [square brackets] is a gap the candidate has not filled in yet. Judge only what they actually said in their answer, not the skeleton.`
    : undefined

  const [graded, language] = await Promise.all([
    grade({ mode: question.mode, prompt: question.prompt, answer: input.answer, context }),
    reviewLanguage(input.answer),
  ])

  db()
    .prepare(
      `INSERT INTO attempts (ref_type, ref_id, mode, answer_text, duration_ms, word_count, score, scores, feedback, language, tags, transcript_source)
       VALUES ('question', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'typed')`,
    )
    .run(
      question.id,
      question.mode,
      input.answer,
      input.durationMs,
      countWords(input.answer),
      graded.overall,
      toJson(graded.criteria),
      toJson({ strengths: graded.strengths, fix_next: graded.fix_next, likely_followup: graded.likely_followup }),
      toJson(language),
      question.tags,
    )

  reviewCard('question', question.id, scoreToRating(graded.overall))
  if (question.story_id) reviewCard('story', question.story_id, scoreToRating(graded.overall))

  return { grade: graded, language }
}

export async function saveStory(input: {
  id: number
  situation: string
  task: string
  action: string
  result: string
  metrics: string
}) {
  db()
    .prepare(
      `UPDATE stories SET situation = ?, task = ?, action = ?, result = ?, metrics = ?,
         updated_at = datetime('now') WHERE id = ?`,
    )
    .run(input.situation, input.task, input.action, input.result, input.metrics, input.id)
  return { ok: true as const }
}
