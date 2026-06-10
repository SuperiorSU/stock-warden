import { prisma } from '@/lib/db/prisma'
import { getRequestUser } from '@/lib/api/session'
import { apiError, apiSuccess } from '@/lib/api/response'
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit/log'
import { invalidatePattern } from '@/lib/cache/redis'

const SetPriceSchema = z.object({
  unitPrice: z.number().positive().refine((n) => Math.round(n * 100) === n * 100, { message: 'Invalid precision' }).max(999999.99),
  currency: z.string().length(3).optional().default('INR'),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return apiError(new ForbiddenError('Only admins can set item prices.'))
  }

  const body = await req.json()
  const parsed = SetPriceSchema.safeParse(body)
  if (!parsed.success) return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))

  const { id } = await params
  const existing = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!existing) return apiError(new NotFoundError('ITEM_NOT_FOUND'))

  const previousPrice = existing.unitPrice ? existing.unitPrice.toString() : null

  const updated = await prisma.inventoryItem.update({ where: { id }, data: { unitPrice: parsed.data.unitPrice, currency: parsed.data.currency } })

  await writeAuditLog({
    userId: user.id,
    action: 'ITEM_PRICE_UPDATED',
    entity: 'InventoryItem',
    entityId: id,
    metadata: { previousPrice, newPrice: parsed.data.unitPrice },
  })

  // Invalidate caches
  await invalidatePattern(`inventory:item:${id}`)
  await invalidatePattern(`admin:stats:items:${existing.sessionYear}:*`)

  return apiSuccess({ id: updated.id, unitPrice: updated.unitPrice, currency: updated.currency })
}

export const dynamic = 'force-dynamic'
