import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { cachedGet, cachedSet } from "@/lib/cache/redis";
import { CacheKeys } from "@/lib/cache/keys";
import { serialise } from "@/lib/api/serialise";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { monthRangeUtc } from "@/lib/utils/month-range";

function buildOrderBy(
  sortBy: string,
  order: "asc" | "desc"
): Prisma.RequestOrderByWithRelationInput {
  if (sortBy === "items") return { items: { _count: order } };
  return { createdAt: order };
}

async function getExpenditureForRequests(
  requestIds: string[]
): Promise<Record<string, number>> {
  if (requestIds.length === 0) return {};
  const records = await prisma.expenditureRecord.groupBy({
    by: ["requestId"],
    where: { requestId: { in: requestIds }, isReversed: false },
    _sum: { totalAmount: true },
  });
  return Object.fromEntries(
    records.map((r) => [r.requestId, Number(r._sum.totalAmount ?? 0)])
  );
}

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return apiError(new ForbiddenError());

  const { searchParams } = new URL(req.url);

  const employeeId  = searchParams.get("employeeId") || undefined;
  const department  = searchParams.get("department") || undefined;
  const status      = searchParams.get("status") || undefined;
  const itemId      = searchParams.get("itemId") || undefined;
  const monthFrom   = searchParams.get("monthFrom") || undefined;
  const monthTo     = searchParams.get("monthTo") || undefined;
  const sortBy      = searchParams.get("sortBy") || "date";
  const order       = (searchParams.get("order") || "desc") as "asc" | "desc";
  const cursor      = searchParams.get("cursor") || undefined;
  const limitRaw    = parseInt(searchParams.get("limit") || "20");
  const limit       = Math.min(Math.max(limitRaw, 1), 50);
  const yearRaw     = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );

  if (isNaN(yearRaw)) return apiError(new ValidationError("Invalid sessionYear."));

  // Full digest of every parameter that changes the response — a truncated
  // encoding of the raw JSON collides across filter values and would serve
  // one filter's cached result for another.
  const filterHash = createHash("sha256")
    .update(
      JSON.stringify({ employeeId, department, status, itemId, monthFrom, monthTo, sortBy, order, limit })
    )
    .digest("hex")
    .slice(0, 16);

  const cacheKey = CacheKeys.saEmpRequests(yearRaw, filterHash);

  interface CachedEmpRequests {
    data: object;
    meta: Record<string, unknown>;
  }
  // Only cache the first page (no cursor)
  if (!cursor) {
    const hit = await cachedGet<CachedEmpRequests>(cacheKey);
    if (hit) return apiSuccess(hit.data, hit.meta);
  }

  // An explicit month range is authoritative: session years span two calendar
  // years (e.g. session 2026 runs Dec 2025 – Jul 2026), so ANDing the range
  // with a session year would hide data the user asked for by date.
  const createdAtRange = monthRangeUtc(monthFrom, monthTo);

  const where: Prisma.RequestWhereInput = {
    ...(createdAtRange ? { createdAt: createdAtRange } : { sessionYear: yearRaw }),
    ...(employeeId && { userId: employeeId }),
    ...(department && { user: { department } }),
    ...(status && { status: status as Prisma.EnumRequestStatusFilter }),
    ...(itemId && { items: { some: { itemId } } }),
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      select: {
        id: true,
        status: true,
        notes: true,
        adminNotes: true,
        createdAt: true,
        processedAt: true,
        sessionYear: true,
        allocatedByAdminAt: true,
        inventoryProcessedAt: true,
        receiptNumber: true,
        adminId: true,
        inventoryManagerId: true,
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
        items: {
          select: {
            id: true,
            quantityReq: true,
            quantityAllocated: true,
            quantityFul: true,
            item: {
              select: {
                id: true,
                name: true,
                unit: true,
                unitPrice: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: buildOrderBy(sortBy, order),
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    }),
    prisma.request.count({ where }),
  ]);

  const hasMore = requests.length > limit;
  const page = hasMore ? requests.slice(0, -1) : requests;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Batch-load actor names
  const actorIds = [
    ...new Set([
      ...page.map((r) => r.adminId).filter(Boolean),
      ...page.map((r) => r.inventoryManagerId).filter(Boolean),
    ]),
  ] as string[];

  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

  // Batch expenditure
  const expenditureMap = await getExpenditureForRequests(page.map((r) => r.id));

  const enriched = page.map((r) => ({
    ...r,
    adminName: r.adminId ? (actorMap[r.adminId]?.name ?? null) : null,
    inventoryManagerName: r.inventoryManagerId
      ? (actorMap[r.inventoryManagerId]?.name ?? null)
      : null,
    totalAmount: expenditureMap[r.id] ?? null,
    items: r.items.map((i) => ({
      ...i,
      unitPrice: i.item.unitPrice ? Number(i.item.unitPrice) : null,
      lineTotal:
        i.item.unitPrice && i.quantityFul != null
          ? Number(i.item.unitPrice) * i.quantityFul
          : null,
    })),
  }));

  // Summary aggregates
  const summary = {
    totalRequests: total,
    totalAmount: enriched.reduce((s, r) => s + (r.totalAmount ?? 0), 0),
    totalItemsRequested: enriched.reduce(
      (s, r) => s + r.items.reduce((si, i) => si + i.quantityReq, 0),
      0
    ),
    totalItemsFulfilled: enriched.reduce(
      (s, r) => s + r.items.reduce((si, i) => si + (i.quantityFul ?? 0), 0),
      0
    ),
  };

  const responseData = serialise({ requests: enriched, summary });
  const meta = { total, hasMore, nextCursor };

  if (!cursor) {
    await cachedSet(cacheKey, { data: responseData, meta }, 180); // 3 min TTL
  }

  return apiSuccess(responseData, meta);
}

export const dynamic = "force-dynamic";
