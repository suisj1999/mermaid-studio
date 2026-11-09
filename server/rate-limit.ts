/**
 * In-process fixed-window rate limiter for the generation endpoint.
 *
 * The LLM call is the app's only metered, paid operation, so an
 * unauthenticated endpoint that spends money per request needs a guard.
 * State lives in the Node process, which is enough for a single instance
 * (self-hosted / `next start`). On serverless platforms each instance
 * keeps its own counters — treat this as abuse friction, not a quota.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TRACKED_KEYS = 10_000;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function prune(now: number): void {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // If everything is still live the map is capped by MAX_TRACKED_KEYS;
    // drop the oldest window so a flood of distinct keys cannot grow it
    // without bound.
  if (windows.size >= MAX_TRACKED_KEYS) {
    const oldest = windows.keys().next();
    if (!oldest.done) windows.delete(oldest.value);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds the caller should wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > MAX_REQUESTS) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client identity. `x-forwarded-for` is only trustworthy when
 * the app sits behind a proxy that overwrites it (Vercel, Cloudflare, nginx);
 * behind a bare origin it is client-controlled and merely raises the cost of
 * an attack.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip");
  if (ip) return ip;
  return headers.get("user-agent")?.slice(0, 120) ?? "anonymous";
}
