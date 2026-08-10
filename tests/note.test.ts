import { describe, expect, it } from "vitest";
import {
  NOTE_LIMITS,
  isNoteColor,
  isUuid,
  parseCreateNoteInput,
  parseLegacyNotes,
  parseNote,
  parseNoteChanges,
  parseNotes,
  parseNotesPage,
} from "@/domain/note";

const validNote = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  title: "A note",
  body: "Some text",
  color: "sage",
  updatedAt: 1_700_000_000_000,
};

describe("note domain validation", () => {
  it("accepts a valid note without retaining unknown fields", () => {
    expect(parseNote({ ...validNote, ignored: true })).toEqual(validNote);
  });

  it.each([
    { ...validNote, id: "not-a-uuid" },
    { ...validNote, color: "pink" },
    { ...validNote, title: "x".repeat(NOTE_LIMITS.title + 1) },
    { ...validNote, body: "x".repeat(NOTE_LIMITS.body + 1) },
    { ...validNote, updatedAt: Number.NaN },
    null,
  ])("rejects an invalid note", (candidate) => {
    expect(parseNote(candidate)).toBeNull();
  });

  it("validates collections atomically", () => {
    expect(parseNotes([validNote])).toEqual([validNote]);
    expect(parseNotes([validNote, { ...validNote, color: "pink" }])).toBeNull();
    expect(parseNotes({})).toBeNull();
  });

  it("validates paginated collections", () => {
    expect(parseNotesPage({ items: [validNote], nextCursor: "opaque", totalCount: 12 })).toEqual({
      items: [validNote],
      nextCursor: "opaque",
      totalCount: 12,
    });
    expect(parseNotesPage({ items: [validNote], nextCursor: null, totalCount: 1 })).not.toBeNull();
    expect(parseNotesPage({ items: [validNote], nextCursor: null })).toBeNull();
    expect(parseNotesPage({ items: [validNote], nextCursor: null, totalCount: 0 })).toBeNull();
    expect(parseNotesPage({ items: [{ bad: true }], nextCursor: null, totalCount: 1 })).toBeNull();
    expect(
      parseNotesPage({ items: Array.from({ length: 101 }, () => validNote), nextCursor: null, totalCount: 101 }),
    ).toBeNull();
  });

  it("validates editable fields independently", () => {
    expect(parseNoteChanges(validNote)).toEqual({ title: "A note", body: "Some text", color: "sage" });
    expect(parseNoteChanges({ ...validNote, color: "pink" })).toBeNull();
  });

  it("only accepts editable fields when creating a note", () => {
    expect(parseCreateNoteInput(validNote)).toBeNull();
    expect(parseCreateNoteInput({ title: "A note", body: "Some text", color: "sage" })).toEqual({
      title: "A note",
      body: "Some text",
      color: "sage",
    });
  });

  it("migrates legacy notes with a default color and ignores corrupt entries", () => {
    const legacy = JSON.stringify([{ ...validNote, color: undefined }, { broken: true }]);
    expect(parseLegacyNotes(legacy)).toEqual([{ ...validNote, color: "coral" }]);
    expect(parseLegacyNotes("not json")).toEqual([]);
  });

  it("recognizes supported colors and UUIDs", () => {
    expect(isNoteColor("sky")).toBe(true);
    expect(isNoteColor("pink")).toBe(false);
    expect(isUuid(validNote.id)).toBe(true);
    expect(isUuid("1 OR 1=1")).toBe(false);
  });
});
