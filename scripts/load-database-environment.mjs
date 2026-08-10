import { readFile } from "node:fs/promises";
import path from "node:path";

function parseValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function loadDatabaseEnvironment() {
  const inheritedKeys = new Set(Object.keys(process.env));
  for (const filename of [".env", ".env.local"]) {
    try {
      const contents = await readFile(path.resolve(process.cwd(), filename), "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (match && !inheritedKeys.has(match[1])) process.env[match[1]] = parseValue(match[2]);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
