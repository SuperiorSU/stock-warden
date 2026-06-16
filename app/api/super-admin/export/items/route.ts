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
  };

  // Sheet 1: Item summary
  const itemAggregates = await prisma.expenditureRecord.groupBy({
    by: ["itemId", "itemName", "category"],
    where: expenditureWhere,
    _sum:   { totalAmount: true, quantityFulfilled: true },
    _count: { requestId: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: EXPORT_CAP,
  });

  const itemIds = itemAggregates.map((i) => i.itemId);
  const stockSnapshot =
    itemIds.length > 0
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, totalQuantity: true, availableQty: true, unitPrice: true },
        })
      : [];
  const stockMap = Object.fromEntries(stockSnapshot.map((s) => [s.id, s]));

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(
    itemAggregates.map((item) => {
      const stock = stockMap[item.itemId];
      return {
        "Item Name":          item.itemName,
        "Category":           item.category ?? "—",
        "Total Spent (₹)":    Number(item._sum.totalAmount ?? 0),
        "Qty Fulfilled":      Number(item._sum.quantityFulfilled ?? 0),
        "Total Requests":     item._count.requestId,
        "Stock Available":    stock?.availableQty ?? "—",
        "Total Stock":        stock?.totalQuantity ?? "—",
        "Unit Price (₹)":     stock?.unitPrice ? Number(stock.unitPrice) : "—",
        "Inventory Value (₹)": stock?.unitPrice
          ? Number(stock.unitPrice) * (stock?.totalQuantity ?? 0)
          : "—",
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
