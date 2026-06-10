import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { assertRequestAccess } from "@/lib/api/assertions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }
  if (user.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Access restricted.'));
  }

  const { id } = await params;
  await assertRequestAccess(id, user.id, user.role);

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { item: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  return apiSuccess(request);
}

export const dynamic = "force-dynamic";
