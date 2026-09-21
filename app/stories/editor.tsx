'use client'

import { useState } from 'react'
import { saveStory } from '@/app/actions'

export type EditableStory = {
  id: number
  title: string
  situation: string
  task: string
  action: string
  result: string
  metrics: string
  tags: string[]
  gaps: number
}

const FIELDS = [
  { key: 'situation', label: 'Situation' },
  { key: 'task', label: 'Task' },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
  { key: 'metrics', label: 'Metrics' },
] as const

export function StoryEditor({ story }: { story: EditableStory }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(story)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await saveStory({
      id: story.id,
      situation: draft.situation,
      task: draft.task,
      action: draft.action,
      result: draft.result,
      metrics: draft.metrics,
    })
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const gaps = [draft.situation, draft.task, draft.action, draft.result].join(' ').match(/\[[^\]]+\]/g)?.length ?? 0

  return (
    <div className="rounded-xl border border-border bg-panel">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="font-medium">{story.title}</span>
        <span className={`shrink-0 text-xs ${gaps > 0 ? 'text-warn' : 'text-good'}`}>
          {gaps > 0 ? `${gaps} gaps` : 'complete'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs text-muted">{f.label}</span>
              <textarea
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                rows={f.key === 'metrics' ? 1 : 2}
                className="mt-1 w-full resize-y rounded-lg border border-border bg-panel-2 p-2.5 text-sm outline-none transition focus:border-accent/50"
              />
            </label>
          ))}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{saved ? 'saved' : ''}</span>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm transition hover:border-accent/50 disabled:opacity-50"
            >
              {busy ? 'saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
