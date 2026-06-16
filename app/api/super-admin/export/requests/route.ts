import { prisma } from "@/lib/db/prisma";
import { getRequestUser } from "@/lib/api/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { apiError } from "@/lib/api/response";
import * as XLSX from "xlsx";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { Prisma } from "@prisma/client";

const EXPORT_CAP = 5000;

function formatDateExcel(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm");
}

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

function buildExportFilename(filters: Record<string, unknown>): string {
  const parts = [
    "stockwarden",
    "requests",
    filters.sessionYear ?? "all",
    (filters.monthFrom as string) ?? "all",
    (filters.monthTo as string) ?? "months",
  ];
  return parts.join("-");
}

async function getExpenditureForRequests(
  requestIds: string[]
): Promise<Record<string, number>> {
  if (requestIds.length === 0) return {};
  const records = await prisma.expenditureRecord.groupBy({
    by: ["requestId"],
    where: { requestId: { in: requestIds }, isReversed: false },
    _sum: { totalAmount: true },
  });
  return Object.fromEntries(
    records.map((r) => [r.requestId, Number(r._sum.totalAmount ?? 0)])
  );
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
  const employeeId = searchParams.get("employeeId") || undefined;
  const department = searchParams.get("department") || undefined;
  const status     = searchParams.get("status") || undefined;
  const itemId     = searchParams.get("itemId") || undefined;
  const monthFrom  = searchParams.get("monthFrom") || undefined;
  const monthTo    = searchParams.get("monthTo") || undefined;

  const filters = { sessionYear, monthFrom, monthTo };

  const where: Prisma.RequestWhereInput = {
    sessionYear,
    ...(employeeId && { userId: employeeId }),
    ...(department && { user: { department } }),
    ...(status && { status: status as Prisma.EnumRequestStatusFilter }),
    ...(itemId && { items: { some: { itemId } } }),
    ...((monthFrom || monthTo) && {
      createdAt: {
        ...(monthFrom && { gte: startOfMonth(parseISO(`${monthFrom}-01`)) }),
        ...(monthTo && { lte: endOfMonth(parseISO(`${monthTo}-01`)) }),
      },
    }),
  };

  const requests = await prisma.request.findMany({
    where,
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      processedAt: true,
      sessionYear: true,
      receiptNumber: true,
      adminId: true,
      inventoryManagerId: true,
      user: {
        select: {
          name: true,
          employeeId: true,
          department: true,
          designation: true,
        },
      },
      items: {
        select: {
          quantityReq: true,
          quantityAllocated: true,
          quantityFul: true,
          item: {
            select: { name: true, unit: true, unitPrice: true, category: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: EXPORT_CAP,
  });

  // Batch-load actor names
  const actorIds = [
    ...new Set([
      ...requests.map((r) => r.adminId).filter(Boolean),
      ...requests.map((r) => r.inventoryManagerId).filter(Boolean),
    ]),
  ] as string[];

  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];

  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a.name]));
  const expenditureMap = await getExpenditureForRequests(requests.map((r) => r.id));

  const enriched = requests.map((r) => ({
    ...r,
    adminName: r.adminId ? (actorMap[r.adminId] ?? null) : null,
    inventoryManagerName: r.inventoryManagerId
      ? (actorMap[r.inventoryManagerId] ?? null)
      : null,
    totalAmount: expenditureMap[r.id] ?? null,
    items: r.items.map((i) => ({
      ...i,
      unitPrice: i.item.unitPrice ? Number(i.item.unitPrice) : null,
      lineTotal:
        i.item.unitPrice && i.quantityFul != null
          ? Number(i.item.unitPrice) * i.quantityFul
          : null,
    })),
  }));

  const wb = XLSX.utils.book_new();

  // Sheet 1 — Request Summary
  const summarySheet = XLSX.utils.json_to_sheet(
    enriched.map((r) => ({
      "Receipt No":        r.receiptNumber ?? "—",
      "Employee Name":     r.user.name,
      "Employee ID":       r.user.employeeId ?? "—",
      "Department":        r.user.department ?? "—",
      "Designation":       r.user.designation ?? "—",
      "Request Date":      formatDateExcel(r.createdAt),
      "Month":             format(new Date(r.createdAt), "MMMM yyyy"),
      "Status":            r.status,
      "Total Items Req":   r.items.reduce((s, i) => s + i.quantityReq, 0),
      "Total Items Alloc": r.items.reduce((s, i) => s + (i.quantityFul ?? 0), 0),
      "Total Amount (₹)":  r.totalAmount ?? "—",
      "Approved By":       r.adminName ?? "—",
      "Allocated By (IM)": r.inventoryManagerName ?? "—",
      "Approved Date":     r.processedAt ? formatDateExcel(r.processedAt) : "—",
      "Session Year":      r.sessionYear,
    }))
  );
  applyHeaderStyle(summarySheet);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Requests");

  // Sheet 2 — Item-Level Detail
  const itemRows: object[] = [];
  for (const r of enriched) {
    for (const item of r.items) {
      itemRows.push({
        "Receipt No":        r.receiptNumber ?? "—",
        "Employee Name":     r.user.name,
        "Employee ID":       r.user.employeeId ?? "—",
        "Department":        r.user.department ?? "—",
        "Request Date":      formatDateExcel(r.createdAt),
        "Month":             format(new Date(r.createdAt), "MMMM yyyy"),
        "Item Name":         item.item.name,
        "Category":          item.item.category ?? "—",
        "Unit":              item.item.unit,
        "Qty Requested":     item.quantityReq,
        "Qty Allocated":     item.quantityAllocated ?? item.quantityReq,
        "Qty Fulfilled":     item.quantityFul ?? "—",
        "Unit Price (₹)":    item.unitPrice ?? "—",
        "Line Total (₹)":    item.lineTotal ?? "—",
        "Status":            r.status,
        "Approved By":       r.adminName ?? "—",
        "Allocated By (IM)": r.inventoryManagerName ?? "—",
        "Session Year":      r.sessionYear,
      });
    }
  }
  const itemSheet = XLSX.utils.json_to_sheet(itemRows);
  applyHeaderStyle(itemSheet);
  XLSX.utils.book_append_sheet(wb, itemSheet, "Item Details");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = buildExportFilename(filters);

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
