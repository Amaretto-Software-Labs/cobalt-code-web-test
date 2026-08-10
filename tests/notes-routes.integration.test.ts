import { randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const schemaName = `notes_integration_${randomUUID().replaceAll("-", "")}`;
const execFileAsync = promisify(execFile);

async function findAvailablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to select an HTTP port");
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

function databaseUrlForSchema(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.set("options", `-c search_path=${schemaName}`);
  return url.toString();
}

async function waitForServer(origin: string, process: ChildProcess) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`Next.js server exited with code ${process.exitCode}`);
    try {
      const response = await fetch(`${origin}/api/notes`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for the Next.js server");
}

describeWithDatabase("notes HTTP integration", () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const portPromise = findAvailablePort();
  let server: ChildProcess | undefined;
  let origin = "";

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    const scopedDatabaseUrl = databaseUrlForSchema(databaseUrl!);
    const databaseEnvironment = { ...process.env, DATABASE_URL: scopedDatabaseUrl };
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: databaseEnvironment,
    });
    await execFileAsync(process.execPath, ["scripts/check-schema.mjs"], {
      cwd: process.cwd(),
      env: databaseEnvironment,
    });

    const port = await portPromise;
    origin = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        env: databaseEnvironment,
        stdio: "ignore",
      },
    );
    await waitForServer(origin, server);
  }, 35_000);

  afterAll(async () => {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await once(server, "exit");
    }
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.end();
  });

  async function request(path: string, init?: RequestInit) {
    return fetch(`${origin}${path}`, init);
  }

  async function json(response: Response) {
    return response.json() as Promise<Record<string, unknown>>;
  }

  it("bootstraps an isolated schema and lists notes over HTTP", async () => {
    const response = await request("/api/notes");

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ items: [], nextCursor: null, totalCount: 0 });
    await expect(
      adminPool.query("SELECT to_regclass($1) IS NOT NULL AS exists", [`${schemaName}.notes`]),
    ).resolves.toMatchObject({ rows: [{ exists: true }] });
  });

  it("validates malformed and invalid create requests", async () => {
    const malformed = await request("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(await json(malformed)).toEqual({ error: "Invalid note" });

    const invalid = await request("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: randomUUID(), title: "Valid", body: "Body", color: "invalid", updatedAt: 1 }),
    });
    expect(invalid.status).toBe(400);
    expect(await json(invalid)).toEqual({ error: "Invalid note" });
  });

  it("supports the documented note lifecycle and failure responses", async () => {
    const createdResponse = await request("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Integration note", body: "Created over HTTP", color: "gold" }),
    });
    expect(createdResponse.status).toBe(201);
    const created = await json(createdResponse);
    expect(created).toMatchObject({
      id: expect.any(String),
      title: "Integration note",
      body: "Created over HTTP",
      color: "gold",
      updatedAt: expect.any(Number),
    });
    const id = created.id as string;

    const invalidPatch = await request("/api/notes/not-a-uuid", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Valid", body: "Body", color: "sky" }),
    });
    expect(invalidPatch.status).toBe(400);
    expect(await json(invalidPatch)).toEqual({ error: "Invalid note" });

    const invalidFields = await request(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Valid", body: "Body", color: "invalid" }),
    });
    expect(invalidFields.status).toBe(400);
    expect(await json(invalidFields)).toEqual({ error: "Invalid note" });

    const missingId = randomUUID();
    const missingPatch = await request(`/api/notes/${missingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Valid", body: "Body", color: "sky" }),
    });
    expect(missingPatch.status).toBe(404);
    expect(await json(missingPatch)).toEqual({ error: "Note not found" });

    const updatedResponse = await request(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated", body: "Updated over HTTP", color: "sky" }),
    });
    expect(updatedResponse.status).toBe(200);
    expect(await json(updatedResponse)).toMatchObject({ id, title: "Updated", body: "Updated over HTTP", color: "sky" });

    const invalidDelete = await request("/api/notes/not-a-uuid", { method: "DELETE" });
    expect(invalidDelete.status).toBe(400);
    expect(await json(invalidDelete)).toEqual({ error: "Invalid note id" });

    const missingDelete = await request(`/api/notes/${missingId}`, { method: "DELETE" });
    expect(missingDelete.status).toBe(404);
    expect(await json(missingDelete)).toEqual({ error: "Note not found" });

    const deleted = await request(`/api/notes/${id}`, { method: "DELETE" });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");

    const listed = await request("/api/notes");
    expect(listed.status).toBe(200);
    expect(await json(listed)).toEqual({ items: [], nextCursor: null, totalCount: 0 });
  });
});
