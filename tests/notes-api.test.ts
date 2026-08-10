import { afterEach, describe, expect, it, vi } from "vitest";
import { createNote, deleteNote, listNotes, NotesApiError, updateNote } from "@/client/notes-api";

const note = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  title: "A note",
  body: "Some text",
  color: "sage" as const,
  updatedAt: 1_700_000_000_000,
};

const createInput = { title: note.title, body: note.body, color: note.color };

afterEach(() => vi.unstubAllGlobals());

describe("notes API client", () => {
  it("adds a stored bearer token to requests", async () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn().mockReturnValue("alice-token") },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ items: [], nextCursor: null, totalCount: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listNotes();

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer alice-token");
  });

  it("loads and validates notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ items: [note], nextCursor: "next", totalCount: 12 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(listNotes()).resolves.toEqual({ items: [note], nextCursor: "next", totalCount: 12 });
    expect(fetchMock).toHaveBeenCalledWith("/api/notes", undefined);
  });

  it("URL-encodes continuation cursors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null, totalCount: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await listNotes("a/b+c=");
    expect(fetchMock).toHaveBeenCalledWith("/api/notes?cursor=a%2Fb%2Bc%3D", undefined);
  });

  it("rejects an invalid server payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ items: [{ bad: true }], nextCursor: null, totalCount: 1 })),
    );
    await expect(listNotes()).rejects.toMatchObject({ name: "NotesApiError", status: 500 });
  });

  it("creates, updates, and deletes through the expected endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(note, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ...note, title: "Updated" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNote(createInput)).resolves.toEqual(note);
    await expect(updateNote(note.id, { ...note, title: "Updated" })).resolves.toMatchObject({ title: "Updated" });
    await expect(deleteNote(note.id)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/notes",
      `/api/notes/${note.id}`,
      `/api/notes/${note.id}`,
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(createInput);
  });

  it("preserves HTTP status information on failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(listNotes()).rejects.toEqual(expect.any(NotesApiError));
  });
});
