import { timingSafeEqual } from "node:crypto";

type TokenOwners = Map<string, string>;

function parseTokenOwners(value: string | undefined): TokenOwners | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const entries = Object.entries(parsed).filter(
      ([token, owner]) =>
        token.length > 0 && typeof owner === "string" && owner.length > 0 && owner.length <= 255,
    );
    return entries.length === Object.keys(parsed).length ? new Map(entries as [string, string][]) : null;
  } catch {
    return null;
  }
}

function matchesToken(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

/**
 * Returns the stable owner ID associated with a Bearer token, or null when the
 * request is unauthenticated. `PAPIER_AUTH_TOKENS` is a JSON object mapping
 * bearer tokens to owner IDs and must be supplied by the deployment.
 */
export function authenticatedOwner(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const tokenOwners = parseTokenOwners(process.env.PAPIER_AUTH_TOKENS);
  if (!tokenOwners) return null;

  for (const [expectedToken, owner] of tokenOwners) {
    if (matchesToken(expectedToken, token)) return owner;
  }

  return null;
}
