import { afterEach, describe, expect, it } from "vitest";
import { authenticatedOwner } from "@/server/auth";

const originalTokens = process.env.PAPIER_AUTH_TOKENS;

afterEach(() => {
  if (originalTokens === undefined) delete process.env.PAPIER_AUTH_TOKENS;
  else process.env.PAPIER_AUTH_TOKENS = originalTokens;
});

describe("authenticatedOwner", () => {
  it("rejects missing, malformed, and unknown credentials", () => {
    process.env.PAPIER_AUTH_TOKENS = JSON.stringify({ "alice-token": "alice" });
    expect(authenticatedOwner(new Request("http://test/api/notes"))).toBeNull();
    expect(authenticatedOwner(new Request("http://test/api/notes", { headers: { Authorization: "Basic abc" } }))).toBeNull();
    expect(authenticatedOwner(new Request("http://test/api/notes", { headers: { Authorization: "Bearer unknown" } }))).toBeNull();

    process.env.PAPIER_AUTH_TOKENS = "not-json";
    expect(authenticatedOwner(new Request("http://test/api/notes", { headers: { Authorization: "Bearer alice-token" } }))).toBeNull();
  });

  it("maps a valid bearer token to its configured owner", () => {
    process.env.PAPIER_AUTH_TOKENS = JSON.stringify({ "alice-token": "alice", "bob-token": "bob" });
    expect(
      authenticatedOwner(new Request("http://test/api/notes", { headers: { Authorization: "Bearer bob-token" } })),
    ).toBe("bob");
  });
});
