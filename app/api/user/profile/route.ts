import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { UnauthorizedError, ValidationError } from "@/lib/errors";

export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      employeeId: true,
      department: true,
      designation: true,
      phoneNumber: true,
      avatarUrl: true,
    },
  });

  const stats = await prisma.request.groupBy({
    by: ["status"],
    where: { userId: user.id },
    _count: { _all: true },
  });

  const totals = stats.reduce((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {} as Record<string, number>);

  return apiSuccess({
    user: profile,
    stats: {
      totalRequests: stats.reduce((sum, row) => sum + row._count._all, 0),
      approvedRequests: totals.APPROVED ?? 0,
      pendingRequests: totals.PENDING ?? 0,
      rejectedRequests: totals.REJECTED ?? 0,
      mostRequestedItem: null,
    },
  });
}

export async function PUT(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const body = await req.json();
  const parsed = {
    name: body?.name,
    phoneNumber: body?.phoneNumber,
    avatarUrl: body?.avatarUrl,
  };

  if (!parsed.name && !parsed.phoneNumber && !parsed.avatarUrl) {
    return apiError(new ValidationError("No updates provided."));
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.phoneNumber ? { phoneNumber: parsed.phoneNumber } : {}),
      ...(parsed.avatarUrl ? { avatarUrl: parsed.avatarUrl } : {}),
    },
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
