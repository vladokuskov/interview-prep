'use client'

import { useState } from 'react'
import { submitAnswer, type AnswerFeedback } from '@/app/actions'
import { TextAnswerInput, type AnswerPayload } from './AnswerInput/TextAnswerInput'
import { Feedback } from './AnswerInput/Feedback'

export type DrillQuestion = {
  id: number
  prompt: string
  storyTitle: string | null
  storyGaps: string[]
}

export function BehavioralDrill({
  question,
  rubricLabels,
  onNext,
}: {
  question: DrillQuestion
  rubricLabels: Record<string, string>
  onNext: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnswerFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [peeked, setPeeked] = useState(false)

  const handle = async (payload: AnswerPayload) => {
    setBusy(true)
    setError(null)
    try {
      setResult(await submitAnswer({ questionId: question.id, answer: payload.text, durationMs: payload.durationMs }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'grading failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-panel p-5">
        {question.storyTitle && <p className="mb-2 text-xs text-muted">story: {question.storyTitle}</p>}
        <h2 className="text-lg font-medium leading-snug">{question.prompt}</h2>
      </div>

      {!result && (
        <>
          {question.storyGaps.length > 0 && (
            <div>
              <button onClick={() => setPeeked((p) => !p)} className="text-xs text-muted hover:text-fg">
                {peeked ? 'hide' : 'stuck? show'} the gaps in this story ({question.storyGaps.length})
              </button>
              {peeked && (
                <ul className="mt-2 space-y-1 rounded-lg border border-border bg-panel-2 p-3 text-xs text-muted">
                  {question.storyGaps.map((g, i) => (
                    <li key={i}>· {g}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <TextAnswerInput onSubmit={handle} busy={busy} />
        </>
      )}

      {error && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
          {error.includes('ANTHROPIC_API_KEY') && ' — add it to .env.local and restart the dev server.'}
        </p>
      )}

      {result && (
        <>
          <Feedback data={result} rubricLabels={rubricLabels} />
          <button
            onClick={onNext}
            className="w-full rounded-lg border border-border bg-panel-2 py-3 text-sm transition hover:border-accent/50"
          >
            Next question
          </button>
        </>
      )}
    </div>
  )
}
