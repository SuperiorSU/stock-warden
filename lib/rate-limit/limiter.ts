import { getRedis } from "@/lib/cache/redis";

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

export async function rateLimit(identifier: string, config: RateLimitConfig) {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  const client = await getRedis();
  const multi = client.multi();
  multi.zRemRangeByScore(key, 0, windowStart);
  multi.zAdd(key, [{ score: now, value: `${now}-${Math.random()}` }]);
  multi.zCard(key);
  multi.expire(key, config.windowSeconds);
  const results = await multi.exec();

  const count = typeof results?.[2] === "number" ? results[2] : 0;
  const allowed = count <= config.maxRequests;
  const resetAt = Math.floor(now / 1000) + config.windowSeconds;

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt,
  };
}
