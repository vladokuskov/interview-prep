import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DB_PATH = process.env.PREP_DB_PATH ?? join(process.cwd(), 'data', 'prep.db')

let _db: Database.Database | null = null

export function db(): Database.Database {
  if (_db) return _db
  const conn = new Database(DB_PATH)
  conn.exec(readFileSync(join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8'))
  _db = conn
  return conn
}

/** JSON columns are stored as text; these keep the casts in one place. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? null)
