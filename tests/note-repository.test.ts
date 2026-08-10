import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

vi.mock("@/lib/db", () => ({
  db: {},
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
    const query = vi.fn(async (...args: [sql: string, values?: unknown[]]) => {
      const [sql] = args;
      if (sql.includes("COUNT(*)")) return { rows: [{ total_count: "0" }] };
      if (sql.includes("INSERT INTO")) return { rows: [{ ...note, updated_at: new Date(note.updatedAt) }] };
      if (sql.includes("DELETE FROM")) return { rows: [], rowCount: 0 };
      return { rows: [] };
    });
    const repository = new PostgresNoteRepository({ query } as unknown as Pick<Pool, "query">);

    await repository.list("alice", { limit: 10, cursor: null });
    await repository.create("alice", { title: note.title, body: note.body, color: note.color });
    await repository.update("alice", note.id, note);
    await repository.delete("alice", note.id);

    expect(query.mock.calls[0][1]).toEqual(["alice", 11]);
    expect(query.mock.calls[1][1]).toEqual(["alice"]);
    expect(query.mock.calls[2][1]).toEqual([expect.any(String), "alice", note.title, note.body, note.color]);
    expect(query.mock.calls[3][1]).toEqual([note.id, "alice", note.title, note.body, note.color]);
    expect(query.mock.calls[4][1]).toEqual([note.id, "alice"]);
  });

  it("does not disclose mutations for a note owned by another user", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = new PostgresNoteRepository({ query } as unknown as Pick<Pool, "query">);

    await expect(repository.update("bob", note.id, note)).resolves.toBeNull();
    await expect(repository.delete("bob", note.id)).resolves.toBe(false);
    expect(query.mock.calls[0][0]).toContain("WHERE id = $1 AND owner_id = $2");
    expect(query.mock.calls[1][0]).toContain("WHERE id = $1 AND owner_id = $2");
  });
});
