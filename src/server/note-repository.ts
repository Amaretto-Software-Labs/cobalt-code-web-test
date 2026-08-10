import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { CreateNoteInput, Note, NoteChanges, NoteColor } from "@/domain/note";
import { db } from "@/lib/db";

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
  list(ownerId: string, options: NoteListOptions): Promise<NoteListPage>;
  create(ownerId: string, input: CreateNoteInput): Promise<Note>;
  update(ownerId: string, id: string, changes: NoteChanges): Promise<Note | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
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
  constructor(private readonly database: Database) {}

  async list(ownerId: string, { limit, cursor }: NoteListOptions) {
    const values: unknown[] = [ownerId];
    const where = cursor
      ? "WHERE owner_id = $1 AND (updated_at, id) < ($2::timestamptz, $3::uuid)"
      : "WHERE owner_id = $1";
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
      this.database.query<{ total_count: string }>(
        "SELECT COUNT(*) AS total_count FROM notes WHERE owner_id = $1",
        [ownerId],
      ),
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

  async create(ownerId: string, input: CreateNoteInput) {
    const result = await this.database.query<NoteRow>(
      `INSERT INTO notes (id, owner_id, title, body, color, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, title, body, color, updated_at`,
      [randomUUID(), ownerId, input.title, input.body, input.color],
    );
    return fromRow(result.rows[0]);
  }

  async update(ownerId: string, id: string, changes: NoteChanges) {
    const result = await this.database.query<NoteRow>(
      `UPDATE notes
       SET title = $3, body = $4, color = $5, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, title, body, color, updated_at`,
      [id, ownerId, changes.title, changes.body, changes.color],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async delete(ownerId: string, id: string) {
    const result = await this.database.query("DELETE FROM notes WHERE id = $1 AND owner_id = $2", [id, ownerId]);
    return result.rowCount === 1;
  }
}

export const noteRepository = new PostgresNoteRepository(db);
