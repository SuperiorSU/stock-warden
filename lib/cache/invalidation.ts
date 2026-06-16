import { getRedis } from "./redis";
import { invalidatePattern } from "./redis";
import { CacheKeys } from "./keys";

export const InvalidationTriggers = {
  requestStatusChanged: async (sessionYear: number, userId: string) => {
    const client = await getRedis();
    await Promise.all([
      client.del(CacheKeys.userStats(userId)),
      client.del(CacheKeys.notifCount(userId)),
      client.del(CacheKeys.adminStatsItems(sessionYear)),
      client.del(CacheKeys.adminStatsReqs(sessionYear, "monthly")),
      client.del(CacheKeys.adminStatsReqs(sessionYear, "yearly")),
      invalidatePattern(`sa:empr:${sessionYear}:*`),
      invalidatePattern(`adm:exp:${sessionYear}:*`),
      invalidatePattern(`adm:con:${sessionYear}:*`),
    ]);
  },

  inventoryItemChanged: async (itemId: string, sessionYear: number) => {
    const client = await getRedis();
    await Promise.all([
      client.del(CacheKeys.inventoryItem(itemId)),
      invalidatePattern(`inv:list:${sessionYear}:*`),
    ]);
  },

  userProfileChanged: async (userId: string) => {
    const client = await getRedis();
    await client.del(CacheKeys.userStats(userId));
  },
};
