import { NextResponse } from "next/server";
import { NOTE_PAGE_SIZE, isUuid, parseNote } from "@/domain/note";
import { noteRepository, type NoteListCursor } from "@/server/note-repository";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function decodeCursor(value: string): NoteListCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const cursor = parsed as Record<string, unknown>;
    if (!isUuid(cursor.id) || typeof cursor.updatedAt !== "string" || !isDatabaseTimestamp(cursor.updatedAt)) {
      return null;
    }
    return { id: cursor.id, updatedAt: cursor.updatedAt };
  } catch {
    return null;
  }
}

function isDatabaseTimestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) return false;
  const milliseconds = `${value.slice(0, -4)}Z`;
  const parsed = new Date(milliseconds);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === milliseconds;
}

function encodeCursor(cursor: NoteListCursor | null) {
  return cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limitValue = params.get("limit");
  const limit = limitValue === null ? NOTE_PAGE_SIZE.default : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > NOTE_PAGE_SIZE.maximum) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${NOTE_PAGE_SIZE.maximum}` },
      { status: 400 },
    );
  }

  const cursorValue = params.get("cursor");
  const cursor = cursorValue === null ? null : decodeCursor(cursorValue);
  if (cursorValue !== null && !cursor) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const page = await noteRepository.list({ limit, cursor });
  return NextResponse.json({
    items: page.items,
    nextCursor: encodeCursor(page.nextCursor),
    totalCount: page.totalCount,
  });
}

export async function POST(request: Request) {
  const note = parseNote(await readJson(request));
  if (!note) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  return NextResponse.json(await noteRepository.upsert(note), { status: 201 });
}
