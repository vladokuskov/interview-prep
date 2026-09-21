'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { killCard, reviewQuizCard, verifyCard, type SelfGrade } from '@/app/actions'
import type { QuizCard } from '@/lib/session/quiz'

const GRADES: { key: SelfGrade; label: string; hint: string; className: string }[] = [
  { key: 'again', label: 'Again', hint: '1', className: 'border-bad/40 text-bad hover:bg-bad/10' },
  { key: 'hard', label: 'Hard', hint: '2', className: 'border-warn/40 text-warn hover:bg-warn/10' },
  { key: 'good', label: 'Good', hint: '3', className: 'border-good/40 text-good hover:bg-good/10' },
  { key: 'easy', label: 'Easy', hint: '4', className: 'border-accent/40 text-accent hover:bg-accent/10' },
]

export function QuizPlayer({ cards, onFinished }: { cards: QuizCard[]; onFinished?: () => void }) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [tally, setTally] = useState<Record<SelfGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const shownAt = useRef(Date.now())
  const card = cards[index]

  const advance = useCallback(() => {
    setRevealed(false)
    shownAt.current = Date.now()
    setIndex((i) => i + 1)
  }, [])

  const answer = useCallback(
    (self: SelfGrade) => {
      if (!card) return
      setTally((t) => ({ ...t, [self]: t[self] + 1 }))
      void reviewQuizCard(card.id, self, Date.now() - shownAt.current)
      advance()
    },
    [card, advance],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
        return
      }
      if (revealed) {
        const grade = GRADES.find((g) => g.hint === e.key)
        if (grade) {
          e.preventDefault()
          answer(grade.key)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, answer])

  if (!card) {
    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    return (
      <div className="rounded-xl border border-border bg-panel p-8 text-center">
        <p className="text-lg font-medium">Session done</p>
        <p className="mt-2 text-sm text-muted">
          {total} cards. {tally.again} again, {tally.hard} hard, {tally.good} good, {tally.easy} easy.
        </p>
        {tally.again > 0 && (
          <p className="mt-3 text-sm text-muted">
            The {tally.again} you failed are scheduled to come back soon. That is the point, not a problem.
          </p>
        )}
        <button
          onClick={() => onFinished?.() ?? window.location.reload()}
          className="mt-5 rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm hover:border-accent/50"
        >
          Another round
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>
          {index + 1} / {cards.length} · {card.bank}
        </span>
        <span className="flex gap-1.5">
          {card.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-panel-2 px-1.5 py-0.5">
              {t}
            </span>
          ))}
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded bg-panel-2">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-panel p-5 sm:p-6">
        <h2 className="text-lg font-medium leading-snug">{card.question}</h2>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-6 w-full rounded-lg border border-border bg-panel-2 py-3 text-sm text-muted transition hover:border-accent/50 hover:text-fg"
          >
            Show answer <span className="ml-1 opacity-60">(space)</span>
          </button>
        ) : (
          <>
            <div className="prose-card mt-5 max-h-[45vh] overflow-y-auto border-t border-border pt-4 text-sm text-muted">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.answer}</ReactMarkdown>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => answer(g.key)}
                  className={`rounded-lg border bg-panel-2 py-3 text-sm font-medium transition ${g.className}`}
                >
                  {g.label} <span className="ml-1 text-xs opacity-50">{g.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>{card.verified ? 'verified' : 'not yet verified by you'}</span>
              <span className="flex gap-3">
                {!card.verified && (
                  <button onClick={() => void verifyCard(card.id)} className="hover:text-good">
                    mark correct
                  </button>
                )}
                <button
                  onClick={() => {
                    void killCard(card.id)
                    advance()
                  }}
                  className="hover:text-bad"
                >
                  bad card, retire it
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
