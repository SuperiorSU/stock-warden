import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { AdminStatsRequestsSchema } from "@/lib/validation/stats";
import { parseIsoDate } from "@/lib/utils/date";
import { cached } from "@/lib/cache/redis";

const granularityMap: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }
  if (user.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Access restricted.'));
  }

  const url = new URL(req.url);
  const parsed = AdminStatsRequestsSchema.safeParse({
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    granularity: url.searchParams.get("granularity") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
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
  const dateFrom = parseIsoDate(parsed.data.dateFrom);
  const dateTo = parseIsoDate(parsed.data.dateTo);

  const cacheKey = `admin:stats:requests:${sessionYear}:${granularity}:${dateFrom?.toISOString() ?? ""}:${dateTo?.toISOString() ?? ""}`;

  const data = await cached(cacheKey, 300, async () => {
    const filters = [Prisma.sql`r."sessionYear" = ${sessionYear}`];
    if (dateFrom) {
      filters.push(Prisma.sql`r."createdAt" >= ${dateFrom}`);
    }
    if (dateTo) {
      filters.push(Prisma.sql`r."createdAt" <= ${dateTo}`);
    }

    const results = await prisma.$queryRaw<
      { bucket: Date; total: number }[]
    >`
      SELECT date_trunc(${Prisma.raw(`'${granularityMap[granularity]}'`)}, r."createdAt") as bucket,
        COUNT(*) as total
      FROM "Request" r
      WHERE ${Prisma.join(filters, ' AND ')}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    return {
      series: results.map((row) => ({
        bucket: row.bucket.toISOString(),
        total: Number(row.total),
      })),
    };
  });

  return apiSuccess(data);
}

export const dynamic = "force-dynamic";
