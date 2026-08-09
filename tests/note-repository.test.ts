import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
  ensureNotesSchema: async () => undefined,
}));

import { PostgresNoteRepository } from "@/server/note-repository";

const note = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  title: "A note",
  body: "Some text",
  color: "sage" as const,
  updatedAt: 1_700_000_000_000,
};

describe("PostgresNoteRepository ownership", () => {
  it("includes the authenticated owner in every query", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0 });
    const repository = new PostgresNoteRepository({ query }, async () => undefined);

    await repository.list("alice");
    await repository.upsert("alice", note);
    await repository.update("alice", note.id, note);
    await repository.delete("alice", note.id);

    expect(query.mock.calls[0][1]).toEqual(["alice"]);
    expect(query.mock.calls[1][1]).toEqual([note.id, "alice", note.title, note.body, note.color, new Date(note.updatedAt)]);
    expect(query.mock.calls[2][1]).toEqual([note.id, "alice", note.title, note.body, note.color]);
    expect(query.mock.calls[3][1]).toEqual([note.id, "alice"]);
  });

  it("does not disclose a colliding note owned by another user", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresNoteRepository({ query }, async () => undefined);

    await expect(repository.upsert("bob", note)).resolves.toBeNull();
    expect(query.mock.calls[0][0]).toContain("WHERE notes.owner_id = $2");
  });
});
