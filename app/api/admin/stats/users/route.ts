import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { getRequestUser } from '@/lib/api/session'
import { apiError, apiSuccess } from '@/lib/api/response'
import { UnauthorizedError, ValidationError } from '@/lib/errors'
import { cached } from '@/lib/cache/redis'
import { z } from 'zod'

const QuerySchema = z.object({
  sessionYear: z.preprocess((v) => Number(v), z.number().int()),
  granularity: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  department: z.string().optional(),
})

export async function GET(req: Request) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return apiError(new UnauthorizedError())

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return apiError(new ValidationError('Invalid query.', parsed.error.flatten()))

  const { sessionYear, granularity, department } = parsed.data
  const cacheKey = `admin:stats:users:${sessionYear}:${granularity}:${department ?? 'all'}`

  const data = await cached(cacheKey, 300, async () => {
    const departmentFilter = department
      ? Prisma.sql`AND u.department = ${department}`
      : Prisma.empty

    const byUser = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as "userId",
        u.name as "userName",
        u.department as "department",
        COUNT(DISTINCT r.id) as "approvedRequests",
        COALESCE(SUM(er."quantityFulfilled"), 0) as "totalUnits",
        COALESCE(SUM(er."totalAmount"), 0) as "totalAmount"
      FROM "ExpenditureRecord" er
      JOIN "Request" r ON r.id = er."requestId"
      JOIN "User" u ON u.id = r."userId"
      WHERE er."sessionYear" = ${sessionYear}
        AND er."isReversed" = false
        ${departmentFilter}
      GROUP BY u.id, u.name, u.department
      ORDER BY "totalAmount" DESC
    `

    const seriesMonthly = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(er."approvedAt", 'YYYY-MM') as bucket,
        u.id as "userId",
        u.name as "userName",
        COALESCE(SUM(er."totalAmount"), 0) as "totalAmount"
      FROM "ExpenditureRecord" er
      JOIN "Request" r ON r.id = er."requestId"
      JOIN "User" u ON u.id = r."userId"
      WHERE er."sessionYear" = ${sessionYear}
        AND er."isReversed" = false
        ${departmentFilter}
      GROUP BY bucket, u.id, u.name
      ORDER BY bucket ASC
    `

    const seriesYearly = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(er."approvedAt", 'YYYY') as bucket,
        u.id as "userId",
        u.name as "userName",
        COALESCE(SUM(er."totalAmount"), 0) as "totalAmount"
      FROM "ExpenditureRecord" er
      JOIN "Request" r ON r.id = er."requestId"
      JOIN "User" u ON u.id = r."userId"
      WHERE er."sessionYear" = ${sessionYear}
        AND er."isReversed" = false
        ${departmentFilter}
      GROUP BY bucket, u.id, u.name
      ORDER BY bucket ASC
    `

    return {
      byUser: byUser.map((row) => ({
        userId: row.userId,
        userName: row.userName,
        department: row.department,
        approvedRequests: Number(row.approvedRequests),
        totalUnits: Number(row.totalUnits),
        totalAmount: Number(row.totalAmount),
      })),
      series: {
        monthly: seriesMonthly.map((row) => ({
          bucket: row.bucket,
          userId: row.userId,
          userName: row.userName,
          totalAmount: Number(row.totalAmount),
        })),
        yearly: seriesYearly.map((row) => ({
          bucket: row.bucket,
          userId: row.userId,
          userName: row.userName,
          totalAmount: Number(row.totalAmount),
        })),
      },
    }
  })

  return apiSuccess(data)
}

export const dynamic = 'force-dynamic'
