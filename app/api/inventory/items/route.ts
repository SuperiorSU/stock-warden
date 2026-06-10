import { prisma } from "@/lib/db/prisma";
import { InventoryFilterSchema } from "@/lib/validation/inventory";
import { apiError } from "@/lib/api/response";
import { ApiError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getRequestUser } from "@/lib/api/session";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";
import { apiSuccess } from "@/lib/api/response";

export async function GET(req: Request) {
  const user = await getRequestUser();

  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = InventoryFilterSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    availability: url.searchParams.get("availability") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const {
    q,
    category,
    sessionYear,
    availability,
    cursor,
    limit = 20,
  } = parsed.data;

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

  const defaultSessionYear = Number(process.env.SESSION_YEAR_CURRENT ?? "");
  const resolvedSessionYear = sessionYear ?? (Number.isNaN(defaultSessionYear) ? undefined : defaultSessionYear);

  const isPrivileged = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const where: Record<string, unknown> = {
    ...(q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : {}),
    ...(category ? { category } : {}),
    ...(resolvedSessionYear ? { sessionYear: resolvedSessionYear } : {}),
    ...(availability === "in_stock" ? { availableQty: { gt: 0 } } : {}),
    ...(availability === "out_of_stock" ? { availableQty: 0 } : {}),
    ...(isPrivileged ? {} : { isActive: true, isStale: false, isHiddenFromUsers: false }),
  };

  const selectPublic = {
    id: true,
    name: true,
    slug: true,
    description: true,
    imageUrl: true,
    category: true,
    unit: true,
    totalQuantity: true,
    availableQty: true,
    sessionYear: true,
    isActive: true,
    isStale: true,
    createdAt: true,
  } as const;

  const selectAdmin = {
    ...selectPublic,
    staleMarkedAt: true,
    staleMarkedBy: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  const page = await paginateWithCursor(
    (args) =>
      prisma.inventoryItem.findMany({
        where,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: "desc" },
        select: isPrivileged ? selectAdmin : selectPublic,
      }),
    () => prisma.inventoryItem.count({ where }),
    { cursor: decodedCursor?.id, limit }
  );

  const lastItem = page.items[page.items.length - 1] as
    | { id: string; createdAt: Date }
    | undefined;
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

  const items = page.items.map((item) => {
    const { createdAt, ...rest } = item as { createdAt: Date } & typeof item;
    return rest;
  });

  return apiSuccess(items, {
    limit,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor,
  });
}

export const dynamic = "force-dynamic";
