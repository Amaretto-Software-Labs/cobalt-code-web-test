import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureNotesSchema } from "@/lib/db";
import { PostgresNoteRepository } from "@/server/note-repository";

const connectionString = process.env.DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("PostgresNoteRepository integration", () => {
  const pool = new Pool({ connectionString });
  const repository = new PostgresNoteRepository(pool, ensureNotesSchema);
  let id: string | undefined;
  const paginationIds = [
    "ffffffff-ffff-4fff-bfff-fffffffffff1",
    "ffffffff-ffff-4fff-bfff-fffffffffff2",
    "ffffffff-ffff-4fff-bfff-fffffffffff3",
  ];
  const precisionIds = [
    "eeeeeeee-eeee-4eee-beee-eeeeeeeeeee1",
    "eeeeeeee-eeee-4eee-beee-eeeeeeeeeee2",
    "eeeeeeee-eeee-4eee-beee-eeeeeeeeeee3",
  ];

  beforeAll(async () => {
    await ensureNotesSchema();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM notes WHERE id = ANY($1::uuid[])", [
      [...paginationIds, ...precisionIds, ...(id ? [id] : [])],
    ]);
    await pool.end();
  });

  it("covers the full note lifecycle against PostgreSQL", async () => {
    const created = await repository.create({
      title: "Integration note",
      body: "Created",
      color: "gold",
    });
    id = created.id;
    expect(created).toMatchObject({ title: "Integration note", color: "gold" });
    await expect(repository.list({ limit: 100, cursor: null })).resolves.toMatchObject({
      items: expect.arrayContaining([created]),
    });

    const updated = await repository.update(created.id, {
      title: "Updated integration note",
      body: "Updated",
      color: "sky",
    });
    expect(updated).toMatchObject({ id, title: "Updated integration note", color: "sky" });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    await expect(repository.delete(created.id)).resolves.toBe(false);
  });

  it("paginates equal timestamps with the UUID as a stable descending tie-breaker", async () => {
    await pool.query(
      `INSERT INTO notes (id, title, body, color, updated_at)
       VALUES ($1, 'Pagination 0', 'Stable ordering', 'lilac', '9999-12-31T23:59:59Z'),
              ($2, 'Pagination 1', 'Stable ordering', 'lilac', '9999-12-31T23:59:59Z'),
              ($3, 'Pagination 2', 'Stable ordering', 'lilac', '9999-12-31T23:59:59Z')`,
      paginationIds,
    );

    const first = await repository.list({ limit: 2, cursor: null });
    expect(first.totalCount).toBeGreaterThanOrEqual(3);
    expect(first.items.map((note) => note.id)).toEqual([paginationIds[2], paginationIds[1]]);
    expect(first.nextCursor).toEqual({
      id: paginationIds[1],
      updatedAt: "9999-12-31T23:59:59.000000Z",
    });

    const second = await repository.list({ limit: 2, cursor: first.nextCursor });
    expect(second.totalCount).toBe(first.totalCount);
    expect(second.items[0].id).toBe(paginationIds[0]);
    const loadedIds = [...first.items, ...second.items].map((note) => note.id);
    expect(loadedIds.filter((noteId) => paginationIds.includes(noteId))).toEqual([
      paginationIds[2],
      paginationIds[1],
      paginationIds[0],
    ]);
    expect(new Set(loadedIds).size).toBe(loadedIds.length);
    await pool.query("DELETE FROM notes WHERE id = ANY($1::uuid[])", [paginationIds]);
  });

  it("retains database microseconds in cursors so adjacent rows are not skipped", async () => {
    await pool.query(
      `INSERT INTO notes (id, title, body, color, updated_at)
       VALUES ($1, 'Precision 1', '', 'sage', '9999-12-30T00:00:00.123900Z'),
              ($2, 'Precision 2', '', 'sage', '9999-12-30T00:00:00.123800Z'),
              ($3, 'Precision 3', '', 'sage', '9999-12-30T00:00:00.123700Z')`,
      precisionIds,
    );

    const first = await repository.list({ limit: 1, cursor: null });
    const second = await repository.list({ limit: 1, cursor: first.nextCursor });
    const third = await repository.list({ limit: 1, cursor: second.nextCursor });

    expect([first.items[0].id, second.items[0].id, third.items[0].id]).toEqual(precisionIds);
    expect(first.items[0].updatedAt).toBe(second.items[0].updatedAt);
    expect(first.nextCursor?.updatedAt).toBe("9999-12-30T00:00:00.123900Z");
  });

  it("provides an index PostgreSQL can use for the listing order", async () => {
    const index = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'notes' AND indexname = 'notes_updated_at_id_idx'",
    );
    expect(index.rows[0]?.indexdef).toContain("(updated_at DESC, id DESC)");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL enable_seqscan = off");
      const plan = await client.query<{ "QUERY PLAN": string }>(
        "EXPLAIN SELECT id, title, body, color, updated_at FROM notes ORDER BY updated_at DESC, id DESC LIMIT 20",
      );
      expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain("notes_updated_at_id_idx");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
