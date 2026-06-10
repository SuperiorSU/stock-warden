import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ApiError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { NotificationFilterSchema } from "@/lib/validation/user";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = NotificationFilterSchema.safeParse({
    isRead: url.searchParams.get("isRead") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const { isRead, cursor, limit = 20 } = parsed.data;
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
    userId: user.id,
    ...(isRead ? { isRead: isRead === "true" } : {}),
  };

  const page = await paginateWithCursor(
    (args) =>
      prisma.notification.findMany({
        where,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: "desc" },
      }),
    () => prisma.notification.count({ where }),
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
