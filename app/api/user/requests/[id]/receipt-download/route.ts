import { getRequestUser } from '@/lib/api/session'
import { apiError } from '@/lib/api/response'
import { UnauthorizedError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/db/prisma'
import { renderReceiptPdf } from '@/lib/pdf/receipt'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())

  const { id } = await params
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { item: true } },
    },
  })
  if (!request) return apiError(new NotFoundError('Request not found.'))
  if (request.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return apiError(new UnauthorizedError())

  if (request.status !== 'APPROVED' || !request.receiptNumber) {
    return apiError(new NotFoundError('Receipt not available.'))
  }

  const [adminUser, inventoryManagerUser] = await Promise.all([
    request.adminId ? prisma.user.findUnique({ where: { id: request.adminId }, select: { name: true } }) : null,
    request.inventoryManagerId ? prisma.user.findUnique({ where: { id: request.inventoryManagerId }, select: { name: true } }) : null,
  ])

  const pdfBuffer = await renderReceiptPdf({
    receiptNumber: request.receiptNumber,
    processedAt: request.processedAt ?? new Date(),
    sessionYear: request.sessionYear,
    issuedToName: request.user.name,
    issuedToDepartment: request.user.department,
    adminName: adminUser?.name ?? 'Admin',
    adminNotes: request.adminNotes ?? null,
    inventoryManagerName: inventoryManagerUser?.name ?? 'Inventory Manager',
    items: request.items.map((entry) => ({
      id: entry.id,
      name: entry.item.name,
      unit: entry.item.unit,
      quantity: entry.quantityFul ?? entry.quantityReq,
      unitPrice: entry.item.unitPrice ? String(entry.item.unitPrice) : null,
      lineTotal: entry.item.unitPrice
        ? String(Number(entry.item.unitPrice) * Number(entry.quantityFul ?? entry.quantityReq))
        : null,
    })),
    collegeName: process.env.COLLEGE_NAME ?? 'College',
    collegeAddress: process.env.COLLEGE_ADDRESS ?? '',
  })

  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set('Content-Disposition', `attachment; filename="${request.receiptNumber}.pdf"`)

  return new Response(new Uint8Array(pdfBuffer), { headers })
}

export const dynamic = 'force-dynamic'
