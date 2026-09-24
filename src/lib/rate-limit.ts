import { NextResponse } from "next/server";

/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * The app runs as a single Node process with local-memory caching by
 * design, so a per-process limiter is the right first line of defence:
 * it stops OAuth-start abuse on /api/auth/google, contact-spam, upload
 * floods and analytics abuse without adding any infrastructure.
 *
 * Buckets are keyed by `name:ip`; the map is pruned when it grows past
 * MAX_BUCKETS so long uptimes don't leak memory.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number) {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP (this app sits behind the Caddy gateway). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Applies a named limit for the caller's IP. Returns a 429 response with
 * the standard `{ error }` envelope + Retry-After header when exceeded,
 * or null when the request may proceed.
 */
export function guard(
  request: Request,
  name: string,
  limit: number,
  windowMs = 60_000
): NextResponse | null {
  const { ok, retryAfterSec } = rateLimit(`${name}:${clientIp(request)}`, limit, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: `Too many requests — please try again in ${retryAfterSec}s` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
