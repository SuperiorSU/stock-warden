import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { cached } from "@/lib/cache/redis";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { z } from "zod";

const QuerySchema = z.object({
  monthFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  monthTo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    monthFrom: url.searchParams.get("monthFrom") ?? undefined,
    monthTo: url.searchParams.get("monthTo") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }
  const { monthFrom, monthTo } = parsed.data;
  const dateFrom = monthFrom ? startOfMonth(parseISO(`${monthFrom}-01`)) : null;
  const dateTo = monthTo ? endOfMonth(parseISO(`${monthTo}-01`)) : null;

  const { id } = await params;
  const cacheKey = `super-admin:stats:items:${id}:${monthFrom ?? "all"}:${monthTo ?? "all"}`;

  let data: {
    itemId: string;
    name: string;
    unit: string;
    category: string | null;
    totalRequested: number;
    totalApproved: number;
    totalRejected: number;
    yearlyDemand: { year: number; totalRequested: number; totalApproved: number }[];
    departmentUsage: { department: string; qty: number }[];
  };

  try {
    data = await cached(cacheKey, 600, async () => {
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        select: { id: true, name: true, unit: true, category: true },
      });

      if (!item) {
        throw new NotFoundError("Item not found.");
      }

      const dateFilter = Prisma.sql`
        ${dateFrom ? Prisma.sql`AND r."createdAt" >= ${dateFrom}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND r."createdAt" <= ${dateTo}` : Prisma.empty}
      `;

      const totals = await prisma.$queryRaw<
        { totalRequested: number; totalApproved: number; totalRejected: number }[]
      >`
        SELECT
          COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
          COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalApproved",
          COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE ri."itemId" = ${id} ${dateFilter};
      `;

      const yearlyDemandRaw = await prisma.$queryRaw<
        { year: number; totalRequested: number; totalApproved: number }[]
      >`
        SELECT date_part('year', r."createdAt")::int as year,
          COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
          COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalApproved"
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE ri."itemId" = ${id}
        GROUP BY year
        ORDER BY year ASC;
      `;

      const departmentUsageRaw = await prisma.$queryRaw<
        { department: string | null; qty: number }[]
      >`
        SELECT u.department as department, COALESCE(SUM(ri."quantityReq"), 0) as qty
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        JOIN "User" u ON u.id = r."userId"
        WHERE ri."itemId" = ${id} ${dateFilter}
        GROUP BY u.department
        ORDER BY qty DESC
        LIMIT 8;
      `;

      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        totalRequested: Number(totals[0]?.totalRequested ?? 0),
        totalApproved: Number(totals[0]?.totalApproved ?? 0),
        totalRejected: Number(totals[0]?.totalRejected ?? 0),
        yearlyDemand: yearlyDemandRaw.map((row) => ({
          year: Number(row.year),
          totalRequested: Number(row.totalRequested),
          totalApproved: Number(row.totalApproved),
        })),
        departmentUsage: departmentUsageRaw.map((row) => ({
          department: row.department ?? "Unknown",
          qty: Number(row.qty),
        })),
      };
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return apiError(error);
    }
    throw error;
  }

  return apiSuccess(data);
}

export const dynamic = "force-dynamic";
