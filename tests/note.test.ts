import { describe, expect, it } from "vitest";
import {
  NOTE_LIMITS,
  isNoteColor,
  isUuid,
  parseLegacyNotes,
  parseNote,
  parseNoteChanges,
  parseNotes,
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

  it("validates editable fields independently", () => {
    expect(parseNoteChanges(validNote)).toEqual({ title: "A note", body: "Some text", color: "sage" });
    expect(parseNoteChanges({ ...validNote, color: "pink" })).toBeNull();
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
