import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { getRequestUser } from '@/lib/api/session'
import { apiError, apiSuccess } from '@/lib/api/response'
import { UnauthorizedError, ValidationError } from '@/lib/errors'
import { cached } from '@/lib/cache/redis'
import { z } from 'zod'
import { toNumber } from '@/lib/utils/prisma-decimal'

const QuerySchema = z.object({
  sessionYear: z.preprocess((v) => Number(v), z.number().int()),
  granularity: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  category: z.string().optional(),
  itemId: z.string().uuid().optional(),
  department: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function GET(req: Request) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return apiError(new UnauthorizedError())

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return apiError(new ValidationError('Invalid query.', parsed.error.flatten()))

  const { sessionYear, granularity, category, itemId, department, dateFrom, dateTo } = parsed.data
  const cacheKey = `admin:stats:expenditure:${sessionYear}:${granularity}:${category ?? 'all'}:${itemId ?? 'all'}:${department ?? 'all'}`

  const data = await cached(cacheKey, 300, async () => {
    const where: any = { sessionYear, isReversed: false }
    if (category) where.category = category
    if (itemId) where.itemId = itemId
    if (department) where.department = department
    if (dateFrom || dateTo) where.approvedAt = {}
    if (dateFrom) where.approvedAt.gte = new Date(dateFrom)
    if (dateTo) where.approvedAt.lte = new Date(dateTo)

    const total = await prisma.expenditureRecord.aggregate({ _sum: { totalAmount: true } })
    const totalExpenditure = toNumber(total._sum.totalAmount) ?? 0

    // By category
    const byCategoryRaw = await prisma.expenditureRecord.groupBy({
      by: ['category'],
      where,
      _sum: { totalAmount: true },
      _count: { itemId: true },
    })

    const byCategory = byCategoryRaw.map((b) => ({
      category: b.category,
      totalAmount: toNumber(b._sum.totalAmount) ?? 0,
      itemCount: b._count.itemId,
    }))

    const categoryFilter = category
      ? Prisma.sql`AND "category" = ${category}`
      : Prisma.empty

    // Series
    const seriesMonthly = await prisma.$queryRaw<any[]>`
      SELECT to_char("approvedAt", 'YYYY-MM') as month, SUM("totalAmount") as amount
      FROM "ExpenditureRecord"
      WHERE "sessionYear" = ${sessionYear} AND "isReversed" = false
      ${categoryFilter}
      GROUP BY month ORDER BY month
    `

    const seriesYearly = await prisma.$queryRaw<any[]>`
      SELECT to_char("approvedAt", 'YYYY') as year, SUM("totalAmount") as amount
      FROM "ExpenditureRecord"
      WHERE "sessionYear" = ${sessionYear} AND "isReversed" = false
      ${categoryFilter}
      GROUP BY year ORDER BY year
    `

    const topItems = await prisma.expenditureRecord.groupBy({
      by: ['itemId','itemName'],
      where,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    })

    return {
      totalExpenditure,
      currency: 'INR',
      byCategory,
      series: {
        monthly: seriesMonthly.map((s) => ({ month: s.month, amount: Number(s.amount) })),
        yearly: seriesYearly.map((s) => ({ year: Number(s.year), amount: Number(s.amount) })),
      },
      topItems: topItems.map((t) => ({ itemId: t.itemId, name: t.itemName, totalAmount: toNumber(t._sum.totalAmount) ?? 0 })),
    }
  })

  return apiSuccess(data)
}

export const dynamic = 'force-dynamic'
