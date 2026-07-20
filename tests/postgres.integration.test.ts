import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresNoteRepository } from "@/server/note-repository";

const connectionString = process.env.DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("PostgresNoteRepository integration", () => {
  const pool = new Pool({ connectionString });
  const repository = new PostgresNoteRepository(pool, async () => undefined);
  const id = randomUUID();

  afterAll(async () => {
    await pool.query("DELETE FROM notes WHERE id = $1", [id]);
    await pool.end();
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
