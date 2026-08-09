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

export interface NoteRepository {
  list(ownerId: string): Promise<Note[]>;
  upsert(ownerId: string, note: Note): Promise<Note | null>;
  update(ownerId: string, id: string, changes: NoteChanges): Promise<Note | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
}

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

  async list(ownerId: string) {
    await this.ensureSchema();
    const result = await this.database.query<NoteRow>(
      "SELECT id, title, body, color, updated_at FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC",
      [ownerId],
    );
    return result.rows.map(fromRow);
  }

  async upsert(ownerId: string, note: Note) {
    await this.ensureSchema();
    const result = await this.database.query<NoteRow>(
      `INSERT INTO notes (id, owner_id, title, body, color, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           body = EXCLUDED.body,
           color = EXCLUDED.color,
           updated_at = EXCLUDED.updated_at
       WHERE notes.owner_id = $2
       RETURNING id, title, body, color, updated_at`,
      [note.id, ownerId, note.title, note.body, note.color, new Date(note.updatedAt)],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async update(ownerId: string, id: string, changes: NoteChanges) {
    await this.ensureSchema();
    const result = await this.database.query<NoteRow>(
      `UPDATE notes
       SET title = $2, body = $3, color = $4, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, title, body, color, updated_at`,
      [id, ownerId, changes.title, changes.body, changes.color],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async delete(ownerId: string, id: string) {
    await this.ensureSchema();
    const result = await this.database.query("DELETE FROM notes WHERE id = $1 AND owner_id = $2", [id, ownerId]);
    return result.rowCount === 1;
  }
}

export const noteRepository = new PostgresNoteRepository(db, ensureNotesSchema);
