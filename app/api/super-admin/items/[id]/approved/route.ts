import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { serialise } from "@/lib/api/serialise";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return apiError(new ForbiddenError());

  const { id: itemId } = await params;
  const { searchParams } = new URL(req.url);

  const monthFrom = searchParams.get("monthFrom") || undefined;
  const monthTo   = searchParams.get("monthTo") || undefined;
  const yearRaw   = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );
  const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  if (isNaN(yearRaw)) return apiError(new ValidationError("Invalid sessionYear."));

  const dateFilters: Prisma.Sql[] = [
    Prisma.sql`er."isReversed" = false`,
    Prisma.sql`er."itemId" = ${itemId}`,
    Prisma.sql`er."sessionYear" = ${yearRaw}`,
  ];
  if (monthFrom) {
    dateFilters.push(Prisma.sql`er."approvedAt" >= ${startOfMonth(parseISO(`${monthFrom}-01`))}`);
  }
  if (monthTo) {
    dateFilters.push(Prisma.sql`er."approvedAt" <= ${endOfMonth(parseISO(`${monthTo}-01`))}`);
  }

  const where = Prisma.join(dateFilters, " AND ");

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<{
      id: string;
      unitPrice: number;
      quantityFulfilled: number;
      totalAmount: number;
      approvedAt: Date;
      inventoryProcessedAt: Date | null;
      userId: string;
      employeeName: string;
      employeeId: string | null;
      department: string | null;
      designation: string | null;
      adminName: string | null;
      imName: string | null;
    }[]>`
      SELECT
        er.id,
        er."unitPrice"::float          AS "unitPrice",
        er."quantityFulfilled",
        er."totalAmount"::float        AS "totalAmount",
        er."approvedAt",
        r."inventoryProcessedAt",
        u.id                            AS "userId",
        u.name                         AS "employeeName",
        u."employeeId",
        u.department,
        u.designation,
        u_admin.name                   AS "adminName",
        u_im.name                      AS "imName"
      FROM "ExpenditureRecord" er
      JOIN "Request" r     ON r.id   = er."requestId"
      JOIN "User"    u     ON u.id   = r."userId"
      LEFT JOIN "User" u_admin ON u_admin.id = er."approvedBy"
      LEFT JOIN "User" u_im    ON u_im.id    = r."inventoryManagerId"
      WHERE ${where}
      ORDER BY er."approvedAt" DESC, er.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ totalAmount: number; totalUnits: number; totalRecords: number }[]>`
      SELECT
        COALESCE(SUM(er."totalAmount"), 0)::float      as "totalAmount",
        COALESCE(SUM(er."quantityFulfilled"), 0)::int  as "totalUnits",
        COUNT(*)::int                                  as "totalRecords"
      FROM "ExpenditureRecord" er
      WHERE ${where}
    `,
  ]);

  const summary = totals[0] ?? { totalAmount: 0, totalUnits: 0, totalRecords: 0 };
  const hasMore = offset + rows.length < summary.totalRecords;

  return apiSuccess(
    serialise({
      records: rows.map((r) => ({
        id:                   r.id,
        unitPrice:            Number(r.unitPrice),
        quantityFulfilled:    Number(r.quantityFulfilled),
        totalAmount:          Number(r.totalAmount),
        approvedAt:           r.approvedAt.toISOString(),
        inventoryProcessedAt: r.inventoryProcessedAt?.toISOString() ?? null,
        userId:               r.userId,
        employeeName:         r.employeeName,
        employeeId:           r.employeeId,
        department:           r.department,
        designation:          r.designation,
        adminName:            r.adminName,
        imName:               r.imName,
      })),
      summary,
    }),
    { hasMore, nextOffset: offset + limit, total: summary.totalRecords }
  );
}

export const dynamic = "force-dynamic";
