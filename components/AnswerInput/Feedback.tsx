'use client'

import type { AnswerFeedback } from '@/app/actions'

const scoreColor = (n: number) => (n >= 4 ? 'text-good' : n >= 3 ? 'text-warn' : 'text-bad')

export function Feedback({ data, rubricLabels }: { data: AnswerFeedback; rubricLabels: Record<string, string> }) {
  const { grade, language } = data
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-muted">Content</h3>
          <span className={`text-2xl font-semibold ${scoreColor(grade.overall)}`}>{grade.overall.toFixed(1)}</span>
        </div>

        <div className="mt-4 space-y-3">
          {grade.criteria.map((c) => (
            <div key={c.key} className="border-t border-border pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{rubricLabels[c.key] ?? c.key}</span>
                <span className={`text-sm font-medium ${scoreColor(c.score)}`}>{c.score}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.comment}</p>
              {c.evidence ? (
                <p className="mt-1.5 border-l-2 border-border pl-3 text-xs italic text-muted/80">“{c.evidence}”</p>
              ) : (
                <p className="mt-1.5 text-xs text-muted/60">no supporting quote in your answer</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs font-medium text-accent">Fix next</p>
          <p className="mt-1 text-sm">{grade.fix_next}</p>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-panel-2 p-3">
          <p className="text-xs font-medium text-muted">They would probably follow up with</p>
          <p className="mt-1 text-sm">{grade.likely_followup}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-muted">English</h3>
          <span className="text-xs text-muted">
            clarity <span className={scoreColor(language.clarity)}>{language.clarity}</span> · fluency{' '}
            <span className={scoreColor(language.fluency)}>{language.fluency}</span> · {language.filler_count} fillers
          </span>
        </div>

        {language.filler_examples.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            fillers: {language.filler_examples.map((f) => `“${f}”`).join(', ')}
          </p>
        )}

        {language.notes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {language.notes.map((n, i) => (
              <li key={i} className="border-t border-border pt-2 text-sm">
                <span className="mr-2 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">{n.type}</span>
                <span className="text-bad/80 line-through">{n.original}</span>
                <span className="mx-1.5 text-muted">→</span>
                <span className="text-good">{n.suggestion}</span>
                <p className="mt-1 text-xs text-muted">{n.note}</p>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-xs text-muted hover:text-fg">
            Same answer in stronger English
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{language.polished}</p>
        </details>
      </section>
    </div>
  )
}
