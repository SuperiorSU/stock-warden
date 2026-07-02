import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError, ValidationError, NotFoundError } from "@/lib/errors";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

const EXPORT_CAP = 5000;

function applyHeaderStyle(ws: XLSX.WorkSheet, rowIndex: number, colCount: number) {
  for (let col = 0; col < colCount; col++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true } };
  }
}

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

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { name: true },
  });
  if (!item) return apiError(new NotFoundError("Item not found."));

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
    unitPrice: number;
    quantityFulfilled: number;
    totalAmount: number;
    approvedAt: Date;
    inventoryProcessedAt: Date | null;
    employeeName: string;
    department: string | null;
    adminName: string | null;
    imName: string | null;
  }[]>`
    SELECT
      er."unitPrice"::float          AS "unitPrice",
      er."quantityFulfilled",
      er."totalAmount"::float        AS "totalAmount",
      er."approvedAt",
      r."inventoryProcessedAt",
      u.name                         AS "employeeName",
      u.department,
      u_admin.name                   AS "adminName",
      u_im.name                      AS "imName"
    FROM "ExpenditureRecord" er
    JOIN "Request" r     ON r.id   = er."requestId"
    JOIN "User"    u     ON u.id   = r."userId"
    LEFT JOIN "User" u_admin ON u_admin.id = er."approvedBy"
    LEFT JOIN "User" u_im    ON u_im.id    = r."inventoryManagerId"
    WHERE ${where}
    ORDER BY er."approvedAt" DESC
    LIMIT ${EXPORT_CAP}
  `;

  const periodLabel = `${monthFrom ?? "Start"} to ${monthTo ?? "Present"} (Session Year ${yearRaw})`;
  const columns = ["Employee", "Department", "Units", "Unit Price", "Total", "Date Approved", "Date Allocated", "Approved By", "Allocated By (IM)"];

  const aoa: (string | number)[][] = [
    [`Item: ${item.name}`],
    [`Period: ${periodLabel}`],
    [],
    columns,
    ...rows.map((r) => [
      r.employeeName,
      r.department ?? "—",
      r.quantityFulfilled,
      Number(r.unitPrice),
      Number(r.totalAmount),
      format(new Date(r.approvedAt), "dd/MM/yyyy"),
      r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), "dd/MM/yyyy") : "—",
      r.adminName ?? "—",
      r.imName ?? "—",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
  ];
  applyHeaderStyle(ws, 0, columns.length);
  applyHeaderStyle(ws, 1, columns.length);
  applyHeaderStyle(ws, 3, columns.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Allocations");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeName = item.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = ["stockwarden", safeName, yearRaw, monthFrom ?? "all", monthTo ?? "months"].join("-");

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
