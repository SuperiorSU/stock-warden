import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { serialise } from "@/lib/api/serialise";
import { monthRangeUtc } from "@/lib/utils/month-range";
import { Prisma } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return apiError(new ForbiddenError());

  const { userId } = await params;
  const { searchParams } = new URL(req.url);

  const monthFrom = searchParams.get("monthFrom") || undefined;
  const monthTo   = searchParams.get("monthTo") || undefined;
  const yearRaw   = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );

  if (isNaN(yearRaw)) return apiError(new ValidationError("Invalid sessionYear."));

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, employeeId: true, department: true, designation: true, email: true },
  });
  if (!employee) return apiError(new NotFoundError("Employee not found."));

  // ExpenditureRecord has no Prisma relation — use raw SQL for clean join.
  // An explicit month range replaces the session-year scope: sessions span two
  // calendar years, so ANDing both would hide data the user asked for by date.
  const range = monthRangeUtc(monthFrom, monthTo);
  const dateFilters: Prisma.Sql[] = [
    Prisma.sql`er."isReversed" = false`,
    Prisma.sql`r."userId" = ${userId}`,
  ];
  if (range) {
    if (range.gte) dateFilters.push(Prisma.sql`er."approvedAt" >= ${range.gte}`);
    if (range.lte) dateFilters.push(Prisma.sql`er."approvedAt" <= ${range.lte}`);
  } else {
    dateFilters.push(Prisma.sql`er."sessionYear" = ${yearRaw}`);
  }

  const where = Prisma.join(dateFilters, " AND ");

  const rows = await prisma.$queryRaw<{
    id: string;
    itemName: string;
    category: string | null;
    unitPrice: number;
    quantityFulfilled: number;
    totalAmount: number;
    approvedAt: Date;
    inventoryProcessedAt: Date | null;
    adminName: string | null;
    imName: string | null;
  }[]>`
    SELECT
      er.id,
      er."itemName",
      er."category",
      er."unitPrice"::float          AS "unitPrice",
      er."quantityFulfilled",
      er."totalAmount"::float        AS "totalAmount",
      er."approvedAt",
      r."inventoryProcessedAt",
      u_admin.name                   AS "adminName",
      u_im.name                      AS "imName"
    FROM "ExpenditureRecord" er
    JOIN "Request" r ON r.id = er."requestId"
    LEFT JOIN "User" u_admin ON u_admin.id = er."approvedBy"
    LEFT JOIN "User" u_im   ON u_im.id   = r."inventoryManagerId"
    WHERE ${where}
    ORDER BY er."approvedAt" DESC
  `;

  const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalUnits  = rows.reduce((s, r) => s + Number(r.quantityFulfilled), 0);

  return apiSuccess(
    serialise({
      employee,
      records: rows.map((r) => ({
        id:                   r.id,
        itemName:             r.itemName,
        category:             r.category,
        unitPrice:            Number(r.unitPrice),
        quantityFulfilled:    Number(r.quantityFulfilled),
        totalAmount:          Number(r.totalAmount),
        approvedAt:           r.approvedAt.toISOString(),
        inventoryProcessedAt: r.inventoryProcessedAt?.toISOString() ?? null,
        adminName:            r.adminName,
        imName:               r.imName,
      })),
      summary: { totalAmount, totalUnits, totalRecords: rows.length },
    })
  );
}

export const dynamic = "force-dynamic";
