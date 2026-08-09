import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/server/note-repository", () => ({ noteRepository: repository }));

import { GET } from "@/app/api/notes/route";

const cursor = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  updatedAt: "2023-11-14T22:13:20.123456Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.list.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
});

describe("GET /api/notes", () => {
  it("uses the bounded default and returns an opaque continuation cursor", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: cursor, totalCount: 42 });

    const response = await GET(new Request("http://localhost/api/notes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith({ limit: 10, cursor: null });
    expect(body).toEqual({ items: [], nextCursor: expect.any(String), totalCount: 42 });

    await GET(new Request(`http://localhost/api/notes?cursor=${encodeURIComponent(body.nextCursor)}`));
    expect(repository.list).toHaveBeenLastCalledWith({ limit: 10, cursor });
  });

  it.each(["0", "101", "1.5", "nope", ""])("rejects invalid limit %j", async (limit) => {
    const response = await GET(new Request(`http://localhost/api/notes?limit=${limit}`));
    expect(response.status).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("accepts the documented maximum page size", async () => {
    const response = await GET(new Request("http://localhost/api/notes?limit=100"));
    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith({ limit: 100, cursor: null });
  });

  it.each([
    "not-a-cursor",
    Buffer.from(JSON.stringify({ ...cursor, id: "invalid" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, updatedAt: "2023-02-31T00:00:00.000000Z" })).toString("base64url"),
  ])("rejects malformed cursors", async (value) => {
    const response = await GET(new Request(`http://localhost/api/notes?cursor=${encodeURIComponent(value)}`));
    expect(response.status).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });
});
