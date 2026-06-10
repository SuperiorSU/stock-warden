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

  const page = await prisma.user.findMany({
    take: Math.min(limit, 50),
    ...(decodedCursor ? { cursor: { id: decodedCursor.id }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      isApproved: true,
      createdAt: true,
      _count: { select: { requests: true } },
    },
  });

  const lastItem = page[page.length - 1];
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

  return apiSuccess(
    page.map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      department: entry.department,
      isActive: entry.isActive,
      isApproved: entry.isApproved,
      requestCount: entry._count.requests,
      createdAt: entry.createdAt,
    })),
    {
      limit,
      nextCursor,
    }
  );
}

export const dynamic = "force-dynamic";
