import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { serialise } from "@/lib/api/serialise";
import { monthRangeUtc } from "@/lib/utils/month-range";
import { Prisma } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (user.role !== "SUPER_ADMIN") return apiError(new ForbiddenError());

  const { id: itemId } = await params;
  const { searchParams } = new URL(req.url);

  const monthFrom = searchParams.get("monthFrom") || undefined;
  const monthTo   = searchParams.get("monthTo") || undefined;
  const cursor    = searchParams.get("cursor") || undefined;
  const limitRaw  = parseInt(searchParams.get("limit") || "20");
  const limit     = Math.min(Math.max(limitRaw, 1), 50);
  const yearRaw   = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );

  if (isNaN(yearRaw)) return apiError(new ValidationError("Invalid sessionYear."));

  // An explicit month range replaces the session-year scope: sessions span two
  // calendar years, so ANDing both would hide data the user asked for by date.
  const range = monthRangeUtc(monthFrom, monthTo);
  const where: Prisma.RequestItemWhereInput = {
    itemId,
    request: range ? { createdAt: range } : { sessionYear: yearRaw },
  };

  const requestItems = await prisma.requestItem.findMany({
    where,
    select: {
      id: true,
      quantityReq: true,
      quantityAllocated: true,
      quantityFul: true,
      request: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          processedAt: true,
          receiptNumber: true,
          adminId: true,
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: true,
              designation: true,
            },
          },
        },
      },
    },
    orderBy: { request: { createdAt: "desc" } },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = requestItems.length > limit;
  const page = hasMore ? requestItems.slice(0, -1) : requestItems;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  const total = await prisma.requestItem.count({ where });

  return apiSuccess(serialise({ requestItems: page }), { total, hasMore, nextCursor });
}

export const dynamic = "force-dynamic";
