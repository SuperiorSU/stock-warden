import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { dispatch } from "@/lib/notifications/dispatcher";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getRequestUser();
  if (!admin) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const alert = await prisma.stockAlert.findUnique({
    where: { id },
    include: { item: true },
  });

  if (!alert) {
    return apiError(new NotFoundError("Stock alert not found."));
  }

  const updated = await prisma.stockAlert.update({
    where: { id },
    data: { resolvedAt: new Date(), isRead: true },
  });

  const relatedAlerts = await prisma.stockAlert.findMany({
    where: { itemId: alert.itemId },
  });

  await Promise.all(
    relatedAlerts.map((entry) =>
      dispatch({
        userId: entry.userId,
        type: "STOCK_REPLENISHED",
        title: "Stock replenished",
        message: `${alert.item.name} is back in stock.`,
      })
    )
  );

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
