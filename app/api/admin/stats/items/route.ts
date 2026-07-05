import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { AdminStatsItemsSchema } from "@/lib/validation/stats";
import { cached } from "@/lib/cache/redis";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { getCurrentSessionYear } from "@/lib/utils/session-year";

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
    monthFrom: url.searchParams.get("monthFrom") ?? undefined,
    monthTo: url.searchParams.get("monthTo") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const sessionYear = parsed.data.sessionYear ?? getCurrentSessionYear();

  const itemId = parsed.data.itemId;
  const { monthFrom, monthTo, category, sortBy, order } = parsed.data;
  const dateFrom = monthFrom ? startOfMonth(parseISO(`${monthFrom}-01`)) : null;
  const dateTo = monthTo ? endOfMonth(parseISO(`${monthTo}-01`)) : null;
  const cacheKey = `admin:stats:items:${sessionYear}:${itemId ?? "all"}:${monthFrom ?? "all"}:${monthTo ?? "all"}:${category ?? "all"}:${sortBy ?? "default"}:${order ?? "desc"}`;

  const data = await cached(cacheKey, 300, async () => {
    type TotalsRow = { itemId: string; totalRequested: number; totalFulfilled: number; totalRejected: number };

    // Run items + totals in parallel regardless of itemId
    const [items, totals, expenditureAggregates] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: {
          sessionYear,
          ...(itemId ? { id: itemId } : {}),
          ...(category ? { category } : {}),
        },
        select: { id: true, name: true, category: true, unitPrice: true, totalQuantity: true, availableQty: true },
      }),
      itemId
        ? prisma.$queryRaw<TotalsRow[]>`
            SELECT
              ri."itemId" as "itemId",
              COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
              COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalFulfilled",
              COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
            FROM "RequestItem" ri
            JOIN "Request" r ON r.id = ri."requestId"
            WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
              ${dateFrom ? Prisma.sql`AND r."createdAt" >= ${dateFrom}` : Prisma.empty}
              ${dateTo ? Prisma.sql`AND r."createdAt" <= ${dateTo}` : Prisma.empty}
            GROUP BY ri."itemId";
          `
        : prisma.$queryRaw<TotalsRow[]>`
            SELECT
              ri."itemId" as "itemId",
              COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
              COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalFulfilled",
              COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
            FROM "RequestItem" ri
            JOIN "Request" r ON r.id = ri."requestId"
            WHERE r."sessionYear" = ${sessionYear}
              ${dateFrom ? Prisma.sql`AND r."createdAt" >= ${dateFrom}` : Prisma.empty}
              ${dateTo ? Prisma.sql`AND r."createdAt" <= ${dateTo}` : Prisma.empty}
            GROUP BY ri."itemId";
          `,
      prisma.expenditureRecord.groupBy({
        by: ["itemId"],
        where: {
          sessionYear,
          isReversed: false,
          ...(itemId ? { itemId } : {}),
          ...((dateFrom || dateTo) && {
            approvedAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
          }),
        },
        _sum: { totalAmount: true },
        _count: { requestId: true },
      }),
    ]);

    const totalsMap = new Map(totals.map((row) => [row.itemId, row]));
    const expenditureMap = new Map(
      expenditureAggregates.map((row) => [
        row.itemId,
        { totalAmountSpent: Number(row._sum.totalAmount ?? 0), totalRequestCount: row._count.requestId },
      ])
    );

    const resultItems = items.map((item) => {
      const stats = totalsMap.get(item.id);
      const spend = expenditureMap.get(item.id);
      const unitPrice = item.unitPrice ? Number(item.unitPrice) : null;
      return {
        itemId: item.id,
        name: item.name,
        category: item.category,
        unitPrice,
        totalInventoryValue: unitPrice != null ? unitPrice * item.totalQuantity : null,
        totalAmountSpent: spend?.totalAmountSpent ?? 0,
        totalRequestCount: spend?.totalRequestCount ?? 0,
        totalQuantity: item.totalQuantity,
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
      // Monthly and quarterly series are independent — run in parallel
      const [monthly, quarterly] = await Promise.all([
        prisma.$queryRaw<{ bucket: Date; qty: number }[]>`
          SELECT date_trunc('month', r."createdAt") as bucket,
            COALESCE(SUM(ri."quantityReq"), 0) as qty
          FROM "RequestItem" ri
          JOIN "Request" r ON r.id = ri."requestId"
          WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
          GROUP BY bucket
          ORDER BY bucket ASC;
        `,
        prisma.$queryRaw<{ bucket: Date; qty: number }[]>`
          SELECT date_trunc('quarter', r."createdAt") as bucket,
            COALESCE(SUM(ri."quantityReq"), 0) as qty
          FROM "RequestItem" ri
          JOIN "Request" r ON r.id = ri."requestId"
          WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" = ${itemId}
          GROUP BY bucket
          ORDER BY bucket ASC;
        `,
      ]);

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

    const sortedItems = [...resultItems].sort((a, b) => {
      let diff = 0;
      if (sortBy === "qty") diff = b.totalFulfilled - a.totalFulfilled;
      else if (sortBy === "requests") diff = b.totalRequestCount - a.totalRequestCount;
      else if (sortBy === "amount") diff = b.totalAmountSpent - a.totalAmountSpent;
      else diff = b.totalRequested - a.totalRequested;
      return order === "asc" ? -diff : diff;
    });

    return {
      items: sortBy ? sortedItems : resultItems,
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
