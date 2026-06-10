import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ApiError,
  ConflictCodeError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminRequestStatusSchema } from "@/lib/validation/admin";
import { dispatch, dispatchToInventoryManagers } from "@/lib/notifications/dispatcher";
import { NotFoundError } from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getRequestUser();
  if (!admin) {
    return apiError(new UnauthorizedError());
  }
  if (admin.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Only admins can approve requests.'));
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = AdminRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { item: true } },
      user: true,
    },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  if (request.status !== "REQUESTED") {
    return apiError(
      new ConflictCodeError("ALREADY_PROCESSED", "Request already processed.")
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id },
        data: {
          status: "PENDING",
          adminId: admin.id,
          adminNotes: parsed.data.adminNotes,
          allocatedByAdminAt: new Date(),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: request.status,
          toStatus: "PENDING",
          changedBy: admin.id,
          notes: parsed.data.adminNotes,
        },
      });
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiError(error);
    }
    throw error;
  }

  await dispatchToInventoryManagers({
    type: "REQUEST_PENDING",
    title: "Request awaiting inventory review",
    message: `Request ${request.id} was approved by admin and is waiting for inventory manager confirmation.`,
    requestId: id,
  });

  await dispatch({
    userId: request.userId,
    type: "REQUEST_PENDING",
    title: "Request approved by admin",
    message: "Your request has been approved by admin and is now awaiting inventory manager confirmation.",
    requestId: id,
  });

  return apiSuccess({
    id,
    status: "PENDING",
  });
}

export const dynamic = "force-dynamic";
