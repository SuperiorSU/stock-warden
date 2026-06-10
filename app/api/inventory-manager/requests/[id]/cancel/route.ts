import { prisma } from '@/lib/db/prisma'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getRequestUser } from '@/lib/api/session'
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { InventoryManagerRequestActionSchema } from '@/lib/validation/requests'
import { dispatch } from '@/lib/notifications/dispatcher'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getRequestUser()
  if (!manager) return apiError(new UnauthorizedError())
  if (manager.role !== 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Only inventory managers can cancel requests.'))
  }

  const body = await req.json().catch(() => ({}))
  const parsed = InventoryManagerRequestActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))
  }

  const { id } = await params
  const request = await prisma.request.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!request) {
    return apiError(new NotFoundError('Request not found.'))
  }

  if (request.status !== 'PENDING') {
    return apiError(new ConflictError('Only admin-approved requests can be cancelled.'))
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.request.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        inventoryManagerId: manager.id,
        inventoryManagerNotes: parsed.data.notes,
        inventoryProcessedAt: new Date(),
      },
    })

    await tx.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: request.status,
        toStatus: 'CANCELLED',
        changedBy: manager.id,
        notes: parsed.data.notes,
      },
    })

    return result
  })

  await dispatch({
    userId: request.userId,
    type: 'REQUEST_CANCELLED',
    title: 'Request cancelled',
    message: parsed.data.notes ?? 'Your request was cancelled by the inventory manager.',
    requestId: id,
  })

  return apiSuccess(updated)
}

export const dynamic = 'force-dynamic'