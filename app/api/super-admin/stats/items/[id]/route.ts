import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { cached } from "@/lib/cache/redis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const cacheKey = `super-admin:stats:items:${id}`;

  let data: {
    itemId: string;
    name: string;
    totalRequested: number;
    totalApproved: number;
    totalRejected: number;
    series: { year: number; qty: number }[];
  };

  try {
    data = await cached(cacheKey, 600, async () => {
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!item) {
        throw new NotFoundError("Item not found.");
      }

      const totals = await prisma.$queryRaw<
        { totalRequested: number; totalApproved: number; totalRejected: number }[]
      >`
        SELECT
          COALESCE(SUM(ri."quantityReq"), 0) as "totalRequested",
          COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalApproved",
          COALESCE(SUM(CASE WHEN r.status = 'REJECTED' THEN ri."quantityReq" ELSE 0 END), 0) as "totalRejected"
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE ri."itemId" = ${id};
      `;

      const series = await prisma.$queryRaw<
        { bucket: Date; qty: number }[]
      >`
        SELECT date_trunc('year', r."createdAt") as bucket,
          COALESCE(SUM(ri."quantityReq"), 0) as qty
        FROM "RequestItem" ri
        JOIN "Request" r ON r.id = ri."requestId"
        WHERE ri."itemId" = ${id}
        GROUP BY bucket
        ORDER BY bucket ASC;
      `;

      return {
        itemId: item.id,
        name: item.name,
        totalRequested: Number(totals[0]?.totalRequested ?? 0),
        totalApproved: Number(totals[0]?.totalApproved ?? 0),
        totalRejected: Number(totals[0]?.totalRejected ?? 0),
        series: series.map((row) => ({
          year: row.bucket.getUTCFullYear(),
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
