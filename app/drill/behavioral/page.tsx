import Link from 'next/link'
import { pickBehavioral, rubricLabels } from '@/lib/session/behavioral'
import { BehavioralDrillClient } from './client'

export const dynamic = 'force-dynamic'

export default async function BehavioralPage() {
  const question = pickBehavioral()
  const labels = rubricLabels('behavioral')

  if (!question) {
    return (
      <div className="rounded-xl border border-border bg-panel p-8 text-center text-sm text-muted">
        <p>No behavioral questions yet.</p>
        <p className="mt-2">
          Run <code className="rounded bg-panel-2 px-1.5 py-0.5">npm run ingest</code> then{' '}
          <code className="rounded bg-panel-2 px-1.5 py-0.5">npm run seed:stories</code>.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Story drill</h1>
        <Link href="/stories" className="text-xs text-muted hover:text-fg">
          edit stories
        </Link>
      </div>
      <BehavioralDrillClient question={question} rubricLabels={labels} />
    </div>
  )
}
