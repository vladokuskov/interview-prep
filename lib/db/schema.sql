-- Single source of truth for the schema. Idempotent: re-run safely on every boot.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- profile (seeded once from the CV) ----------

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY,
  company     TEXT NOT NULL,
  title       TEXT NOT NULL,
  location    TEXT,
  start_date  TEXT,
  end_date    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bullets (
  id       INTEGER PRIMARY KEY,
  role_id  INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  tags     TEXT NOT NULL DEFAULT '[]'   -- json array
);

CREATE TABLE IF NOT EXISTS skills (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  category TEXT
);

-- ---------- behavioral stories ----------

CREATE TABLE IF NOT EXISTS stories (
  id         INTEGER PRIMARY KEY,
  bullet_id  INTEGER REFERENCES bullets(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  situation  TEXT NOT NULL DEFAULT '',
  task       TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL DEFAULT '',
  result     TEXT NOT NULL DEFAULT '',
  metrics    TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- questions (behavioral phrasings, design prompts, coding tasks) ----------

CREATE TABLE IF NOT EXISTS questions (
  id         INTEGER PRIMARY KEY,
  mode       TEXT NOT NULL,               -- behavioral | system_design | coding
  prompt     TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'mid', -- junior | mid | senior
  tags       TEXT NOT NULL DEFAULT '[]',
  source     TEXT NOT NULL DEFAULT 'curated', -- curated | from_cv | from_jd
  story_id   INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  target_id  INTEGER REFERENCES targets(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS questions_mode_idx ON questions(mode);

-- ---------- quiz banks ----------

CREATE TABLE IF NOT EXISTS banks (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  license     TEXT NOT NULL DEFAULT 'unknown',
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bank_cards (
  id          INTEGER PRIMARY KEY,
  bank_id     INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  ord         INTEGER NOT NULL DEFAULT 0,
  format      TEXT NOT NULL DEFAULT 'flashcard',  -- flashcard | mcq
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  options     TEXT,                                -- json array, mcq only
  explanation TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',
  verified    INTEGER NOT NULL DEFAULT 0,          -- 1 once a human has confirmed it
  killed      INTEGER NOT NULL DEFAULT 0,          -- 1 to retire a bad card
  UNIQUE(bank_id, ord)
);

CREATE INDEX IF NOT EXISTS bank_cards_bank_idx ON bank_cards(bank_id, killed);

-- ---------- job targets ----------

CREATE TABLE IF NOT EXISTS targets (
  id         INTEGER PRIMARY KEY,
  company    TEXT NOT NULL,
  role       TEXT NOT NULL,
  seniority  TEXT,
  stack      TEXT NOT NULL DEFAULT '[]',
  raw        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- attempts (every answer you ever give) ----------

CREATE TABLE IF NOT EXISTS attempts (
  id               INTEGER PRIMARY KEY,
  ref_type         TEXT NOT NULL,   -- question | story | bank_card
  ref_id           INTEGER NOT NULL,
  mode             TEXT NOT NULL,   -- behavioral | system_design | coding | quiz
  answer_text      TEXT NOT NULL DEFAULT '',
  duration_ms      INTEGER,
  word_count       INTEGER,
  score            REAL,            -- overall 1-5, null for self-graded quiz
  scores           TEXT,            -- json, per-rubric-criterion
  feedback         TEXT,            -- json
  language         TEXT,            -- json, the English pass
  tags             TEXT NOT NULL DEFAULT '[]',
  audio_path       TEXT,            -- reserved for voice mode
  transcript_source TEXT,           -- 'typed' now, 'stt' later
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS attempts_ref_idx ON attempts(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts(created_at);

-- ---------- FSRS scheduling state ----------

CREATE TABLE IF NOT EXISTS cards (
  id             INTEGER PRIMARY KEY,
  ref_type       TEXT NOT NULL,  -- question | story | bank_card
  ref_id         INTEGER NOT NULL,
  due            TEXT NOT NULL,
  stability      REAL NOT NULL DEFAULT 0,
  difficulty     REAL NOT NULL DEFAULT 0,
  elapsed_days   REAL NOT NULL DEFAULT 0,
  scheduled_days REAL NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  state          INTEGER NOT NULL DEFAULT 0,
  last_review    TEXT,
  UNIQUE(ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS cards_due_idx ON cards(due);
