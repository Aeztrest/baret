import { readFileSync } from "node:fs";

/** NAME=value lines of a local env file; an absent file is empty, never an error. */
export function readEnvFile(path: string): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m?.[1]) out[m[1]] = (m[2] ?? "").replace(/^"(.*)"$/, "$1");
    }
    return out;
  } catch {
    return {};
  }
}
