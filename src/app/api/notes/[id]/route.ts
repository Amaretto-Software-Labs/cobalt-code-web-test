import { NextResponse } from "next/server";
import { isUuid, parseNoteChanges } from "@/domain/note";
import { authenticatedOwner } from "@/server/auth";
import { noteRepository } from "@/server/note-repository";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, context: RouteContext) {
  const owner = requireOwner(request);
  if (owner instanceof NextResponse) return owner;
  const { id } = await context.params;
  const changes = parseNoteChanges(await readJson(request));

  if (!isUuid(id) || !changes) {
    return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  }

  const note = await noteRepository.update(owner, id, changes);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const owner = requireOwner(_request);
  if (owner instanceof NextResponse) return owner;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid note id" }, { status: 400 });

  const deleted = await noteRepository.delete(owner, id);
  if (!deleted) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
