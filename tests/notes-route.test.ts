import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/server/note-repository", () => ({ noteRepository: repository }));

import { GET, POST } from "@/app/api/notes/route";

const cursor = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  updatedAt: "2023-11-14T22:13:20.123456Z",
};

function authenticatedRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", "Bearer alice-token");
  return new Request(url, { ...init, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAPIER_AUTH_TOKENS = JSON.stringify({ "alice-token": "alice" });
  repository.list.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
});

describe("GET /api/notes", () => {
  it("uses the bounded default and returns an opaque continuation cursor", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: cursor, totalCount: 42 });

    const response = await GET(authenticatedRequest("http://localhost/api/notes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith("alice", { limit: 10, cursor: null });
    expect(body).toEqual({ items: [], nextCursor: expect.any(String), totalCount: 42 });

    await GET(authenticatedRequest(`http://localhost/api/notes?cursor=${encodeURIComponent(body.nextCursor)}`));
    expect(repository.list).toHaveBeenLastCalledWith("alice", { limit: 10, cursor });
  });

  it.each(["0", "101", "1.5", "nope", ""])("rejects invalid limit %j", async (limit) => {
    const response = await GET(authenticatedRequest(`http://localhost/api/notes?limit=${limit}`));
    expect(response.status).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("accepts the documented maximum page size", async () => {
    const response = await GET(authenticatedRequest("http://localhost/api/notes?limit=100"));
    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith("alice", { limit: 100, cursor: null });
  });

  it.each([
    "not-a-cursor",
    Buffer.from(JSON.stringify({ ...cursor, id: "invalid" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, updatedAt: "2023-02-31T00:00:00.000000Z" })).toString("base64url"),
  ])("rejects malformed cursors", async (value) => {
    const response = await GET(authenticatedRequest(`http://localhost/api/notes?cursor=${encodeURIComponent(value)}`));
    expect(response.status).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("requires a valid bearer token", async () => {
    const response = await GET(new Request("http://localhost/api/notes"));
    expect(response.status).toBe(401);
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/notes", () => {
  const createdNote = {
    id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
    title: "Created by the server",
    body: "Some text",
    color: "sage" as const,
    updatedAt: 1_700_000_000_000,
  };

  it("creates from editable fields and returns the server-generated note", async () => {
    repository.create.mockResolvedValue(createdNote);
    const input = { title: createdNote.title, body: createdNote.body, color: createdNote.color };
    const response = await POST(authenticatedRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(createdNote);
    expect(repository.create).toHaveBeenCalledWith("alice", input);
  });

  it("rejects client-controlled identity and timestamps", async () => {
    const response = await POST(authenticatedRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify(createdNote),
    }));

    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
