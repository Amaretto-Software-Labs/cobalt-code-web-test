import { NextResponse } from "next/server";
import { db, ensureNotesSchema } from "@/lib/db";

const COLORS = new Set(["coral", "gold", "sage", "sky", "lilac", "graphite"]);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const input = (await request.json()) as {
    title?: unknown;
    body?: unknown;
    color?: unknown;
    updatedAt?: unknown;
  };

  if (
    typeof input.title !== "string" ||
    typeof input.body !== "string" ||
    typeof input.color !== "string" ||
    !COLORS.has(input.color) ||
    typeof input.updatedAt !== "number"
  ) {
    return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  }

  await ensureNotesSchema();
  const result = await db.query<{ updated_at: Date }>(
    `UPDATE notes
     SET title = $2, body = $3, color = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING updated_at`,
    [id, input.title, input.body, input.color],
  );

  if (result.rowCount === 0) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ id, updatedAt: result.rows[0].updated_at.getTime() });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await ensureNotesSchema();
  const result = await db.query("DELETE FROM notes WHERE id = $1", [id]);

  if (result.rowCount === 0) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
