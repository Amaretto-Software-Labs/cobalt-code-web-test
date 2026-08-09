import { NextResponse } from "next/server";
import { parseNote } from "@/domain/note";
import { authenticatedOwner } from "@/server/auth";
import { noteRepository } from "@/server/note-repository";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function requireOwner(request: Request): string | NextResponse {
  const owner = authenticatedOwner(request);
  return owner ?? NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET(request: Request) {
  const owner = requireOwner(request);
  if (owner instanceof NextResponse) return owner;
  return NextResponse.json(await noteRepository.list(owner));
}

export async function POST(request: Request) {
  const owner = requireOwner(request);
  if (owner instanceof NextResponse) return owner;
  const note = parseNote(await readJson(request));
  if (!note) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  const created = await noteRepository.upsert(owner, note);
  if (!created) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json(created, { status: 201 });
}
