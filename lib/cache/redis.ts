import { createClient } from "redis";

const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
  },
});

redisClient.on("error", (error) => {
  console.error("Redis Client Error", error);
});

const redisReady = redisClient.connect();

export async function getRedis() {
  await redisReady;
  return redisClient;
}

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>) {
  const client = await getRedis();
  const cachedValue = await client.get(key);
  if (cachedValue) {
    return JSON.parse(cachedValue) as T;
  }

  const result = await fn();
  await client.setEx(key, ttlSeconds, JSON.stringify(result));
  return result;
}

// Per-namespace max value sizes in bytes
const MAX_VALUE_SIZES: Record<string, number> = {
  "inv:list":  150_000,
  "inv:item":   20_000,
  "adm:stats":  50_000,
  "sa:empr":   200_000,
  "sa:itma":   100_000,
  "usr:stats":  10_000,
  "usr:notif":     200,
};

export async function cachedSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  const serialised = JSON.stringify(value);
  const sizeBytes = Buffer.byteLength(serialised, "utf8");
  const prefix = key.split(":").slice(0, 2).join(":");
  const maxSize = MAX_VALUE_SIZES[prefix] ?? 50_000;

  if (sizeBytes > maxSize) {
    console.warn(`[Cache] Skipping oversized value for ${key}: ${sizeBytes} bytes > ${maxSize}`);
    return false;
  }

  const client = await getRedis();
  await client.setEx(key, ttlSeconds, serialised);
  return true;
}

export async function cachedGet<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Uses SCAN instead of KEYS — safe for production Redis
export async function invalidatePattern(pattern: string) {
  const client = await getRedis();
  let cursor: string | number = "0";
  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanResult: { cursor: string | number; keys: string[] } = await (client as any).scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = String(scanResult.cursor);
    if (scanResult.keys && scanResult.keys.length > 0) {
      await client.del(scanResult.keys);
    }
  } while (cursor !== "0");
}
