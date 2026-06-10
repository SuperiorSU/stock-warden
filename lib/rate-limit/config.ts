export const RATE_LIMITS = {
  LOGIN: { windowSeconds: 600, maxRequests: 5, keyPrefix: "rl:login" },
  LOGIN_HARD_LOCK: { windowSeconds: 600, maxRequests: 10, keyPrefix: "rl:login:hard" },
  REFRESH: { windowSeconds: 60, maxRequests: 10, keyPrefix: "rl:refresh" },
  API_USER: { windowSeconds: 60, maxRequests: 60, keyPrefix: "rl:api:user" },
  API_ADMIN: { windowSeconds: 60, maxRequests: 120, keyPrefix: "rl:api:admin" },
  CREATE_REQUEST: { windowSeconds: 300, maxRequests: 5, keyPrefix: "rl:create-request" },
  STOCK_ALERT: { windowSeconds: 86400, maxRequests: 3, keyPrefix: "rl:stock-alert" },
  UPLOAD: { windowSeconds: 3600, maxRequests: 20, keyPrefix: "rl:upload" },
};
