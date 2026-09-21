import { db } from '@/lib/db'
import { parseJson } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Recent = { id: number; mode: string; score: number | null; created_at: string; prompt: string | null }

export default async function StatsPage() {
  const conn = db()

  const byDay = conn
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n
       FROM attempts WHERE created_at > datetime('now','-14 days')
       GROUP BY day ORDER BY day`,
    )
    .all() as { day: string; n: number }[]

  const byMode = conn
    .prepare(
      `SELECT mode, COUNT(*) AS n, ROUND(AVG(score), 2) AS avg_score
       FROM attempts GROUP BY mode ORDER BY n DESC`,
    )
    .all() as { mode: string; n: number; avg_score: number | null }[]

  const recent = conn
    .prepare(
      `SELECT a.id, a.mode, a.score, a.created_at, q.prompt
       FROM attempts a LEFT JOIN questions q ON q.id = a.ref_id AND a.ref_type = 'question'
       WHERE a.mode != 'quiz' ORDER BY a.id DESC LIMIT 10`,
    )
    .all() as Recent[]

  const lapsed = conn
    .prepare(
      `SELECT c.tags AS tags, k.lapses AS lapses FROM cards k
       JOIN bank_cards c ON c.id = k.ref_id WHERE k.ref_type='bank_card' AND k.lapses > 0`,
    )
    .all() as { tags: string; lapses: number }[]

  const tagTotals = new Map<string, number>()
  for (const row of lapsed) {
    for (const t of parseJson<string[]>(row.tags, [])) tagTotals.set(t, (tagTotals.get(t) ?? 0) + row.lapses)
  }
  const weakest = [...tagTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const max = Math.max(1, ...byDay.map((d) => d.n))
  const activeDays = byDay.length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Stats</h1>
        <p className="mt-1 text-sm text-muted">
          {activeDays} active days in the last 14. Below three, the tool is not working for you.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-panel p-5">
        <h2 className="mb-4 text-sm font-medium text-muted">Reps per day</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted">No attempts yet.</p>
        ) : (
          <div className="flex h-24 items-end gap-1">
            {byDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${(d.n / max) * 100}%` }} />
                <span className="text-[10px] text-muted">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-panel p-5">
        <h2 className="mb-3 text-sm font-medium text-muted">By mode</h2>
        <table className="w-full text-sm">
          <tbody>
            {byMode.map((m) => (
              <tr key={m.mode} className="border-t border-border">
                <td className="py-2">{m.mode}</td>
                <td className="py-2 text-right text-muted">{m.n} reps</td>
                <td className="py-2 text-right">{m.avg_score !== null ? `avg ${m.avg_score}` : '—'}</td>
              </tr>
            ))}
            {byMode.length === 0 && (
              <tr>
                <td className="py-2 text-muted">No attempts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {weakest.length > 0 && (
        <section className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-3 text-sm font-medium text-muted">Weakest tags (by lapses)</h2>
          <div className="flex flex-wrap gap-2">
            {weakest.map(([tag, n]) => (
              <span key={tag} className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-sm">
                {tag} <span className="text-bad">{n}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-3 text-sm font-medium text-muted">Recent graded answers</h2>
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="border-t border-border pt-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-muted">{r.prompt ?? r.mode}</span>
                  <span className={r.score && r.score >= 4 ? 'text-good' : r.score && r.score >= 3 ? 'text-warn' : 'text-bad'}>
                    {r.score?.toFixed(1) ?? '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
