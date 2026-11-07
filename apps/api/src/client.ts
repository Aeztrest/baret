import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

/**
 * Who a request comes from, for the rate limits.
 *
 * Every proxy on the way appends the address it received the request from to
 * X-Forwarded-For, so only the last entries are written by proxies we know;
 * anything to their left is whatever the caller sent. The server therefore
 * has to know how many entries its own proxies add:
 *
 *   directHops  on a request straight to the API (the host's proxy),
 *   edgeHops    on a request through a site's rewrite, which the site's edge
 *               marks with a shared secret in `x-baret-edge`.
 *
 * The client is the entry that many places from the right. A direct caller
 * who writes a made-up address in front gets no new identity, and one who
 * claims to be a site without the secret is counted as direct.
 *
 * A site's edge also names the visitor itself, in `x-baret-client`, and on a
 * marked request that address wins over the count: measured on the live
 * sites, the first entry the edge's rewrite forwards is not always its own
 * (a visitor's made-up X-Forwarded-For sometimes arrives in its place). The
 * header counts for nothing without the secret.
 *
 * With `directHops` unset nothing is known about the proxies and the client
 * is Fastify's `req.ip` (the first entry), as before.
 */
export interface ProxyTrust {
  directHops: number | null;
  edgeHops: number | null;
  edgeSecret: string | null;
}

export const EDGE_HEADER = "x-baret-edge";
export const EDGE_CLIENT_HEADER = "x-baret-client";

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Whether the request carries the sites' edge secret. False when no secret is configured. */
export function viaEdge(req: FastifyRequest, trust: ProxyTrust): boolean {
  const mark = req.headers[EDGE_HEADER];
  return trust.edgeSecret !== null && typeof mark === "string" && same(mark, trust.edgeSecret);
}

export function clientOf(req: FastifyRequest, trust: ProxyTrust): string {
  if (trust.directHops === null) return req.ip;
  const header = req.headers["x-forwarded-for"];
  const entries = (Array.isArray(header) ? header.join(",") : (header ?? ""))
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const marked = viaEdge(req, trust);
  const named = req.headers[EDGE_CLIENT_HEADER];
  if (marked && typeof named === "string" && isIP(named) !== 0) return named;
  const hops = marked && trust.edgeHops !== null ? trust.edgeHops : trust.directHops;
  // Fewer entries than our proxies add: not through them at all (a local call).
  const peer = req.socket.remoteAddress ?? req.ip;
  return hops === 0 ? peer : (entries[entries.length - hops] ?? peer);
}
