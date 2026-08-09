import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const connectionString = process.env.DATABASE_URL;

if (connectionString) {
  const { PostgresNoteRepository } = await import("@/server/note-repository");

  describe("PostgresNoteRepository integration", () => {
  const pool = new Pool({ connectionString });
  const repository = new PostgresNoteRepository(pool, async () => undefined);
  const id = randomUUID();

  afterAll(async () => {
    await pool.query("DELETE FROM notes WHERE id = $1", [id]);
    await pool.end();
  });

  it("covers the full note lifecycle against PostgreSQL", async () => {
    const ownerId = `integration-${id}`;
    const created = await repository.upsert(ownerId, {
      id,
      title: "Integration note",
      body: "Created",
      color: "gold",
      updatedAt: 1_700_000_000_000,
    });
    expect(created).toMatchObject({ id, title: "Integration note", color: "gold" });
    await expect(repository.list(ownerId)).resolves.toContainEqual(created);

    const updated = await repository.update(ownerId, id, {
      title: "Updated integration note",
      body: "Updated",
      color: "sky",
    });
    expect(updated).toMatchObject({ id, title: "Updated integration note", color: "sky" });

    await expect(repository.delete(ownerId, id)).resolves.toBe(true);
    await expect(repository.delete(ownerId, id)).resolves.toBe(false);
  });

  it("does not expose another owner's note", async () => {
    const ownerId = `owner-a-${id}`;
    const otherOwnerId = `owner-b-${id}`;
    await repository.upsert(ownerId, {
      id,
      title: "Private note",
      body: "Only owner A can read this",
      color: "coral",
      updatedAt: 1_700_000_000_000,
    });

    await expect(repository.list(otherOwnerId)).resolves.toEqual([]);
    await expect(repository.update(otherOwnerId, id, { title: "Changed", body: "Changed", color: "sky" })).resolves.toBeNull();
    await expect(repository.delete(otherOwnerId, id)).resolves.toBe(false);
  });
  });
} else {
  describe.skip("PostgresNoteRepository integration", () => {});
}
