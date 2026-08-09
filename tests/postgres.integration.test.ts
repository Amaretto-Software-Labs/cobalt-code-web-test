import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PostgresNoteRepository as PostgresNoteRepositoryType } from "@/server/note-repository";

const connectionString = process.env.DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const execFileAsync = promisify(execFile);

describeWithDatabase("PostgresNoteRepository integration", () => {
  const pool = new Pool({ connectionString });
  let PostgresNoteRepository: typeof PostgresNoteRepositoryType;
  let repository: PostgresNoteRepositoryType;
  let client!: Awaited<ReturnType<Pool["connect"]>>;
  const schema = `papier_test_${randomUUID().replaceAll("-", "")}`;
  const id = randomUUID();

  async function runMigrations() {
    await execFileAsync("node", ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PGOPTIONS: `-c search_path=${schema},public`,
      },
    });
  }

  beforeAll(async () => {
    ({ PostgresNoteRepository } = await import("@/server/note-repository"));
    await pool.query(`CREATE SCHEMA ${schema}`);
    await runMigrations();
    await runMigrations();
    client = await pool.connect();
    await client.query(`SET search_path TO ${schema}, public`);
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
    const created = await repository.upsert({
      id,
      title: "Integration note",
      body: "Created",
      color: "gold",
      updatedAt: 1_700_000_000_000,
    });
    expect(created).toMatchObject({ id, title: "Integration note", color: "gold" });
    await expect(repository.list()).resolves.toContainEqual(created);

    const updated = await repository.update(id, {
      title: "Updated integration note",
      body: "Updated",
      color: "sky",
    });
    expect(updated).toMatchObject({ id, title: "Updated integration note", color: "sky" });

    await expect(repository.delete(id)).resolves.toBe(true);
    await expect(repository.delete(id)).resolves.toBe(false);
  });
});
