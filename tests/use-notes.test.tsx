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
  api.createNote.mockImplementation(async (note: Note) => note);
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
    expect(api.createNote).toHaveBeenCalledWith({ ...existingNote, color: "coral" });
    expect(localStorage.getItem("papier-notes")).toBeNull();
  });

  it("serializes an edit behind an in-flight create", async () => {
    let resolveCreate!: (note: Note) => void;
    api.createNote.mockReturnValue(new Promise<Note>((resolve) => { resolveCreate = resolve; }));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { result.current.create(); });
    const created = result.current.notes[0];
    act(() => { result.current.update(created.id, { title: "Typed quickly" }); });

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    expect(api.updateNote).not.toHaveBeenCalled();

    await act(async () => { resolveCreate(created); });
    await waitFor(() => expect(api.updateNote).toHaveBeenCalledWith(
      created.id,
      expect.objectContaining({ title: "Typed quickly" }),
    ));
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

  it("retains a failed edit and retries it without losing the optimistic value", async () => {
    api.listNotes.mockResolvedValue([existingNote]);
    api.updateNote.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { result.current.update(existingNote.id, { title: "Still here" }); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    await waitFor(() => expect(result.current.saveStatus).toBe("error"));
    expect(result.current.notes[0]).toMatchObject({ title: "Still here" });
    expect(result.current.canRetry).toBe(true);

    await act(async () => { result.current.retryFailed(); });
    await waitFor(() => expect(api.updateNote).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
    expect(result.current.canRetry).toBe(false);
    expect(api.updateNote).toHaveBeenLastCalledWith(existingNote.id, expect.objectContaining({ title: "Still here" }));
  });

  it("does not report saved while another note is waiting in its debounce timer", async () => {
    const anotherNote = { ...existingNote, id: "1cd83975-e64d-4b6a-a5fb-01d1bd5583a8", title: "Another" };
    let resolveFirst!: (note: Note) => void;
    api.listNotes.mockResolvedValue([existingNote, anotherNote]);
    api.updateNote.mockImplementationOnce(() => new Promise<Note>((resolve) => { resolveFirst = resolve; }));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { result.current.update(existingNote.id, { title: "First edit" }); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    await waitFor(() => expect(api.updateNote).toHaveBeenCalledTimes(1));
    act(() => { result.current.update(anotherNote.id, { title: "Second edit" }); });

    await act(async () => {
      resolveFirst({ ...existingNote, title: "First edit", updatedAt: 1_800_000_000_000 });
    });
    expect(result.current.saveStatus).toBe("saving");
  });

  it("flushes the latest debounced edit when the page is hidden", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    api.listNotes.mockResolvedValue([existingNote]);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { result.current.update(existingNote.id, { body: "Latest body" }); });
    act(() => { window.dispatchEvent(new Event("pagehide")); });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${existingNote.id}`,
      expect.objectContaining({ body: expect.stringContaining("Latest body"), keepalive: true }),
    );
    vi.unstubAllGlobals();
  });
});
