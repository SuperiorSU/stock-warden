import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ConflictCodeError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminRequestStatusSchema } from "@/lib/validation/admin";
import { dispatch } from "@/lib/notifications/dispatcher";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getRequestUser();
  if (!admin) {
    return apiError(new UnauthorizedError());
  }
  if (admin.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Only admins can reject requests.'));
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = AdminRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const request = await prisma.request.findUnique({
    where: { id },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  if (request.status !== "REQUESTED") {
    return apiError(
      new ConflictCodeError("ALREADY_PROCESSED", "Request already processed.")
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.request.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminId: admin.id,
        adminNotes: parsed.data.adminNotes,
        processedAt: new Date(),
      },
    });

    await tx.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: request.status,
        toStatus: "REJECTED",
        changedBy: admin.id,
        notes: parsed.data.adminNotes,
      },
    });

    return result;
  });

  await dispatch({
    userId: request.userId,
    type: "REQUEST_REJECTED",
    title: "Request rejected",
    message: parsed.data.adminNotes ?? "Your request was rejected.",
    requestId: id,
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
