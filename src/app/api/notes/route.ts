import { NextResponse } from "next/server";
import { parseNote } from "@/domain/note";
import { noteRepository } from "@/server/note-repository";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json(await noteRepository.list());
}

export async function POST(request: Request) {
  const note = parseNote(await readJson(request));
  if (!note) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  return NextResponse.json(await noteRepository.upsert(note), { status: 201 });
}
