import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresNoteRepository } from "@/server/note-repository";

const connectionString = process.env.DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const execFileAsync = promisify(execFile);

describeWithDatabase("PostgresNoteRepository integration", () => {
  const pool = new Pool({ connectionString });
  const schema = `papier_test_${randomUUID().replaceAll("-", "")}`;
  let client!: Awaited<ReturnType<Pool["connect"]>>;
  let repository!: PostgresNoteRepository;
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

  async function runMigrations() {
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, PGOPTIONS: `-c search_path=${schema}` },
    });
  }

  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await runMigrations();
    await runMigrations();
    client = await pool.connect();
    await client.query(`SET search_path TO ${schema}`);
    repository = new PostgresNoteRepository(client);
  });

  afterAll(async () => {
    client?.release();
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it("initializes a clean database from committed migrations and safely re-runs them", async () => {
    const result = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    expect(result.rows).toEqual([{ version: "001_create_notes.sql" }]);
  });

  it("covers the full note lifecycle against PostgreSQL", async () => {
    const created = await repository.create({
      title: "Integration note",
      body: "Created",
      color: "gold",
    });
    expect(created).toMatchObject({ title: "Integration note", color: "gold" });
    await expect(repository.list({ limit: 100, cursor: null })).resolves.toMatchObject({
      items: expect.arrayContaining([created]),
    });

    const updated = await repository.update(created.id, {
      title: "Updated integration note",
      body: "Updated",
      color: "sky",
    });
    expect(updated).toMatchObject({ id: created.id, title: "Updated integration note", color: "sky" });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    await expect(repository.delete(created.id)).resolves.toBe(false);
  });

  it("paginates equal timestamps with the UUID as a stable descending tie-breaker", async () => {
    await client.query(
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
    await client.query("DELETE FROM notes WHERE id = ANY($1::uuid[])", [paginationIds]);
  });

  it("retains database microseconds in cursors so adjacent rows are not skipped", async () => {
    await client.query(
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
    const index = await client.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = 'notes' AND indexname = 'notes_updated_at_id_idx'",
      [schema],
    );
    expect(index.rows[0]?.indexdef).toContain("(updated_at DESC, id DESC)");

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL enable_seqscan = off");
      const plan = await client.query<{ "QUERY PLAN": string }>(
        "EXPLAIN SELECT id, title, body, color, updated_at FROM notes ORDER BY updated_at DESC, id DESC LIMIT 20",
      );
      expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain("notes_updated_at_id_idx");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
