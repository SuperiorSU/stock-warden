import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { TooManyRequestsError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { StockAlertSchema } from "@/lib/validation/user";
import { dispatchToAdmins } from "@/lib/notifications/dispatcher";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const rateLimit = await enforceRateLimit(user.id, RATE_LIMITS.STOCK_ALERT);
  if (rateLimit) {
    return rateLimit;
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = StockAlertSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.availableQty !== 0) {
    return apiError(new ValidationError("Item must be out of stock."));
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.stockAlert.findFirst({
    where: {
      itemId: id,
      userId: user.id,
      createdAt: { gte: since },
    },
  });

  if (existing) {
    return apiError(new TooManyRequestsError("ALERT_ALREADY_SENT", "Alert already sent."));
  }

  const alert = await prisma.stockAlert.create({
    data: {
      itemId: id,
      userId: user.id,
      message: parsed.data.message,
    },
  });

  await dispatchToAdmins({
    type: "STOCK_ALERT",
    title: "Stock alert",
    message: `${user.email ?? "User"} requested stock replenishment for ${item.name}.`,
    requestId: undefined,
    sendEmail: true,
  });

  return apiSuccess(alert);
}

export const dynamic = "force-dynamic";
