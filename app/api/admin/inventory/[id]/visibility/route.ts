import { prisma } from '@/lib/db/prisma'
import { getRequestUser } from '@/lib/api/session'
import { apiError, apiSuccess } from '@/lib/api/response'
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit/log'
import { invalidatePattern } from '@/lib/cache/redis'

const VisibilitySchema = z.object({ hidden: z.boolean() })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())

  const body = await req.json()
  const parsed = VisibilitySchema.safeParse(body)
  if (!parsed.success) return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))

  const { hidden } = parsed.data
  const { id } = await params

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return apiError(new ForbiddenError('Only admins can change item visibility.'))
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!item) return apiError(new NotFoundError('ITEM_NOT_FOUND'))

  // If already in desired state, return informative 200
  if (item.isHiddenFromUsers === hidden) {
    return apiSuccess({ alreadyHidden: hidden })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.inventoryItem.update({
      where: { id },
      data: {
        isHiddenFromUsers: hidden,
        hiddenAt: hidden ? new Date() : null,
        hiddenBy: hidden ? user.id : null,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: hidden ? 'ITEM_HIDDEN_FROM_USERS' : 'ITEM_UNHIDDEN_FROM_USERS',
        entity: 'InventoryItem',
        entityId: id,
        metadata: { itemName: item.name },
      },
    })

    return u
  })

  // Invalidate caches
  await invalidatePattern('inventory:items:list:*')
  await invalidatePattern(`inventory:item:${id}`)

  return apiSuccess({ id: updated.id, isHiddenFromUsers: updated.isHiddenFromUsers, hiddenAt: updated.hiddenAt })
}

export const dynamic = 'force-dynamic'
