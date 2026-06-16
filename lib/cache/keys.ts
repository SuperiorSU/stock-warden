// Cache key builder — follows namespace:entity:identifier:variant convention
export const CacheKeys = {
  // Auth
  rateLimitLogin: (id: string) => `rl:login:${id}`,
  rateLimitApi:   (id: string) => `rl:api:${id}`,
  tokenBlacklist: (jti: string) => `bl:${jti}`,

  // Inventory
  inventoryList: (year: number, cursor: string) => `inv:list:${year}:${cursor}`,
  inventoryItem: (id: string) => `inv:item:${id}`,

  // Admin stats
  adminStatsItems: (year: number) => `adm:stats:items:${year}`,
  adminStatsReqs:  (year: number, g: string) => `adm:stats:reqs:${year}:${g}`,
  expenditure:     (year: number, g: string, cat?: string) =>
    `adm:exp:${year}:${g}:${cat ?? "all"}`,
  consumption: (year: number, g: string) => `adm:con:${year}:${g}`,

  // Super admin
  saEmpRequests:   (year: number, hash: string) => `sa:empr:${year}:${hash}`,
  saItemAnalytics: (year: number, mf: string, mt: string) =>
    `sa:itma:${year}:${mf || "0"}:${mt || "0"}`,

  // User
  userStats:  (userId: string) => `usr:stats:${userId}`,
  notifCount: (userId: string) => `usr:notif:${userId}`,
} as const;
