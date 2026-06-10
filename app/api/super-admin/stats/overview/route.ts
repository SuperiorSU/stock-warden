import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { SuperAdminOverviewSchema } from "@/lib/validation/stats";
import { cached } from "@/lib/cache/redis";

const granularityMap: Record<string, string> = {
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = SuperAdminOverviewSchema.safeParse({
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    granularity: url.searchParams.get("granularity") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const sessionYear =
    parsed.data.sessionYear ?? Number(process.env.SESSION_YEAR_CURRENT ?? "");
  if (!sessionYear || Number.isNaN(sessionYear)) {
    return apiError(new ValidationError("Invalid session year."));
  }

  const granularity = parsed.data.granularity ?? "monthly";

  const cacheKey = `super-admin:overview:${sessionYear}:${granularity}`;

  const data = await cached(cacheKey, 600, async () => {
    const totalRequests = await prisma.request.count({
      where: { sessionYear },
    });

    const approvedRequests = await prisma.request.count({
      where: { sessionYear, status: "APPROVED" },
    });

    const approvalRate = totalRequests === 0 ? 0 : approvedRequests / totalRequests;

    const processing = await prisma.$queryRaw<
      { avgHours: number }[]
    >`
      SELECT AVG(EXTRACT(EPOCH FROM (r."processedAt" - r."createdAt")) / 3600) as "avgHours"
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear} AND r."processedAt" IS NOT NULL;
    `;

    const series = await prisma.$queryRaw<
      { bucket: Date; total: number }[]
    >`
      SELECT date_trunc(${granularityMap[granularity]}, r."createdAt") as bucket,
        COUNT(*) as total
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const topItems = await prisma.$queryRaw<
      { name: string; qty: number }[]
    >`
      SELECT i.name as name, COALESCE(SUM(ri."quantityReq"), 0) as qty
      FROM "InventoryItem" i
      JOIN "RequestItem" ri ON ri."itemId" = i.id
      JOIN "Request" r ON r.id = ri."requestId"
      WHERE r."sessionYear" = ${sessionYear}
      GROUP BY i.name
      ORDER BY qty DESC
      LIMIT 5;
    `;

    const topDepartments = await prisma.$queryRaw<
      { department: string; total: number }[]
    >`
      SELECT u.department as department, COUNT(*) as total
      FROM "Request" r
      JOIN "User" u ON u.id = r."userId"
      WHERE r."sessionYear" = ${sessionYear}
      GROUP BY u.department
      ORDER BY total DESC
      LIMIT 5;
    `;

    return {
      totalRequests,
      approvalRate,
      avgProcessingTimeHours: Number(processing[0]?.avgHours ?? 0),
      series: series.map((row) => ({
        bucket: row.bucket.toISOString(),
        total: Number(row.total),
      })),
      topItems: topItems.map((row) => ({ name: row.name, qty: Number(row.qty) })),
      topDepartments: topDepartments.map((row) => ({
        name: row.department ?? "Unknown",
        total: Number(row.total),
      })),
    };
  });

  return apiSuccess(data);
}

export const dynamic = "force-dynamic";
