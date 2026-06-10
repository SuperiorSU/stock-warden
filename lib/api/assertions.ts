import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function assertRequestAccess(
  requestId: string,
  userId: string,
  role: string
) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new NotFoundError("Request not found.");
  }

  if (role === "USER" && request.userId !== userId) {
    throw new ForbiddenError("Access denied.");
  }

  return request;
}
