/** Pure helpers, safe to import from client components. No LLM imports here. */
export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** Roughly 150 words per minute of natural speech. */
export const spokenSeconds = (words: number) => Math.round((words / 150) * 60)

/*
 * Why this module exists: client components need word counts, but importing
 * them from lib/grading pulled the whole LLM layer (and node:child_process)
 * into the browser bundle and broke the build. Anything a client component
 * needs lives here; lib/llm and lib/grading are server-side only.
 */
