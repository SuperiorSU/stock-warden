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
  category: z.string().optional(),
  itemId: z.string().uuid().optional(),
})

export async function GET(req: Request) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return apiError(new UnauthorizedError())

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return apiError(new ValidationError('Invalid query.', parsed.error.flatten()))

  const { sessionYear, granularity, category, itemId } = parsed.data
  const cacheKey = `admin:stats:consumption:${sessionYear}:${granularity}:${category ?? 'all'}:${itemId ?? 'all'}`

  const data = await cached(cacheKey, 300, async () => {
    const filters = [Prisma.sql`sh."changeType" = 'FULFILLED'`, Prisma.sql`ii."sessionYear" = ${sessionYear}`]
    if (category) {
      filters.push(Prisma.sql`ii."category" = ${category}`)
    }
    if (itemId) {
      filters.push(Prisma.sql`ii.id = ${itemId}`)
    }

    const whereClause = Prisma.join(filters, ' AND ')

    const seriesMonthly = await prisma.$queryRaw<{ month: string; units: number }[]>`
      SELECT to_char("createdAt", 'YYYY-MM') as month, SUM("quantityDelta" * -1) as units
      FROM "StockHistory" sh
      JOIN "InventoryItem" ii ON ii.id = sh."itemId"
      WHERE ${whereClause}
      GROUP BY month ORDER BY month
    `

    const seriesYearly = await prisma.$queryRaw<{ year: string; units: number }[]>`
      SELECT to_char("createdAt", 'YYYY') as year, SUM("quantityDelta" * -1) as units
      FROM "StockHistory" sh
      JOIN "InventoryItem" ii ON ii.id = sh."itemId"
      WHERE ${whereClause}
      GROUP BY year ORDER BY year
    `

    // By category totals
    const byCategory = await prisma.$queryRaw<{ category: string; units: number; expenditure: number | null }[]>`
      SELECT ii."category" as category, SUM(sh."quantityDelta" * -1) as units, SUM(COALESCE(er."totalAmount",0)) as expenditure
      FROM "StockHistory" sh
      JOIN "InventoryItem" ii ON ii.id = sh."itemId"
      LEFT JOIN "ExpenditureRecord" er ON er."itemId" = ii.id
      WHERE ${Prisma.join([Prisma.sql`sh."changeType" = 'FULFILLED'`, Prisma.sql`ii."sessionYear" = ${sessionYear}`, ...(category ? [Prisma.sql`ii."category" = ${category}`] : [])], ' AND ')}
      GROUP BY ii."category"
    `

    const totalUnits = seriesMonthly.reduce((s, r) => s + Number(r.units), 0)
    const totalExpenditure = byCategory.reduce((s, r) => s + Number(r.expenditure || 0), 0)

    return {
      totalUnitsConsumed: totalUnits,
      totalExpenditure: Number(totalExpenditure.toFixed(2)),
      byCategory: byCategory.map((b) => ({ category: b.category, unitsConsumed: Number(b.units), expenditure: Number(b.expenditure || 0) })),
      series: {
        monthly: seriesMonthly.map((s) => ({ month: s.month, unitsConsumed: Number(s.units) })),
        yearly: seriesYearly.map((s) => ({ year: Number(s.year), unitsConsumed: Number(s.units) })),
      },
    }
  })

  return apiSuccess(data)
}

export const dynamic = 'force-dynamic'
