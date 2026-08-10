import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { loadDatabaseEnvironment } from "./load-database-environment.mjs";

const migrationsDirectory = path.resolve(import.meta.dirname, "../migrations");
const migrationName = /^\d+_[\w-]+\.sql$/;

async function getMigrations() {
  const filenames = (await readdir(migrationsDirectory)).filter((filename) => migrationName.test(filename)).sort();
  if (filenames.length === 0) throw new Error("No migration files were found");

  return Promise.all(
    filenames.map(async (filename) => ({
      filename,
      sql: await readFile(path.join(migrationsDirectory, filename), "utf8"),
    })),
  );
}

async function migrate() {
  await loadDatabaseEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["papier-schema-migrations"]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of await getMigrations()) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [migration.filename]);
      if (applied.rowCount) continue;

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration.filename]);
        await client.query("COMMIT");
        console.log(`Applied ${migration.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["papier-schema-migrations"]);
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(`Database migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
