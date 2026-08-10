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

const storedValues = new Map<string, string>();
const testStorage: Storage = {
  get length() { return storedValues.size; },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => { storedValues.delete(key); },
  setItem: (key, value) => { storedValues.set(key, String(value)); },
};

beforeEach(() => {
  vi.stubGlobal("localStorage", testStorage);
  localStorage.clear();
  vi.clearAllMocks();
  api.listNotes.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
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
    api.listNotes.mockResolvedValue({ items: [existingNote], nextCursor: null, totalCount: 12 });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.notes).toEqual([existingNote]);
    expect(result.current.activeId).toBe(existingNote.id);
    expect(result.current.totalCount).toBe(12);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("loads and de-duplicates a continuation page", async () => {
    const secondNote = { ...existingNote, id: "7bc7c6d1-3ef9-46d4-bdd7-a35a48655177", title: "Older" };
    api.listNotes
      .mockResolvedValueOnce({ items: [existingNote], nextCursor: "page-2", totalCount: 2 })
      .mockResolvedValueOnce({ items: [existingNote, secondNote], nextCursor: null, totalCount: 2 });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.loadMore(); });

    expect(api.listNotes).toHaveBeenLastCalledWith("page-2");
    expect(result.current.notes).toEqual([existingNote, secondNote]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalCount).toBe(2);
  });

  it("allows a failed continuation request to be retried", async () => {
    api.listNotes
      .mockResolvedValueOnce({ items: [existingNote], nextCursor: "page-2", totalCount: 1 })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [], nextCursor: null, totalCount: 1 });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await expect(result.current.loadMore()).rejects.toThrow("offline"); });
    expect(result.current.loadMoreError).toBe(true);

    await act(async () => { await result.current.loadMore(); });
    expect(result.current.loadMoreError).toBe(false);
    expect(result.current.hasMore).toBe(false);
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

  it("updates the total after creating and deleting a note", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let created!: Note;
    await act(async () => { created = await result.current.create(); });
    expect(result.current.totalCount).toBe(1);

    await act(async () => { await result.current.remove(created.id); });
    expect(result.current.totalCount).toBe(0);
  });

  it("keeps a note visible when deletion fails", async () => {
    api.listNotes.mockResolvedValue({ items: [existingNote], nextCursor: null, totalCount: 1 });
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
    expect(result.current.totalCount).toBe(1);
    await waitFor(() => expect(result.current.saveStatus).toBe("error"));
  });

  it("retains a failed edit and retries it without losing the optimistic value", async () => {
    api.listNotes.mockResolvedValue({ items: [existingNote], nextCursor: null, totalCount: 1 });
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
    api.listNotes.mockResolvedValue({ items: [existingNote, anotherNote], nextCursor: null, totalCount: 2 });
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
    api.listNotes.mockResolvedValue({ items: [existingNote], nextCursor: null, totalCount: 1 });
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
