import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
import { assertRequestAccess } from "@/lib/api/assertions";
import { dispatch } from "@/lib/notifications/dispatcher";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const request = await assertRequestAccess(id, user.id, user.role);

  if (request.status !== "REQUESTED") {
    return apiError(new ConflictError("Cannot cancel this request."));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.request.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await tx.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: request.status,
        toStatus: "CANCELLED",
        changedBy: user.id,
      },
    });

    return result;
  });

  await dispatch({
    userId: user.id,
    type: "REQUEST_CANCELLED",
    title: "Request cancelled",
    message: "Your request has been cancelled.",
    requestId: id,
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
