import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { UnauthorizedError } from "@/lib/errors";
import { cached } from "@/lib/cache/redis";

export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const cacheKey = "super-admin:stats:requests";

  const data = await cached(cacheKey, 600, async () => {
    const byAdmin = await prisma.$queryRaw<
      { adminId: string | null; processed: number }[]
    >`
      SELECT r."adminId" as "adminId", COUNT(*) as processed
      FROM "Request" r
      WHERE r."adminId" IS NOT NULL
      GROUP BY r."adminId"
      ORDER BY processed DESC;
    `;

    const byDepartment = await prisma.$queryRaw<
      { department: string | null; total: number }[]
    >`
      SELECT u.department as department, COUNT(*) as total
      FROM "Request" r
      JOIN "User" u ON u.id = r."userId"
      GROUP BY u.department
      ORDER BY total DESC;
    `;

    const byItem = await prisma.$queryRaw<
      { itemId: string; name: string; total: number }[]
    >`
      SELECT i.id as "itemId", i.name as name, COALESCE(SUM(ri."quantityReq"), 0) as total
      FROM "RequestItem" ri
      JOIN "InventoryItem" i ON i.id = ri."itemId"
      GROUP BY i.id, i.name
      ORDER BY total DESC;
    `;

    return {
      byAdmin: byAdmin.map((row) => ({
        adminId: row.adminId,
        processed: Number(row.processed),
      })),
      byDepartment: byDepartment.map((row) => ({
        department: row.department ?? "Unknown",
        total: Number(row.total),
      })),
      byItem: byItem.map((row) => ({
        itemId: row.itemId,
        name: row.name,
        total: Number(row.total),
      })),
    };
  });

  return apiSuccess(data);
}

export const dynamic = "force-dynamic";
