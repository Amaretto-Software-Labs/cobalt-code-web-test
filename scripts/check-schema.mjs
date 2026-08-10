import process from "node:process";
import pg from "pg";
import { loadDatabaseEnvironment } from "./load-database-environment.mjs";

async function checkSchema() {
  await loadDatabaseEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT to_regclass('notes') AS notes_table");
    if (!result.rows[0]?.notes_table) throw new Error("the notes table is missing");
    await pool.query("SELECT id, title, body, color, updated_at FROM notes LIMIT 0");
  } finally {
    await pool.end();
  }
}

checkSchema().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Database schema is unavailable (${detail}). Run 'npm run db:migrate' before starting the application.`);
  process.exitCode = 1;
});
