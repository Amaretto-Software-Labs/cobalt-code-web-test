import { parseNote, parseNotes, type Note, type NoteChanges } from "@/domain/note";

export class NotesApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "NotesApiError";
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new NotesApiError(`Notes request failed (${response.status})`, response.status);
  if (response.status === 204) return null;
  return response.json();
}

export async function listNotes(): Promise<Note[]> {
  const notes = parseNotes(await requestJson("/api/notes"));
  if (!notes) throw new NotesApiError("The server returned invalid notes", 500);
  return notes;
}

export async function createNote(note: Note): Promise<Note> {
  const created = parseNote(
    await requestJson("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    }),
  );
  if (!created) throw new NotesApiError("The server returned an invalid note", 500);
  return created;
}

export async function updateNote(id: string, changes: NoteChanges): Promise<Note> {
  const updated = parseNote(
    await requestJson(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
  );
  if (!updated) throw new NotesApiError("The server returned an invalid note", 500);
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  await requestJson(`/api/notes/${id}`, { method: "DELETE" });
}
