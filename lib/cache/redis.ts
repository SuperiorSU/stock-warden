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

export async function invalidatePattern(pattern: string) {
  const client = await getRedis();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
}
