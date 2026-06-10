import { prisma } from '@/lib/db/prisma'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getRequestUser } from '@/lib/api/session'
import {
  ConflictCodeError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors'
import { InventoryManagerRequestActionSchema } from '@/lib/validation/requests'
import { generateInvoiceNumber, generateReceiptNumber } from '@/lib/api/invoice'
import { dispatch } from '@/lib/notifications/dispatcher'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getRequestUser()
  if (!manager) return apiError(new UnauthorizedError())
  if (manager.role !== 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Only inventory managers can confirm requests.'))
  }

  const body = await req.json().catch(() => ({}))
  const parsed = InventoryManagerRequestActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))
  }

  const { id } = await params
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { item: true } },
    },
  })

  if (!request) {
    return apiError(new NotFoundError('Request not found.'))
  }

  if (request.status !== 'PENDING') {
    return apiError(new ConflictError('Only admin-approved requests can be confirmed.'))
  }

  const invoiceNumber = generateInvoiceNumber(request.sessionYear)
  const receiptNumber = generateReceiptNumber(request.sessionYear)

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of request.items) {
        const effectiveQty = item.quantityAllocated ?? item.quantityReq

        const [row] = await tx.$queryRaw<{ id: string; availableQty: number; name: string }[]>`
          SELECT id, "availableQty", name
          FROM "InventoryItem"
          WHERE id = ${item.itemId}
          FOR UPDATE
        `

        if (!row || row.availableQty < effectiveQty) {
          throw new ConflictCodeError('INSUFFICIENT_STOCK', 'Insufficient stock.', {
            itemId: item.itemId,
            available: row?.availableQty ?? 0,
          })
        }

        const newQty = row.availableQty - effectiveQty
        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data: { availableQty: newQty },
        })

        await tx.stockHistory.create({
          data: {
            itemId: item.itemId,
            changeType: 'FULFILLED',
            quantityDelta: -effectiveQty,
            quantityAfter: newQty,
            changedBy: manager.id,
            requestId: request.id,
            notes: 'Request confirmed by inventory manager',
          },
        })

        await tx.requestItem.update({
          where: { id: item.id },
          data: { quantityFul: effectiveQty },
        })

        const inv = await tx.inventoryItem.findUnique({
          where: { id: item.itemId },
          select: { unitPrice: true, name: true, category: true },
        })

        if (inv && inv.unitPrice !== null) {
          const unitPriceNum = Number(inv.unitPrice)
          const totalAmount = Number((unitPriceNum * effectiveQty).toFixed(2))
          await tx.expenditureRecord.create({
            data: {
              requestId: request.id,
              requestItemId: item.id,
              itemId: item.itemId,
              itemName: inv.name,
              category: inv.category,
              unitPrice: inv.unitPrice.toString(),
              quantityFulfilled: effectiveQty,
              totalAmount: totalAmount.toString(),
              sessionYear: request.sessionYear,
              approvedAt: new Date(),
              approvedBy: manager.id,
              department: request.user.department,
            },
          })
        }
      }

      await tx.request.update({
        where: { id },
        data: {
          status: 'APPROVED',
          invoiceNumber,
          receiptNumber,
          inventoryManagerId: manager.id,
          inventoryManagerNotes: parsed.data.notes,
          processedAt: new Date(),
          inventoryProcessedAt: new Date(),
        },
      })

      await tx.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: request.status,
          toStatus: 'APPROVED',
          changedBy: manager.id,
          notes: parsed.data.notes,
        },
      })
    })
  } catch (error) {
    if (error instanceof ConflictCodeError || error instanceof ValidationError) {
      return apiError(error)
    }
    if (error instanceof ConflictError) {
      return apiError(error)
    }
    throw error
  }

  const requestOrigin = new URL(req.url)
  const invoiceDownloadUrl = new URL(`/api/user/requests/${id}/invoice-download`, requestOrigin).toString()

  await dispatch({
    userId: request.userId,
    type: 'REQUEST_APPROVED',
    title: 'Request approved',
    message: 'Your request was approved.',
    requestId: id,
    sendEmail: true,
    emailTo: request.user.email,
    emailData: {
      invoiceNumber,
      recipientName: request.user.name,
      downloadUrl: invoiceDownloadUrl,
    },
  })

  return apiSuccess({
    id,
    status: 'APPROVED',
    invoiceNumber,
    invoiceUrl: invoiceDownloadUrl,
  })
}

export const dynamic = 'force-dynamic'