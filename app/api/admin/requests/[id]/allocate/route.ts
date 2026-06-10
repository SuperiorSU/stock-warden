import { prisma } from '@/lib/db/prisma'
import { getRequestUser } from '@/lib/api/session'
import { apiError, apiSuccess } from '@/lib/api/response'
import { ValidationError, UnauthorizedError, NotFoundError, ConflictError } from '@/lib/errors'
import { z } from 'zod'

const AllocateQuantitySchema = z.object({
  allocations: z.array(
    z.object({
      requestItemId: z.string().uuid(),
      quantityAllocated: z.number().int().min(1).max(500),
    })
  ).min(1).max(10),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())

  // Only ADMIN and SUPER_ADMIN can allocate
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return apiError(new UnauthorizedError())
  }

  const body = await req.json()
  const parsed = AllocateQuantitySchema.safeParse(body)
  if (!parsed.success) return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))

  const { allocations } = parsed.data
  const { id: requestId } = await params

  // Duplicate check
  const ids = allocations.map((a) => a.requestItemId)
  const dup = ids.find((id, idx) => ids.indexOf(id) !== idx)
  if (dup) return apiError(new ValidationError('DUPLICATE_ITEM_IN_ALLOCATION'))

  // Load request and items
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: { items: true } })
  if (!request) return apiError(new NotFoundError('REQUEST_NOT_FOUND'))

  if (request.status !== 'REQUESTED') {
    return apiError(new ConflictError('INVALID_STATUS'))
  }

  // Ensure all requestItemIds belong to this request
  const itemMap = new Map(request.items.map((ri) => [ri.id, ri]))
  for (const a of allocations) {
    if (!itemMap.has(a.requestItemId)) {
      return apiError(new ValidationError('One or more request items do not belong to this request.'))
    }
  }

  // Validate against availableQty and quantityReq
  // Need to fetch inventory items for availability
  const itemIds = allocations.map((a) => itemMap.get(a.requestItemId)!.itemId)
  const inventoryItems = await prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } })
  const invMap = new Map(inventoryItems.map((i) => [i.id, i]))

  for (const a of allocations) {
    const ri = itemMap.get(a.requestItemId)!
    const inv = invMap.get(ri.itemId)
    if (!inv) return apiError(new NotFoundError('ITEM_NOT_FOUND'))

    if (a.quantityAllocated > ri.quantityReq) {
      return apiError(new ValidationError('ALLOCATION_EXCEEDS_REQUESTED'))
    }
    if (a.quantityAllocated > inv.availableQty) {
      return apiError(new ConflictError('INSUFFICIENT_STOCK'))
    }
  }

  // All validations passed — perform updates in transaction
  const result = await prisma.$transaction(async (tx) => {
    for (const a of allocations) {
      await tx.requestItem.update({ where: { id: a.requestItemId }, data: { quantityAllocated: a.quantityAllocated } })
    }

    await tx.requestStatusHistory.create({
      data: {
        requestId: requestId,
        fromStatus: request.status,
        toStatus: request.status,
        changedBy: user.id,
        notes: 'Admin adjusted quantities',
      },
    })

    await tx.request.update({ where: { id: requestId }, data: { allocatedByAdminAt: new Date() } })

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'REQUEST_QUANTITY_ALLOCATED',
        entity: 'Request',
        entityId: requestId,
        metadata: { allocations },
      },
    })

    return { success: true }
  })

  return apiSuccess({ requestId, allocations: allocations.map((a) => ({ requestItemId: a.requestItemId, quantityAllocated: a.quantityAllocated })) })
}

export const dynamic = 'force-dynamic'
