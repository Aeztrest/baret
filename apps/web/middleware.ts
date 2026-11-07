import { ipAddress, next } from "@vercel/functions";

/**
 * Vercel Routing Middleware, in front of this site's `/api` rewrite to the
 * Baret server (vercel.json).
 *
 * It marks every request the site sends on with `x-baret-edge`, a secret the
 * server shares (BARET_EDGE_SECRET on both sides), and names the visitor's
 * address in `x-baret-client`. The server then knows the request came through
 * this site's edge and who the visitor is, so a caller who goes to the server
 * directly cannot pass for a visitor or invent addresses to dodge the rate
 * limits (apps/api/src/client.ts).
 *
 * The address is the one Vercel saw the connection from, not the
 * X-Forwarded-For the rewrite passes on: measured live, a visitor's made-up
 * X-Forwarded-For sometimes reaches the server in front of that list.
 *
 * Whatever the browser sent under those two names is dropped, never passed
 * on. With no secret set neither is sent and the rewrite goes on as before.
 */
export const config = { matcher: "/api/:path*" };

export default function middleware(request: Request): Response {
  const headers = new Headers(request.headers);
  const secret = process.env.BARET_EDGE_SECRET;
  const client = ipAddress(request);
  // Whatever a visitor sent under these names is dropped: only the edge writes them.
  headers.delete("x-baret-edge");
  headers.delete("x-baret-client");
  if (secret) {
    headers.set("x-baret-edge", secret);
    if (client) headers.set("x-baret-client", client);
  }
  return next({ request: { headers } });
}
