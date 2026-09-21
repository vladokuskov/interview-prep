import Link from 'next/link'
import { db } from '@/lib/db'
import { dueCards } from '@/lib/scheduler'
import { listBanks } from '@/lib/session/quiz'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const conn = db()
  const dueQuiz = dueCards('bank_card', 500).length
  const dueStories = dueCards('question', 200).length
  const banks = listBanks()
  const totalCards = banks.reduce((n, b) => n + b.cards, 0)
  const mastered = banks.reduce((n, b) => n + b.mastered, 0)

  const today = conn
    .prepare("SELECT COUNT(*) AS n FROM attempts WHERE date(created_at) = date('now')")
    .get() as { n: number }
  const streak = conn
    .prepare("SELECT COUNT(DISTINCT date(created_at)) AS n FROM attempts WHERE created_at > datetime('now','-7 days')")
    .get() as { n: number }
  const hasStories = (conn.prepare('SELECT COUNT(*) AS n FROM stories').get() as { n: number }).n > 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-muted">
          {today.n > 0 ? `${today.n} reps today` : 'Nothing yet today'} · {streak.n}/7 days active this week
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Panel
          href="/drill/quiz?mode=due&n=20"
          eyebrow="warm up"
          title="Quiz cards"
          body={dueQuiz > 0 ? `${dueQuiz} due` : 'nothing due, do a rapid round'}
          fallbackHref="/drill/quiz?mode=rapid&n=20"
        />
        <Panel
          href="/drill/behavioral"
          eyebrow="the main event"
          title="Story drill"
          body={
            !hasStories
              ? 'run the seed scripts first'
              : dueStories > 0
                ? `${dueStories} due`
                : 'no reps due, drill a fresh one'
          }
        />
      </section>

      <section className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-medium text-muted">Mastery</h2>
        <p className="mt-2 text-2xl font-semibold">
          {mastered}
          <span className="ml-1 text-base font-normal text-muted">/ {totalCards} cards</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-panel-2">
          <div
            className="h-full bg-good transition-all"
            style={{ width: `${totalCards ? (mastered / totalCards) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Mastered means FSRS expects you to still know it in three weeks. It moves slowly on purpose.
        </p>
      </section>

      <p className="text-center text-xs text-muted/70">
        This is for reps and retention. Book real mocks with humans for pressure.
      </p>
    </div>
  )
}

function Panel({
  href,
  eyebrow,
  title,
  body,
  fallbackHref,
}: {
  href: string
  eyebrow: string
  title: string
  body: string
  fallbackHref?: string
}) {
  const target = body.startsWith('nothing due') && fallbackHref ? fallbackHref : href
  return (
    <Link
      href={target}
      className="block rounded-xl border border-border bg-panel p-5 transition hover:border-accent/50"
    >
      <p className="text-xs uppercase tracking-wide text-muted/70">{eyebrow}</p>
      <p className="mt-1 text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </Link>
  )
}
