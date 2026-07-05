export const ROLE_GUARDS: Record<string, string[]> = {
  "/api/user": ["USER", "ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/inventory-manager": ["INVENTORY_MANAGER"],
  // Reporting/export endpoints shared between ADMIN and SUPER_ADMIN — must be
  // listed before the generic "/api/super-admin" guard below (first-match wins).
  "/api/super-admin/employees": ["ADMIN", "SUPER_ADMIN"],
  "/api/super-admin/items": ["ADMIN", "SUPER_ADMIN"],
  "/api/super-admin/stats/items": ["ADMIN", "SUPER_ADMIN"],
  "/api/super-admin/export": ["ADMIN", "SUPER_ADMIN"],
  "/api/admin": ["ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/super-admin": ["SUPER_ADMIN"],
  "/api/inventory": ["USER", "ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/auth": [],
};
