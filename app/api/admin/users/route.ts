import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ApiError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit") ?? undefined;
  const limit = limitParam ? Number(limitParam) : 20;

  if (Number.isNaN(limit) || limit < 1 || limit > 50) {
    return apiError(new ValidationError("Invalid limit."));
  }

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

  const whereClause: Record<string, unknown> = { role: "USER" };
  if (status === "pending") {
    whereClause.isApproved = false;
  } else if (status === "approved") {
    whereClause.isApproved = true;
  }

  const page = await paginateWithCursor(
    (args) =>
      prisma.user.findMany({
        where: whereClause,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          isApproved: true,
          isActive: true,
          createdAt: true,
        },
      }),
    () => prisma.user.count({ where: whereClause }),
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
