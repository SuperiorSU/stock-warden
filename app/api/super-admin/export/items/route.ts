import { prisma } from "@/lib/db/prisma";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { apiError } from "@/lib/api/response";
import * as XLSX from "xlsx";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { Prisma } from "@prisma/client";

const EXPORT_CAP = 5000;

function applyHeaderStyle(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true } };
  }
}

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) return apiError(new UnauthorizedError());
  if (user.role !== "SUPER_ADMIN") return apiError(new ForbiddenError());

  const { searchParams } = new URL(req.url);

  const sessionYear = parseInt(
    searchParams.get("sessionYear") ||
      String(process.env.SESSION_YEAR_CURRENT || new Date().getFullYear())
  );
  const monthFrom = searchParams.get("monthFrom") || undefined;
  const monthTo   = searchParams.get("monthTo") || undefined;
  const category  = searchParams.get("category") || undefined;
  const itemId    = searchParams.get("itemId") || undefined;

  const dateFrom = monthFrom ? startOfMonth(parseISO(`${monthFrom}-01`)) : null;
  const dateTo   = monthTo ? endOfMonth(parseISO(`${monthTo}-01`)) : null;

  const expenditureWhere: Prisma.ExpenditureRecordWhereInput = {
    sessionYear,
    isReversed: false,
    ...((monthFrom || monthTo) && {
      approvedAt: {
        ...(monthFrom && { gte: startOfMonth(parseISO(`${monthFrom}-01`)) }),
        ...(monthTo && { lte: endOfMonth(parseISO(`${monthTo}-01`)) }),
      },
    }),
    ...(category && { category }),
    ...(itemId && { itemId }),
  };

  // Sheet 1: Item summary — sourced from the full catalog (not just items with
  // expenditure) so the export matches the on-screen Items table 1:1.
  const catalogItems = await prisma.inventoryItem.findMany({
    where: {
      sessionYear,
      ...(itemId ? { id: itemId } : {}),
      ...(category ? { category } : {}),
    },
    select: { id: true, name: true, category: true, totalQuantity: true, availableQty: true, unitPrice: true },
    take: EXPORT_CAP,
  });
  const itemIds = catalogItems.map((i) => i.id);

  const [expenditureAggregates, requestTotalsRaw] = await Promise.all([
    itemIds.length > 0
      ? prisma.expenditureRecord.groupBy({
          by: ["itemId"],
          where: { ...expenditureWhere, itemId: { in: itemIds } },
          _sum:   { totalAmount: true, quantityFulfilled: true },
          _count: { requestId: true },
        })
      : Promise.resolve([]),
    itemIds.length > 0
      ? prisma.$queryRaw<{ itemId: string; totalRequested: number; totalFulfilled: number; totalRejected: number }[]>`
          SELECT
            ri."itemId" as "itemId",
            COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
            COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalFulfilled",
            COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
          FROM "RequestItem" ri
          JOIN "Request" r ON r.id = ri."requestId"
          WHERE r."sessionYear" = ${sessionYear} AND ri."itemId" IN (${Prisma.join(itemIds)})
            ${dateFrom ? Prisma.sql`AND r."createdAt" >= ${dateFrom}` : Prisma.empty}
            ${dateTo ? Prisma.sql`AND r."createdAt" <= ${dateTo}` : Prisma.empty}
          GROUP BY ri."itemId";
        `
      : Promise.resolve([]),
  ]);

  const expenditureMap = Object.fromEntries(expenditureAggregates.map((e) => [e.itemId, e]));
  const requestTotalsMap = Object.fromEntries(requestTotalsRaw.map((r) => [r.itemId, r]));

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(
    catalogItems.map((item) => {
      const spend = expenditureMap[item.id];
      const totals = requestTotalsMap[item.id];
      const totalStock = item.totalQuantity;
      const remaining = item.availableQty;
      const consumed = Math.max(0, totalStock - remaining);
      const stockUsagePct = totalStock > 0 ? Math.round((consumed / totalStock) * 100) : 0;
      return {
        "Item Name":          item.name,
        "Category":           item.category ?? "—",
        "Total Stock":        totalStock,
        "Total Requested":    Number(totals?.totalRequested ?? 0),
        "Total Fulfilled":    Number(totals?.totalFulfilled ?? 0),
        "Total Rejected":     Number(totals?.totalRejected ?? 0),
        "Remaining Stock":    remaining,
        "Stock Usage (%)":    stockUsagePct,
        "Unit Price (₹)":     item.unitPrice ? Number(item.unitPrice) : "—",
        "Total Spent (₹)":    Number(spend?._sum.totalAmount ?? 0),
        "Qty Fulfilled (Spend)": Number(spend?._sum.quantityFulfilled ?? 0),
        "Total Requests":     spend?._count.requestId ?? 0,
        "Inventory Value (₹)": item.unitPrice ? Number(item.unitPrice) * totalStock : "—",
      };
    })
  );
  applyHeaderStyle(summarySheet);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Item Summary");

  // Sheet 2: Employee breakdown per item
  const requestItems = await prisma.requestItem.findMany({
    where: {
      itemId: { in: itemIds },
      request: {
        sessionYear,
        ...((monthFrom || monthTo) && {
          createdAt: {
            ...(monthFrom && { gte: startOfMonth(parseISO(`${monthFrom}-01`)) }),
            ...(monthTo && { lte: endOfMonth(parseISO(`${monthTo}-01`)) }),
          },
        }),
      },
    },
    select: {
      quantityReq: true,
      quantityFul: true,
      item: { select: { name: true, category: true } },
      request: {
        select: {
          createdAt: true,
          sessionYear: true,
          status: true,
          user: {
            select: {
              name: true,
              employeeId: true,
              department: true,
              designation: true,
            },
          },
        },
      },
    },
    orderBy: { request: { createdAt: "desc" } },
    take: EXPORT_CAP,
  });

  const employeeSheet = XLSX.utils.json_to_sheet(
    requestItems.map((ri) => ({
      "Item Name":     ri.item.name,
      "Category":      ri.item.category ?? "—",
      "Employee Name": ri.request.user.name,
      "Employee ID":   ri.request.user.employeeId ?? "—",
      "Department":    ri.request.user.department ?? "—",
      "Designation":   ri.request.user.designation ?? "—",
      "Qty Requested": ri.quantityReq,
      "Qty Fulfilled": ri.quantityFul ?? "—",
      "Request Date":  format(new Date(ri.request.createdAt), "dd/MM/yyyy"),
      "Month":         format(new Date(ri.request.createdAt), "MMMM yyyy"),
      "Status":        ri.request.status,
      "Session Year":  ri.request.sessionYear,
    }))
  );
  applyHeaderStyle(employeeSheet);
  XLSX.utils.book_append_sheet(wb, employeeSheet, "Employee Breakdown");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const parts = ["stockwarden", "items", sessionYear, monthFrom ?? "all", monthTo ?? "months"];
  const filename = parts.join("-");

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
