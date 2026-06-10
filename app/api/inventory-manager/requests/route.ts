import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getRequestUser } from '@/lib/api/session'
import { ForbiddenError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { paginateWithCursor } from '@/lib/pagination/cursor'
import { decodeCursor, encodeCursor } from '@/lib/pagination/secure-cursor'

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sessionYear: z.coerce.number().int().optional(),
  status: z.string().optional(),
})

export async function GET(req: Request) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())
  if (user.role !== 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Access restricted.'))
  }

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sessionYear: url.searchParams.get('sessionYear') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  })

  if (!parsed.success) {
    return apiError(new ValidationError('Invalid query parameters.', parsed.error.flatten()))
  }

  let decodedCursor: { id: string; createdAt: Date } | null = null
  if (parsed.data.cursor) {
    try {
      decodedCursor = decodeCursor(parsed.data.cursor)
    } catch (error) {
      if (error instanceof Error) {
        return apiError(new ValidationError('Invalid cursor.'))
      }
      throw error
    }
  }

  const where: Record<string, unknown> = {
    status: parsed.data.status ?? 'PENDING',
    ...(parsed.data.sessionYear ? { sessionYear: parsed.data.sessionYear } : {}),
  }

  const page = await paginateWithCursor(
    (args) =>
      prisma.request.findMany({
        where,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, department: true, employeeId: true, email: true } },
          items: { include: { item: { select: { name: true, unit: true, unitPrice: true, availableQty: true, category: true } } } },
        },
      }),
    () => prisma.request.count({ where }),
    { cursor: decodedCursor?.id, limit: parsed.data.limit ?? 20 }
  )

  const lastItem = page.items[page.items.length - 1] as { id: string; createdAt: Date } | undefined
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null

  return apiSuccess(page.items, {
    limit: parsed.data.limit ?? 20,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor,
  })
}

export const dynamic = 'force-dynamic'