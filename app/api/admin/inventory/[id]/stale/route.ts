import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminInventoryStaleSchema } from "@/lib/validation/admin";
import { invalidatePattern } from "@/lib/cache/redis";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return apiError(new ForbiddenError('Only admins can mark items stale.'));
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = AdminInventoryStaleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return apiError(new NotFoundError("Item not found."));
  }

  if (parsed.data.action === "mark") {
    const openRequests = await prisma.requestItem.findFirst({
      where: {
        itemId: id,
        request: { status: { in: ["REQUESTED", "PENDING"] } },
      },
    });
    if (openRequests) {
      return apiError(new ConflictError("OPEN_REQUESTS_EXIST"));
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.inventoryItem.update({
      where: { id },
      data:
        parsed.data.action === "mark"
          ? { isStale: true, staleMarkedAt: new Date(), staleMarkedBy: user.id }
          : { isStale: false, staleMarkedAt: null, staleMarkedBy: null },
    });

    await tx.stockHistory.create({
      data: {
        itemId: id,
        changeType: parsed.data.action === "mark" ? "STALE_MARKED" : "STALE_REMOVED",
        quantityDelta: 0,
        quantityAfter: result.availableQty,
        changedBy: user.id,
        notes: parsed.data.action === "mark" ? "Marked stale" : "Unmarked stale",
      },
    });

    return result;
  });

  await invalidatePattern("admin:inventory:*");

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
