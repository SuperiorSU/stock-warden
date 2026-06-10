import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
  });

  if (!notification) {
    return apiError(new NotFoundError("Notification not found."));
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
