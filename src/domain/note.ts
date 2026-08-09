export const NOTE_COLORS = [
  { id: "coral", label: "Coral", value: "#e2673f" },
  { id: "gold", label: "Gold", value: "#d5a83d" },
  { id: "sage", label: "Sage", value: "#769475" },
  { id: "sky", label: "Sky", value: "#668fa9" },
  { id: "lilac", label: "Lilac", value: "#9179a8" },
  { id: "graphite", label: "Graphite", value: "#696d68" },
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number]["id"];

export type Note = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  updatedAt: number;
};

export type NoteChanges = Pick<Note, "title" | "body" | "color">;

export type NotesPage = {
  items: Note[];
  nextCursor: string | null;
  totalCount: number;
};

export const NOTE_PAGE_SIZE = {
  default: 10,
  maximum: 100,
} as const;

export const NOTE_LIMITS = {
  title: 500,
  body: 100_000,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_IDS = new Set<string>(NOTE_COLORS.map((color) => color.id));

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && COLOR_IDS.has(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseNote(value: unknown): Note | null {
  if (!value || typeof value !== "object") return null;
  const note = value as Record<string, unknown>;

  if (
    !isUuid(note.id) ||
    typeof note.title !== "string" ||
    note.title.length > NOTE_LIMITS.title ||
    typeof note.body !== "string" ||
    note.body.length > NOTE_LIMITS.body ||
    !isNoteColor(note.color) ||
    typeof note.updatedAt !== "number" ||
    !Number.isFinite(note.updatedAt) ||
    note.updatedAt < 0
  ) {
    return null;
  }

  return {
    id: note.id,
    title: note.title,
    body: note.body,
    color: note.color,
    updatedAt: note.updatedAt,
  };
}

export function parseNoteChanges(value: unknown): NoteChanges | null {
  if (!value || typeof value !== "object") return null;
  const changes = value as Record<string, unknown>;

  if (
    typeof changes.title !== "string" ||
    changes.title.length > NOTE_LIMITS.title ||
    typeof changes.body !== "string" ||
    changes.body.length > NOTE_LIMITS.body ||
    !isNoteColor(changes.color)
  ) {
    return null;
  }

  return { title: changes.title, body: changes.body, color: changes.color };
}

export function parseNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) return null;
  const notes = value.map(parseNote);
  return notes.every((note): note is Note => note !== null) ? notes : null;
}

export function parseNotesPage(value: unknown): NotesPage | null {
  if (!value || typeof value !== "object") return null;
  const page = value as Record<string, unknown>;
  const items = parseNotes(page.items);

  if (
    !items ||
    items.length > NOTE_PAGE_SIZE.maximum ||
    typeof page.totalCount !== "number" ||
    !Number.isSafeInteger(page.totalCount) ||
    page.totalCount < items.length ||
    (page.nextCursor !== null && typeof page.nextCursor !== "string")
  ) {
    return null;
  }
  return { items, nextCursor: page.nextCursor, totalCount: page.totalCount };
}

export function parseLegacyNotes(value: string): Note[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      return [parseNote({ ...candidate, color: candidate.color ?? "coral" })].filter(
        (note): note is Note => note !== null,
      );
    });
  } catch {
    return [];
  }
}
