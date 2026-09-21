import Link from 'next/link'
import { listBanks, pickCards, weakTags, ensureCards, type QuizMode } from '@/lib/session/quiz'
import { QuizPlayer } from '@/components/QuizCard/QuizPlayer'
import { dueCards } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'

type Search = { mode?: string; bank?: string; tag?: string; n?: string }

export default async function QuizPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const mode = (params.mode ?? '') as QuizMode | ''
  const banks = listBanks()
  const weak = weakTags()
  const due = dueCards('bank_card', 500).length

  if (!mode) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Quiz cards</h1>
          <p className="mt-1 text-sm text-muted">
            {banks.reduce((n, b) => n + b.cards, 0)} cards. Progress below is percent mastered, not percent seen.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            href="/drill/quiz?mode=due&n=30"
            title="Due now"
            body={due > 0 ? `${due} cards scheduled for today` : 'Nothing due. Try a sprint instead.'}
            disabled={due === 0}
          />
          <ModeCard href="/drill/quiz?mode=rapid&n=60" title="Rapid" body="60 cards, unseen first, no scheduling" />
        </section>

        {weak.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">Weak areas (most lapses)</h2>
            <div className="flex flex-wrap gap-2">
              {weak.map((w) => (
                <Link
                  key={w.tag}
                  href={`/drill/quiz?mode=weak&tag=${encodeURIComponent(w.tag)}&n=25`}
                  className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm transition hover:border-accent/50"
                >
                  {w.tag} <span className="ml-1 text-xs text-bad">{w.lapses}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Banks</h2>
          <div className="space-y-2">
            {banks.map((b) => (
              <Link
                key={b.id}
                href={`/drill/quiz?mode=bank&bank=${b.id}&n=30`}
                className="block rounded-xl border border-border bg-panel p-4 transition hover:border-accent/50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{b.title}</span>
                  <span className="text-xs text-muted">
                    {b.mastered}/{b.cards} mastered
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-panel-2">
                  <div className="h-full bg-good transition-all" style={{ width: `${b.pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">license: {b.license}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    )
  }

  const limit = Math.min(Number(params.n ?? 30) || 30, 100)
  const cards = pickCards({
    mode,
    limit,
    bankId: params.bank ? Number(params.bank) : undefined,
    tag: params.tag,
  })
  ensureCards(cards.map((c) => c.id))

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-panel p-8 text-center">
        <p className="text-sm text-muted">No cards match that selection.</p>
        <Link href="/drill/quiz" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to quiz modes
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link href="/drill/quiz" className="mb-4 inline-block text-xs text-muted hover:text-fg">
        ← quiz modes
      </Link>
      <QuizPlayer cards={cards} />
    </div>
  )
}

function ModeCard({ href, title, body, disabled }: { href: string; title: string; body: string; disabled?: boolean }) {
  const className = `block rounded-xl border p-4 transition ${
    disabled ? 'border-border bg-panel/40 opacity-50' : 'border-border bg-panel hover:border-accent/50'
  }`
  if (disabled) {
    return (
      <div className={className}>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    )
  }
  return (
    <Link href={href} className={className}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </Link>
  )
}
