import { NextResponse } from "next/server";
import { parseCreateNoteInput } from "@/domain/note";
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
  const input = parseCreateNoteInput(await readJson(request));
  if (!input) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  return NextResponse.json(await noteRepository.create(input), { status: 201 });
}
