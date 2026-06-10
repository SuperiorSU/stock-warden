import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      category: true,
      unit: true,
      totalQuantity: true,
      availableQty: true,
      sessionYear: true,
      isActive: true,
      isStale: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!item) {
    return apiError(new NotFoundError("Item not found."));
  }

  if (user.role === "USER" && (!item.isActive || item.isStale)) {
    return apiError(new NotFoundError("Item not found."));
  }

  return apiSuccess(item);
}

export const dynamic = "force-dynamic";
