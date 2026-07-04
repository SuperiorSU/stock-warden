export const ROLE_GUARDS: Record<string, string[]> = {
  "/api/user": ["USER", "ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/inventory-manager": ["INVENTORY_MANAGER"],
  "/api/admin": ["ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/super-admin": ["SUPER_ADMIN"],
  "/api/inventory": ["USER", "ADMIN", "INVENTORY_MANAGER", "SUPER_ADMIN"],
  "/api/auth": [],
};
