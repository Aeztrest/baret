/**
 * Sends every demo scenario to a Baret API and compares the decision and the finding
 * codes with what the site expects (src/scenarios.ts). Exits 1 on any disagreement.
 *
 *   pnpm --filter @baret/demo-evm verify -- --api https://baret-api-staging.onrender.com --from 0x...
 *
 * `--from` is only simulated from (no key). It needs some MON, and real test USDC for
 * the payment scenarios. `--only <text>` runs the scenarios whose name contains it;
 * `--pause <ms>` waits between requests.
 */
import { verdictSchema } from "@baret/core";
import { type Address, getAddress } from "viem";
import { demoScenarios } from "../src/scenarios.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const api = (arg("api") ?? "http://localhost:8080").replace(/\/+$/, "");
const fromArg = arg("from");
if (!fromArg) {
  console.error("usage: verify --from 0x<funded testnet wallet> [--api <url>]");
  process.exit(2);
}
const from: Address = getAddress(fromArg);
const only = arg("only")?.toLowerCase();
const pause = Number(arg("pause") ?? 0);
const picked = demoScenarios(from).filter((s) => !only || s.name.toLowerCase().includes(only));

const sorted = (xs: readonly string[]) => [...xs].sort().join(",");
let failed = 0;

for (const s of picked) {
  if (pause > 0) await new Promise((r) => setTimeout(r, pause));
  let line: string;
  try {
    const res = await fetch(`${api}/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s.body),
      signal: AbortSignal.timeout(90_000),
    });
    const json: unknown = await res.json();
    const parsed = verdictSchema.safeParse(json);
    if (!res.ok || !parsed.success) {
      line = `FAIL  HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`;
      failed++;
    } else {
      const got = parsed.data.findings.map((f) => f.code);
      const ok = parsed.data.decision === s.decision && sorted(got) === sorted(s.codes);
      if (!ok) failed++;
      line = ok
        ? `ok    ${parsed.data.decision}`
        : `FAIL  got ${parsed.data.decision} [${got.join(", ")}], want ${s.decision} [${s.codes.join(", ")}]`;
    }
  } catch (e) {
    line = `FAIL  ${(e as Error).message}`;
    failed++;
  }
  console.log(`${s.name.padEnd(58)} ${line}`);
}

console.log(`\n${picked.length - failed} of ${picked.length} agree`);
process.exit(failed > 0 ? 1 : 0);
