import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { serialise } from "@/lib/api/serialise";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Prisma } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (user.role !== "SUPER_ADMIN") return apiError(new ForbiddenError());

  const { id: itemId } = await params;
  const { searchParams } = new URL(req.url);

  const monthFrom = searchParams.get("monthFrom") || undefined;
  const monthTo   = searchParams.get("monthTo") || undefined;
  const yearRaw   = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );

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

  const rows = await prisma.$queryRaw<{
    id: string;
    unitPrice: number;
    quantityFulfilled: number;
    totalAmount: number;
    approvedAt: Date;
    inventoryProcessedAt: Date | null;
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
    ORDER BY er."approvedAt" DESC
  `;

  const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalUnits  = rows.reduce((s, r) => s + Number(r.quantityFulfilled), 0);

  return apiSuccess(
    serialise({
      records: rows.map((r) => ({
        id:                   r.id,
        unitPrice:            Number(r.unitPrice),
        quantityFulfilled:    Number(r.quantityFulfilled),
        totalAmount:          Number(r.totalAmount),
        approvedAt:           r.approvedAt.toISOString(),
        inventoryProcessedAt: r.inventoryProcessedAt?.toISOString() ?? null,
        employeeName:         r.employeeName,
        employeeId:           r.employeeId,
        department:           r.department,
        designation:          r.designation,
        adminName:            r.adminName,
        imName:               r.imName,
      })),
      summary: { totalAmount, totalUnits, totalRecords: rows.length },
    })
  );
}

export const dynamic = "force-dynamic";
