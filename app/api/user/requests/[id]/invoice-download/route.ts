import { getRequestUser } from '@/lib/api/session'
import { apiError } from '@/lib/api/response'
import { UnauthorizedError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/db/prisma'
import { renderInvoicePdf } from '@/lib/pdf/invoice'

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
  if (request.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return apiError(new UnauthorizedError())
  }

  if (request.status !== 'APPROVED' || !request.invoiceNumber) {
    return apiError(new NotFoundError('Invoice not available.'))
  }

  const [adminUser, inventoryManagerUser] = await Promise.all([
    request.adminId ? prisma.user.findUnique({ where: { id: request.adminId }, select: { name: true, designation: true } }) : null,
    request.inventoryManagerId ? prisma.user.findUnique({ where: { id: request.inventoryManagerId }, select: { name: true } }) : null,
  ])

  const pdfBuffer = await renderInvoicePdf({
    invoiceNumber: request.invoiceNumber,
    processedAt: request.processedAt ?? new Date(),
    sessionYear: request.sessionYear,
    userName: request.user.name,
    userDepartment: request.user.department,
    userEmployeeId: request.user.employeeId,
    adminName: adminUser?.name ?? 'Admin',
    adminDesignation: adminUser?.designation ?? null,
    inventoryManagerName: inventoryManagerUser?.name ?? 'Inventory Manager',
    adminNotes: request.adminNotes ?? null,
    items: request.items.map((entry) => ({
      id: entry.id,
      name: entry.item.name,
      unit: entry.item.unit,
      quantityReq: entry.quantityReq,
      quantityFul: entry.quantityFul,
    })),
    collegeName: process.env.COLLEGE_NAME ?? 'College',
    collegeAddress: process.env.COLLEGE_ADDRESS ?? '',
    collegeSealText: process.env.COLLEGE_SEAL_TEXT ?? '',
  })

  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set('Content-Disposition', `attachment; filename="${request.invoiceNumber}.pdf"`)

  return new Response(new Uint8Array(pdfBuffer), { headers })
}

export const dynamic = 'force-dynamic'
