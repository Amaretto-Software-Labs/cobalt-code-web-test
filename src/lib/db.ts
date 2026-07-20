import { Pool } from "pg";

const globalForDatabase = globalThis as unknown as {
  papierPool?: Pool;
  papierSchema?: Promise<void>;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  return new Pool({ connectionString, max: 10 });
}

export const db = globalForDatabase.papierPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForDatabase.papierPool = db;

export function ensureNotesSchema() {
  if (!globalForDatabase.papierSchema) {
    globalForDatabase.papierSchema = db
      .query(`
        CREATE TABLE IF NOT EXISTS notes (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT 'coral'
            CHECK (color IN ('coral', 'gold', 'sage', 'sky', 'lilac', 'graphite')),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        globalForDatabase.papierSchema = undefined;
        throw error;
      });
  }

  return globalForDatabase.papierSchema;
}
