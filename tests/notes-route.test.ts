import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/server/note-repository", () => ({ noteRepository: repository }));

import { POST } from "@/app/api/notes/route";

const createdNote = {
  id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
  title: "Created by the server",
  body: "Some text",
  color: "sage" as const,
  updatedAt: 1_700_000_000_000,
};

describe("POST /api/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates from editable fields and returns the server-generated note", async () => {
    repository.create.mockResolvedValue(createdNote);
    const response = await POST(new Request("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ title: "Created by the server", body: "Some text", color: "sage" }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(createdNote);
    expect(repository.create).toHaveBeenCalledWith({
      title: "Created by the server",
      body: "Some text",
      color: "sage",
    });
  });

  it("rejects client-controlled identity and timestamps", async () => {
    const response = await POST(new Request("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify(createdNote),
    }));

    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
