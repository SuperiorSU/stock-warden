import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { serialise } from "@/lib/api/serialise";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

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

  const requestItems = await prisma.requestItem.findMany({
    where: {
      itemId,
      request: {
        sessionYear: yearRaw,
        ...((monthFrom || monthTo) && {
          createdAt: {
            ...(monthFrom && { gte: startOfMonth(parseISO(`${monthFrom}-01`)) }),
            ...(monthTo && { lte: endOfMonth(parseISO(`${monthTo}-01`)) }),
          },
        }),
      },
    },
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
  const total = await prisma.requestItem.count({ where: { itemId } });

  return apiSuccess(serialise({ requestItems: page }), { total, hasMore, nextCursor });
}

export const dynamic = "force-dynamic";
