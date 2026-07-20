import { NextResponse } from "next/server";
import { db, ensureNotesSchema } from "@/lib/db";

const COLORS = new Set(["coral", "gold", "sage", "sky", "lilac", "graphite"]);

type NoteInput = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  color?: unknown;
  updatedAt?: unknown;
};

function validNote(input: NoteInput) {
  return (
    typeof input.id === "string" &&
    typeof input.title === "string" &&
    typeof input.body === "string" &&
    typeof input.color === "string" &&
    COLORS.has(input.color) &&
    typeof input.updatedAt === "number"
  );
}

export async function GET() {
  await ensureNotesSchema();
  const result = await db.query<{
    id: string;
    title: string;
    body: string;
    color: string;
    updated_at: Date;
  }>("SELECT id, title, body, color, updated_at FROM notes ORDER BY updated_at DESC");

  return NextResponse.json(
    result.rows.map((note) => ({
      id: note.id,
      title: note.title,
      body: note.body,
      color: note.color,
      updatedAt: note.updated_at.getTime(),
    })),
  );
}

export async function POST(request: Request) {
  const input = (await request.json()) as NoteInput;
  if (!validNote(input)) return NextResponse.json({ error: "Invalid note" }, { status: 400 });

  await ensureNotesSchema();
  await db.query(
    `INSERT INTO notes (id, title, body, color, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
     SET title = EXCLUDED.title,
         body = EXCLUDED.body,
         color = EXCLUDED.color,
         updated_at = EXCLUDED.updated_at`,
    [input.id, input.title, input.body, input.color, new Date(input.updatedAt as number)],
  );

  return NextResponse.json(input, { status: 201 });
}
