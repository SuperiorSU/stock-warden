import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { cachedGet, cachedSet } from "@/lib/cache/redis";
import { CacheKeys } from "@/lib/cache/keys";
import { serialise } from "@/lib/api/serialise";
import { Prisma } from "@prisma/client";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

interface CachedAnalytics {
  data: object;
  meta: Record<string, unknown>;
}

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (user.role !== "SUPER_ADMIN") return apiError(new ForbiddenError());

  const { searchParams } = new URL(req.url);

  const monthFrom = searchParams.get("monthFrom") || "";
  const monthTo   = searchParams.get("monthTo") || "";
  const category  = searchParams.get("category") || undefined;
  const itemId    = searchParams.get("itemId") || undefined;
  const sortBy    = searchParams.get("sortBy") || "amount";
  const order     = (searchParams.get("order") || "desc") as "asc" | "desc";
  const yearRaw   = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );

  if (isNaN(yearRaw)) return apiError(new ValidationError("Invalid sessionYear."));

  const cacheKey = CacheKeys.saItemAnalytics(yearRaw, monthFrom, monthTo);
  const hit = await cachedGet<CachedAnalytics>(cacheKey);
  if (hit && !category && !itemId) return apiSuccess(hit.data, hit.meta);

  const expenditureWhere: Prisma.ExpenditureRecordWhereInput = {
    sessionYear: yearRaw,
    isReversed: false,
    ...((monthFrom || monthTo) && {
      approvedAt: {
        ...(monthFrom && { gte: startOfMonth(parseISO(`${monthFrom}-01`)) }),
        ...(monthTo && { lte: endOfMonth(parseISO(`${monthTo}-01`)) }),
      },
    }),
    ...(category && { category }),
    ...(itemId && { itemId }),
  };

  const rawAggregates = await prisma.expenditureRecord.groupBy({
    by: ["itemId", "itemName", "category"],
    where: expenditureWhere,
    _sum:   { totalAmount: true, quantityFulfilled: true },
    _count: { requestId: true },
  });

  // Sort in application layer — avoids Prisma groupBy orderBy field-in-by constraint
  const itemAggregates = [...rawAggregates].sort((a, b) => {
    let diff = 0;
    if (sortBy === "qty") {
      diff = Number(b._sum.quantityFulfilled ?? 0) - Number(a._sum.quantityFulfilled ?? 0);
    } else if (sortBy === "requests") {
      diff = b._count.requestId - a._count.requestId;
    } else {
      diff = Number(b._sum.totalAmount ?? 0) - Number(a._sum.totalAmount ?? 0);
    }
    return order === "asc" ? -diff : diff;
  });

  const itemIds = itemAggregates.map((i) => i.itemId);

  const stockSnapshot =
    itemIds.length > 0
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            totalQuantity: true,
            availableQty: true,
            unitPrice: true,
            unit: true,
          },
        })
      : [];

  const stockMap = Object.fromEntries(stockSnapshot.map((s) => [s.id, s]));

  const enriched = itemAggregates.map((item) => {
    const stock = stockMap[item.itemId];
    const totalInventoryValue = stock?.unitPrice
      ? Number(stock.unitPrice) * stock.totalQuantity
      : null;

    return {
      itemId:              item.itemId,
      itemName:            item.itemName,
      category:            item.category,
      totalAmountSpent:    Number(item._sum.totalAmount ?? 0),
      totalQtyFulfilled:   Number(item._sum.quantityFulfilled ?? 0),
      totalRequestCount:   item._count.requestId,
      currentStock:        stock?.availableQty ?? null,
      totalStock:          stock?.totalQuantity ?? null,
      unitPrice:           stock?.unitPrice ? Number(stock.unitPrice) : null,
      totalInventoryValue,
    };
  });

  const totalCatalogValue = enriched.reduce(
    (s, i) => s + (i.totalInventoryValue ?? 0),
    0
  );
  const totalSpent        = enriched.reduce((s, i) => s + i.totalAmountSpent, 0);
  const totalQtyFulfilled = enriched.reduce((s, i) => s + i.totalQtyFulfilled, 0);

  const catMap: Record<string, number> = {};
  for (const i of enriched) {
    const cat = i.category ?? "Uncategorised";
    catMap[cat] = (catMap[cat] ?? 0) + i.totalAmountSpent;
  }
  const topCategory =
    Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const summary = { totalCatalogValue, totalSpent, totalQtyFulfilled, topCategory };
  const meta: Record<string, unknown> = { total: enriched.length, hasMore: false, nextCursor: null };

  const responseData = serialise({ items: enriched, summary });

  if (!category && !itemId) {
    await cachedSet(cacheKey, { data: responseData, meta }, 300);
  }

  return apiSuccess(responseData, meta);
}

export const dynamic = "force-dynamic";
