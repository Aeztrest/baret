# @baret/guard

A pre-sign check for any chain Baret serves. Send Baret the transaction (or the signed message, or the x402 payment) before you sign it; it answers `safe`, `caution` or `blocked` with the reasons and the balance changes. Your code decides what to do with the answer. It never signs or sends anything.

```
npm install @baret/guard
```

Built JavaScript with type declarations, plain Node or any bundler. No chain library inside; the only dependencies are `@baret/core` (the shared contract) and `zod`.

## The smallest working call

```ts
import { TransactionGuard } from "@baret/guard";

const guard = new TransactionGuard({ baseUrl: "https://<your Baret API>" });

const verdict = await guard.evaluate({
  chain: "eip155:10143", // Monad testnet (CAIP-2)
  request: {
    kind: "call",
    tx: {
      from: "0x306707be3CD50B1Cca5E27F838AfcfC4fD84C353",
      to: "0xac9517a70c88480c9fA7E9a280DA485F7f552C29",
      value: "100000000000000000", // 0.1 MON, in wei
      data: "0x",
    },
  },
  policyTemplate: "balanced", // or "strict" / "permissive", or a full `policy`
});

verdict.decision; // "blocked"
verdict.findings.map((f) => f.code); // ["KNOWN_MALICIOUS_ADDRESS"]
```

Checked on 2026-11-07 with the packed tarballs installed in an empty project, against `apps/api` running on Monad testnet: the address above (where the NovaSwap drainer sends what it takes, listed in Baret's on-chain registry) comes back `blocked` with `KNOWN_MALICIOUS_ADDRESS`; the same transfer to a plain wallet comes back `safe` with no findings, high confidence.

## Fail-closed

| Situation | What `evaluate` does |
|---|---|
| The request is off the schema | throws a `ZodError` before sending |
| No answer, a timeout, a non-2xx status | throws `GuardUnreachableError` (`status`, and `body` with the server's `{ error: { code, message } }`) |
| A 200 that breaks the contract (including a decision that contradicts its findings) | throws `GuardUnreachableError` |

Treat every throw as **Blocked** ("Can't reach Baret").

## Helpers

- `isSafe(verdict)` — no findings: sign without asking.
- `isSignable(verdict)` — not blocked: a person may sign after reading the findings.
- `verdictRefusal(verdict, { chain, now? })` — `"expired"` or `"wrong_chain"` when the verdict must not be signed on; call it right before signing.

Everything in `@baret/core` is re-exported: the request and verdict types and schemas, `GuardPolicy` v2, `createPolicy`, `migratePolicyV1`, chain identifiers.

## From 0.1.x (Monad only)

0.2.0 is the multichain line and breaks 0.1.x: `network: "testnet"` → `chain: "eip155:10143"`; `transaction` / `typedData` → `request: { kind: "call" | "raw" | "typed-data", … }`; `userWallet` → `account` (CAIP-10); policy v1 → v2 (`migratePolicyV1` converts saved ones); finding codes are unified (`ERC20_APPROVAL_UNLIMITED` → `APPROVAL_UNLIMITED`, map in `V1_FINDING_CODE_MAP`); `expiresAt` is Unix seconds.

License: MIT.
