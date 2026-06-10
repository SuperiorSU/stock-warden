import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ApiError, ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { AdminStockAlertFilterSchema } from "@/lib/validation/admin";
import { parseIsoDate } from "@/lib/utils/date";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }
  if (user.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Access restricted.'));
  }

  const url = new URL(req.url);
  const parsed = AdminStockAlertFilterSchema.safeParse({
    isRead: url.searchParams.get("isRead") ?? undefined,
    itemId: url.searchParams.get("itemId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const { isRead, itemId, dateFrom, dateTo, cursor, limit = 20 } = parsed.data;
  let decodedCursor: { id: string; createdAt: Date } | null = null;
  if (cursor) {
    try {
      decodedCursor = decodeCursor(cursor);
    } catch (error) {
      if (error instanceof ApiError) {
        return apiError(error);
      }
      throw error;
    }
  }

  const where: Record<string, unknown> = {
    ...(isRead ? { isRead: isRead === "true" } : {}),
    ...(itemId ? { itemId } : {}),
  };

  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const page = await paginateWithCursor(
    (args) =>
      prisma.stockAlert.findMany({
        where,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          item: { select: { name: true } },
        },
      }),
    () => prisma.stockAlert.count({ where }),
    { cursor: decodedCursor?.id, limit }
  );

  const lastItem = page.items[page.items.length - 1] as
    | { id: string; createdAt: Date }
    | undefined;
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

  return apiSuccess(page.items, {
    limit,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor,
  });
}

export const dynamic = "force-dynamic";
