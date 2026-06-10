import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { assertRequestAccess } from "@/lib/api/assertions";
import { dispatchToAdmins } from "@/lib/notifications/dispatcher";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: { items: { include: { item: true } } },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  await assertRequestAccess(id, user.id, user.role);

  if (request.status !== "REJECTED") {
    return apiError(new ConflictError("Only rejected requests can be re-submitted."));
  }

  const insufficient = request.items.filter(
    (item) => item.item.availableQty < item.quantityReq
  );

  if (insufficient.length > 0) {
    return apiError(
      new ConflictError("Some items no longer have sufficient stock.", {
        items: insufficient.map((item) => ({
          name: item.item.name,
          available: item.item.availableQty,
        })),
      })
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.requestItem.updateMany({
      where: { requestId: id },
      data: { quantityAllocated: null },
    });

    const result = await tx.request.update({
      where: { id },
      data: { status: "REQUESTED", allocatedByAdminAt: null },
    });

    await tx.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: "REJECTED",
        toStatus: "REQUESTED",
        changedBy: user.id,
      },
    });

    return result;
  });

  await dispatchToAdmins({
    type: "REQUEST_CREATED",
    title: "Request re-submitted",
    message: `Request ${id} has been re-submitted by ${user.email ?? "user"}.`,
    requestId: id,
    sendEmail: true,
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
