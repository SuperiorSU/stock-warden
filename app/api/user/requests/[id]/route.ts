import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { assertRequestAccess } from "@/lib/api/assertions";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  await assertRequestAccess(id, user.id, user.role);

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { item: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  const requestUrl = new URL(req.url);
  const invoiceUrl = request.status === "APPROVED" && request.invoiceNumber
    ? new URL(`/api/user/requests/${id}/invoice-download`, requestUrl).toString()
    : null;

  const receiptUrl = request.status === "APPROVED" && request.receiptNumber
    ? new URL(`/api/user/requests/${id}/receipt-download`, requestUrl).toString()
    : null;

  return apiSuccess({
    ...request,
    invoiceUrl,
    receiptUrl,
  });
}

export const dynamic = "force-dynamic";
