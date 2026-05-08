import "server-only";
import IORedis from "ioredis";

let _redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  return _redis;
}

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns { success: true } if under the limit, { success: false } if exceeded.
 * Silently allows through if Redis is unavailable (fail-open) to avoid blocking
 * legitimate users during a Redis outage.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number }> {
  try {
    const redis = getRedis();
    const windowKey = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, windowSeconds);
    const remaining = Math.max(0, maxRequests - count);
    return { success: count <= maxRequests, remaining };
  } catch {
    // Fail open — don't block users if Redis is down
    return { success: true, remaining: maxRequests };
  }
}
