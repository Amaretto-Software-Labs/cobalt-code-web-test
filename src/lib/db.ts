import { Pool } from "pg";

const globalForDatabase = globalThis as unknown as {
  papierPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  return new Pool({ connectionString, max: 10 });
}

export const db = globalForDatabase.papierPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForDatabase.papierPool = db;
