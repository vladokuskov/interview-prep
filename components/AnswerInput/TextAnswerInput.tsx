'use client'

import { useEffect, useRef, useState } from 'react'
import { countWords, spokenSeconds } from '@/lib/text'

/**
 * Pressure mode is the point of this component. A timer, a minimum length and
 * no editing after submit is what makes typing practice transfer to speaking.
 *
 * This is also the seam for voice: swap this for a VoiceAnswerInput later and
 * nothing downstream changes, because grading only ever sees a transcript.
 */
export type AnswerPayload = { text: string; durationMs: number }

export function TextAnswerInput({
  onSubmit,
  busy,
  limitSeconds = 90,
  minWords = 60,
}: {
  onSubmit: (payload: AnswerPayload) => void
  busy?: boolean
  limitSeconds?: number
  minWords?: number
}) {
  const [text, setText] = useState('')
  const [started, setStarted] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (started === null) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(id)
  }, [started])

  const words = countWords(text)
  const remaining = Math.max(0, limitSeconds - elapsed)
  const overtime = started !== null && remaining === 0
  const canSubmit = words >= minWords && !busy

  const submit = () => {
    if (!canSubmit) return
    onSubmit({ text, durationMs: started ? Date.now() - started : 0 })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className={overtime ? 'text-bad' : 'text-muted'}>
          {started === null ? `${limitSeconds}s once you start typing` : overtime ? 'over time, wrap up' : `${remaining}s left`}
        </span>
        <span className={words >= minWords ? 'text-good' : 'text-muted'}>
          {words} words · ~{spokenSeconds(words)}s spoken
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded bg-panel-2">
        <div
          className={`h-full transition-all duration-300 ${overtime ? 'bg-bad' : 'bg-accent'}`}
          style={{ width: `${started === null ? 0 : Math.min(100, (elapsed / limitSeconds) * 100)}%` }}
        />
      </div>

      <textarea
        ref={ref}
        value={text}
        disabled={busy}
        onChange={(e) => {
          if (started === null && e.target.value.length > 0) setStarted(Date.now())
          setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
        rows={10}
        placeholder="Answer out loud as you type. Do not polish it, say it the way you would in the room."
        className="mt-3 w-full resize-y rounded-xl border border-border bg-panel p-4 text-sm leading-relaxed outline-none transition placeholder:text-muted/60 focus:border-accent/50 disabled:opacity-60"
      />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted">
          {words < minWords ? `${minWords - words} more words to submit` : 'Cmd+Enter to submit'}
        </p>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm transition enabled:hover:border-accent/50 disabled:opacity-40"
        >
          {busy ? 'Grading…' : 'Submit answer'}
        </button>
      </div>
    </div>
  )
}
