import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { SuperAdminOverviewSchema } from "@/lib/validation/stats";
import { cached } from "@/lib/cache/redis";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { getCurrentSessionYear } from "@/lib/utils/session-year";

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
  if (user.role !== "SUPER_ADMIN") {
    return apiError(new ForbiddenError("Only super admins can view this data."));
  }

  const url = new URL(req.url);
  const parsed = SuperAdminOverviewSchema.safeParse({
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    granularity: url.searchParams.get("granularity") ?? undefined,
    monthFrom: url.searchParams.get("monthFrom") ?? undefined,
    monthTo: url.searchParams.get("monthTo") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const sessionYear = parsed.data.sessionYear ?? getCurrentSessionYear();

  const granularity = parsed.data.granularity ?? "monthly";
  const { monthFrom, monthTo } = parsed.data;
  const dateFrom = monthFrom ? startOfMonth(parseISO(`${monthFrom}-01`)) : null;
  const dateTo = monthTo ? endOfMonth(parseISO(`${monthTo}-01`)) : null;

  const cacheKey = `super-admin:overview:${sessionYear}:${granularity}:${monthFrom ?? "all"}:${monthTo ?? "all"}`;

  const data = await cached(cacheKey, 600, async () => {
    const dateFilter = Prisma.sql`
      ${dateFrom ? Prisma.sql`AND r."createdAt" >= ${dateFrom}` : Prisma.empty}
      ${dateTo ? Prisma.sql`AND r."createdAt" <= ${dateTo}` : Prisma.empty}
    `;

    const createdAtRange =
      dateFrom || dateTo
        ? { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) }
        : undefined;

    const totalRequests = await prisma.request.count({
      where: { sessionYear, ...(createdAtRange && { createdAt: createdAtRange }) },
    });

    const approvedRequests = await prisma.request.count({
      where: { sessionYear, status: "APPROVED", ...(createdAtRange && { createdAt: createdAtRange }) },
    });

    const approvalRate = totalRequests === 0 ? 0 : approvedRequests / totalRequests;

    const processing = await prisma.$queryRaw<
      { avgHours: number }[]
    >`
      SELECT AVG(EXTRACT(EPOCH FROM (r."processedAt" - r."createdAt")) / 3600) as "avgHours"
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear} AND r."processedAt" IS NOT NULL ${dateFilter};
    `;

    const series = await prisma.$queryRaw<
      { bucket: Date; total: number }[]
    >`
      SELECT date_trunc(${granularityMap[granularity]}, r."createdAt") as bucket,
        COUNT(*) as total
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear} ${dateFilter}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const previousYearSeries = await prisma.$queryRaw<
      { bucket: Date; total: number }[]
    >`
      SELECT date_trunc(${granularityMap[granularity]}, r."createdAt") as bucket,
        COUNT(*) as total
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear - 1}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const adminPerformanceRaw = await prisma.$queryRaw<
      { adminId: string; processed: number; approved: number; avgHours: number | null }[]
    >`
      SELECT r."adminId" as "adminId",
        COUNT(*) as processed,
        COUNT(*) FILTER (WHERE r.status = 'APPROVED') as approved,
        AVG(EXTRACT(EPOCH FROM (r."processedAt" - r."createdAt")) / 3600) as "avgHours"
      FROM "Request" r
      WHERE r."sessionYear" = ${sessionYear} AND r."adminId" IS NOT NULL AND r."processedAt" IS NOT NULL ${dateFilter}
      GROUP BY r."adminId"
      ORDER BY processed DESC
      LIMIT 10;
    `;

    const adminIds = adminPerformanceRaw.map((row) => row.adminId);
    const admins = adminIds.length
      ? await prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true },
        })
      : [];
    const adminNameMap = Object.fromEntries(admins.map((a) => [a.id, a.name]));

    const adminPerformance = adminPerformanceRaw.map((row) => {
      const processed = Number(row.processed);
      const approved = Number(row.approved);
      return {
        name: adminNameMap[row.adminId] ?? "Unknown",
        processed,
        avgTime: `${Number(row.avgHours ?? 0).toFixed(1)}h`,
        approvalRate: `${processed > 0 ? Math.round((approved / processed) * 100) : 0}%`,
      };
    });

    const topItems = await prisma.$queryRaw<
      { name: string; qty: number }[]
    >`
      SELECT i.name as name, COALESCE(SUM(ri."quantityReq"), 0) as qty
      FROM "InventoryItem" i
      JOIN "RequestItem" ri ON ri."itemId" = i.id
      JOIN "Request" r ON r.id = ri."requestId"
      WHERE r."sessionYear" = ${sessionYear} ${dateFilter}
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
      WHERE r."sessionYear" = ${sessionYear} ${dateFilter}
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
      previousYearSeries: previousYearSeries.map((row) => ({
        bucket: row.bucket.toISOString(),
        total: Number(row.total),
      })),
      adminPerformance,
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
