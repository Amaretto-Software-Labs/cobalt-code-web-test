import type { Pool, PoolClient } from "pg";
import type { Note, NoteChanges, NoteColor } from "@/domain/note";
import { db, ensureNotesSchema } from "@/lib/db";

type Database = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type NoteRow = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  updated_at: Date;
};

type ListedNoteRow = NoteRow & {
  cursor_updated_at: string;
};

export interface NoteRepository {
  list(options: NoteListOptions): Promise<NoteListPage>;
  upsert(note: Note): Promise<Note>;
  update(id: string, changes: NoteChanges): Promise<Note | null>;
  delete(id: string): Promise<boolean>;
}

export type NoteListCursor = {
  id: string;
  updatedAt: string;
};

export type NoteListOptions = {
  limit: number;
  cursor: NoteListCursor | null;
};

export type NoteListPage = {
  items: Note[];
  nextCursor: NoteListCursor | null;
  totalCount: number;
};

function fromRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color,
    updatedAt: row.updated_at.getTime(),
  };
}

export class PostgresNoteRepository implements NoteRepository {
  constructor(private readonly database: Database, private readonly ensureSchema: () => Promise<void>) {}

  async list({ limit, cursor }: NoteListOptions) {
    await this.ensureSchema();
    const values: unknown[] = [];
    const where = cursor
      ? "WHERE (updated_at, id) < ($1::timestamptz, $2::uuid)"
      : "";
    if (cursor) values.push(cursor.updatedAt, cursor.id);
    values.push(limit + 1);
    const [result, countResult] = await Promise.all([
      this.database.query<ListedNoteRow>(
        `SELECT id, title, body, color, updated_at,
                to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_updated_at
         FROM notes
         ${where}
         ORDER BY updated_at DESC, id DESC
         LIMIT $${values.length}`,
        values,
      ),
      this.database.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM notes"),
    ]);
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(fromRow);
    const last = result.rows[Math.min(result.rows.length, limit) - 1];
    return {
      items,
      nextCursor: hasMore && last ? { id: last.id, updatedAt: last.cursor_updated_at } : null,
      totalCount: Number(countResult.rows[0].total_count),
    };
  }

  async upsert(note: Note) {
    await this.ensureSchema();
    const result = await this.database.query<NoteRow>(
      `INSERT INTO notes (id, title, body, color, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           body = EXCLUDED.body,
           color = EXCLUDED.color,
           updated_at = EXCLUDED.updated_at
       RETURNING id, title, body, color, updated_at`,
      [note.id, note.title, note.body, note.color, new Date(note.updatedAt)],
    );
    return fromRow(result.rows[0]);
  }

  async update(id: string, changes: NoteChanges) {
    await this.ensureSchema();
    const result = await this.database.query<NoteRow>(
      `UPDATE notes
       SET title = $2, body = $3, color = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, body, color, updated_at`,
      [id, changes.title, changes.body, changes.color],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async delete(id: string) {
    await this.ensureSchema();
    const result = await this.database.query("DELETE FROM notes WHERE id = $1", [id]);
    return result.rowCount === 1;
  }
}

export const noteRepository = new PostgresNoteRepository(db, ensureNotesSchema);
