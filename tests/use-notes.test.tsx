// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/domain/note";

const api = vi.hoisted(() => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock("@/client/notes-api", () => api);

import { useNotes } from "@/hooks/use-notes";

const existingNote: Note = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  title: "Existing",
  body: "Text",
  color: "sage",
  updatedAt: 1_700_000_000_000,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.listNotes.mockResolvedValue([]);
  api.createNote.mockImplementation(async (input: Omit<Note, "id" | "updatedAt">) => ({
    id: crypto.randomUUID(),
    ...input,
    updatedAt: 1_700_000_000_000,
  }));
  api.updateNote.mockImplementation(async (id: string, changes: Omit<Note, "id" | "updatedAt">) => ({
    id,
    ...changes,
    updatedAt: 1_800_000_000_000,
  }));
  api.deleteNote.mockResolvedValue(undefined);
});

describe("useNotes persistence orchestration", () => {
  it("loads notes from the API and selects the first note", async () => {
    api.listNotes.mockResolvedValue([existingNote]);
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.notes).toEqual([existingNote]);
    expect(result.current.activeId).toBe(existingNote.id);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("migrates valid legacy notes only when PostgreSQL is empty", async () => {
    localStorage.setItem("papier-notes", JSON.stringify([{ ...existingNote, color: undefined }]));
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(api.createNote).toHaveBeenCalledWith({ title: "Existing", body: "Text", color: "coral" });
    expect(localStorage.getItem("papier-notes")).toBeNull();
  });

  it("uses the server-created note identity", async () => {
    const createdNote = { ...existingNote, id: "cd81b56d-9b57-4e22-b895-98cdb8b920cf", title: "" };
    api.createNote.mockResolvedValue(createdNote);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.create(); });
    expect(api.createNote).toHaveBeenCalledWith({ title: "", body: "", color: "coral" });
    expect(result.current.notes[0]).toEqual(createdNote);
    expect(result.current.activeId).toBe(createdNote.id);
  });

  it("keeps a note visible when deletion fails", async () => {
    api.listNotes.mockResolvedValue([existingNote]);
    api.deleteNote.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.remove(existingNote.id);
      } catch (error) {
        failure = error;
      }
    });
    expect(failure).toEqual(new Error("offline"));
    expect(result.current.notes).toEqual([existingNote]);
    await waitFor(() => expect(result.current.saveStatus).toBe("error"));
  });
});
