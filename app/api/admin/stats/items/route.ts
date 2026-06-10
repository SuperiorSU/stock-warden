import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { AdminStatsItemsSchema } from "@/lib/validation/stats";
import { cached } from "@/lib/cache/redis";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }
  if (user.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Access restricted.'));
  }

  const url = new URL(req.url);
  const parsed = AdminStatsItemsSchema.safeParse({
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    itemId: url.searchParams.get("itemId") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const sessionYear =
    parsed.data.sessionYear ?? Number(process.env.SESSION_YEAR_CURRENT ?? "");
  if (!sessionYear || Number.isNaN(sessionYear)) {
    return apiError(new ValidationError("Invalid session year."));
  }

  const itemId = parsed.data.itemId;
  const cacheKey = `admin:stats:items:${sessionYear}:${itemId ?? "all"}`;

  const data = await cached(cacheKey, 300, async () => {
    const items = await prisma.inventoryItem.findMany({
      where: {
        sessionYear,
        ...(itemId ? { id: itemId } : {}),
      },
      select: { id: true, name: true, totalQuantity: true, availableQty: true },
    });

    const totals = itemId
      ? await prisma.$queryRaw<
          { itemId: string; totalRequested: number; totalFulfilled: number; totalRejected: number }[]
        >`
          SELECT
            ri."itemId" as "itemId",
            COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
            COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalFulfilled",
            COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
          FROM "RequestItem" ri
          JOIN "Request" r ON r.id = ri."requestId"
          WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
          GROUP BY ri."itemId";
        `
      : await prisma.$queryRaw<
          { itemId: string; totalRequested: number; totalFulfilled: number; totalRejected: number }[]
        >`
          SELECT
            ri."itemId" as "itemId",
            COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
            COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalFulfilled",
            COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
          FROM "RequestItem" ri
          JOIN "Request" r ON r.id = ri."requestId"
          WHERE r."sessionYear" = ${sessionYear}
          GROUP BY ri."itemId";
        `;

    const totalsMap = new Map(totals.map((row) => [row.itemId, row]));

    const resultItems = items.map((item) => {
      const stats = totalsMap.get(item.id);
      return {
        itemId: item.id,
        name: item.name,
        totalRequested: Number(stats?.totalRequested ?? 0),
        totalFulfilled: Number(stats?.totalFulfilled ?? 0),
        totalRejected: Number(stats?.totalRejected ?? 0),
        remainingStock: item.availableQty,
        usageSeries: itemId
          ? undefined
          : {
              monthly: [] as { month: string; qty: number }[],
              quarterly: [] as { quarter: string; qty: number }[],
            },
      };
    });

    let usageSeries = undefined as
      | { monthly: { month: string; qty: number }[]; quarterly: { quarter: string; qty: number }[] }
      | undefined;

    if (itemId) {
      const monthly = await prisma.$queryRaw<
        { bucket: Date; qty: number }[]
      >`
        SELECT date_trunc('month', r."createdAt") as bucket,
          COALESCE(SUM(ri."quantityReq"), 0) as qty
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
        GROUP BY bucket
        ORDER BY bucket ASC;
      `;

      const quarterly = await prisma.$queryRaw<
        { bucket: Date; qty: number }[]
      >`
        SELECT date_trunc('quarter', r."createdAt") as bucket,
          COALESCE(SUM(ri."quantityReq"), 0) as qty
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
        GROUP BY bucket
        ORDER BY bucket ASC;
      `;

      usageSeries = {
        monthly: monthly.map((row) => ({
          month: row.bucket.toISOString().slice(0, 7),
          qty: Number(row.qty),
        })),
        quarterly: quarterly.map((row) => {
          const month = row.bucket.getUTCMonth();
          const quarter = Math.floor(month / 3) + 1;
          return {
            quarter: `Q${quarter}-${row.bucket.getUTCFullYear()}`,
            qty: Number(row.qty),
          };
        }),
      };

      resultItems.forEach((item) => {
        if (item.itemId === itemId) {
          item.usageSeries = usageSeries;
        }
      });
    }

    const sortedByUsage = [...resultItems].sort(
      (a, b) => b.totalRequested - a.totalRequested
    );

    return {
      items: resultItems,
      summary: {
        mostUsed: sortedByUsage[0]
          ? { name: sortedByUsage[0].name, qty: sortedByUsage[0].totalRequested }
          : null,
        leastUsed: sortedByUsage[sortedByUsage.length - 1]
          ? {
              name: sortedByUsage[sortedByUsage.length - 1].name,
              qty: sortedByUsage[sortedByUsage.length - 1].totalRequested,
            }
          : null,
      },
    };
  });

  return apiSuccess(data);
}

export const dynamic = "force-dynamic";
