import { createHash } from "node:crypto";

const windowSeconds = 60;
const maxRequests = 12;
const localCounts = new Map<string, { count: number; resetAt: number }>();

const incrementScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  "return { count <= tonumber(ARGV[2]) and 1 or 0, math.max(ttl, 1) }",
].join("\n");

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: false; unavailable: true };

function checkLocalWindow(identity: string): RateLimitDecision {
  const now = Date.now();
  const current = localCounts.get(identity);

  if (!current || current.resetAt <= now) {
    localCounts.set(identity, { count: 1, resetAt: now + windowSeconds * 1_000 });
    return { allowed: true };
  }

  current.count += 1;
  if (localCounts.size > 5_000) {
    for (const [key, value] of localCounts) {
      if (value.resetAt <= now) localCounts.delete(key);
    }
  }

  return current.count > maxRequests
    ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) }
    : { allowed: true };
}

function getUpstashEndpoint(value: string): string | null {
  try {
    const endpoint = new URL(value);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    return endpoint.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function checkChatRateLimit(identity: string): Promise<RateLimitDecision> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

  if (!restUrl && !restToken) {
    return process.env.NODE_ENV === "production"
      ? { allowed: false, unavailable: true }
      : checkLocalWindow(identity);
  }
  if (!restUrl || !restToken) return { allowed: false, unavailable: true };

  const endpoint = getUpstashEndpoint(restUrl);
  if (!endpoint) return { allowed: false, unavailable: true };

  const key = `aqizaai:chat:${createHash("sha256").update(identity).digest("hex")}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${restToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", incrementScript, "1", key, String(windowSeconds), String(maxRequests)]),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return { allowed: false, unavailable: true };

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) {
      return { allowed: false, unavailable: true };
    }

    const result = (payload as { result?: unknown }).result;
    if (!Array.isArray(result) || result.length < 2) return { allowed: false, unavailable: true };
    const allowed = Number(result[0]) === 1;
    const retryAfterSeconds = Math.max(1, Math.ceil(Number(result[1])));
    if (!Number.isFinite(retryAfterSeconds)) return { allowed: false, unavailable: true };
    return allowed ? { allowed: true } : { allowed: false, retryAfterSeconds };
  } catch {
    return { allowed: false, unavailable: true };
  }
}
