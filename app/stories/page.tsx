import { db, parseJson } from '@/lib/db'
import { StoryEditor } from './editor'
import type { StoryRow } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const gapCount = (s: StoryRow) =>
  [s.situation, s.task, s.action, s.result].join(' ').match(/\[[^\]]+\]/g)?.length ?? 0

export default async function StoriesPage() {
  const stories = db().prepare('SELECT * FROM stories ORDER BY id').all() as StoryRow[]
  const totalGaps = stories.reduce((n, s) => n + gapCount(s), 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Stories</h1>
        <p className="mt-1 text-sm text-muted">
          {stories.length} stories from your CV. {totalGaps} gaps left to fill.
        </p>
        <p className="mt-2 text-xs text-muted/70">
          Text in [brackets] is a question the CV bullet did not answer. Filling these is most of the
          preparation: the detail you cannot recall here is the detail you will fumble in the room.
        </p>
      </header>

      <div className="space-y-3">
        {stories.map((s) => (
          <StoryEditor
            key={s.id}
            story={{
              id: s.id,
              title: s.title,
              situation: s.situation,
              task: s.task,
              action: s.action,
              result: s.result,
              metrics: s.metrics,
              tags: parseJson<string[]>(s.tags, []),
              gaps: gapCount(s),
            }}
          />
        ))}
      </div>
    </div>
  )
}
