import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ApiError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitParam = url.searchParams.get("limit") ?? undefined;
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

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    take: Math.min(limit, 50),
    ...(decodedCursor ? { cursor: { id: decodedCursor.id }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  const stats = await prisma.$queryRaw<
    { adminId: string; processed: number; avgHours: number }[]
  >`
    SELECT r."adminId" as "adminId",
      COUNT(*) as processed,
      AVG(EXTRACT(EPOCH FROM (r."processedAt" - r."createdAt")) / 3600) as "avgHours"
    FROM "Request" r
    WHERE r."adminId" IS NOT NULL
    GROUP BY r."adminId";
  `;

  const statsMap = new Map(stats.map((row) => [row.adminId, row]));
  const response = admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    processedRequests: Number(statsMap.get(admin.id)?.processed ?? 0),
    avgProcessingTimeHours: Number(statsMap.get(admin.id)?.avgHours ?? 0),
  }));

  const lastItem = admins[admins.length - 1];
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

  return apiSuccess(response, { limit, nextCursor });
}

export const dynamic = "force-dynamic";
