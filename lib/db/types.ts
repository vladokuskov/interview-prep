export type Mode = 'behavioral' | 'system_design' | 'coding' | 'quiz'
export type RefType = 'question' | 'story' | 'bank_card'
export type CardFormat = 'flashcard' | 'mcq'

export type RoleRow = {
  id: number
  company: string
  title: string
  location: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number
}

export type BulletRow = { id: number; role_id: number | null; text: string; tags: string }

export type StoryRow = {
  id: number
  bullet_id: number | null
  title: string
  situation: string
  task: string
  action: string
  result: string
  metrics: string
  tags: string
  created_at: string
  updated_at: string
}

export type QuestionRow = {
  id: number
  mode: Mode
  prompt: string
  difficulty: string
  tags: string
  source: string
  story_id: number | null
  target_id: number | null
  created_at: string
}

export type BankRow = {
  id: number
  slug: string
  title: string
  source_url: string
  license: string
  imported_at: string
}

export type BankCardRow = {
  id: number
  bank_id: number
  ord: number
  format: CardFormat
  question: string
  answer: string
  options: string | null
  explanation: string | null
  tags: string
  verified: number
  killed: number
}

export type AttemptRow = {
  id: number
  ref_type: RefType
  ref_id: number
  mode: Mode
  answer_text: string
  duration_ms: number | null
  word_count: number | null
  score: number | null
  scores: string | null
  feedback: string | null
  language: string | null
  tags: string
  audio_path: string | null
  transcript_source: string | null
  created_at: string
}

export type CardRow = {
  id: number
  ref_type: RefType
  ref_id: number
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  learning_steps: number
  state: number
  last_review: string | null
}
