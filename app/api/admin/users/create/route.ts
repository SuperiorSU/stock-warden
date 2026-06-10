import { prisma } from '@/lib/db/prisma'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getRequestUser } from '@/lib/api/session'
import { ForbiddenError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { hashPassword } from '@/lib/auth/password'
import { z } from 'zod'

const CreateStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: z.enum(['ADMIN', 'INVENTORY_MANAGER'], { error: 'Role must be ADMIN or INVENTORY_MANAGER' }),
  department: z.string().max(100).optional(),
  employeeId: z.string().max(50).optional(),
  designation: z.string().max(100).optional(),
  phoneNumber: z.string().max(20).optional(),
})

export async function POST(req: Request) {
  const caller = await getRequestUser()
  if (!caller) return apiError(new UnauthorizedError())
  if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
    return apiError(new ForbiddenError('Only admins can create staff accounts.'))
  }

  const body = await req.json().catch(() => ({}))
  const parsed = CreateStaffSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(new ValidationError('Invalid payload.', parsed.error.flatten()))
  }

  const { name, email, password, role, department, employeeId, designation, phoneNumber } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (existing) {
    return apiError(new ValidationError('An account with this email already exists.'))
  }

  if (employeeId) {
    const existingEmpId = await prisma.user.findUnique({ where: { employeeId } })
    if (existingEmpId) {
      return apiError(new ValidationError('This employee ID is already in use.'))
    }
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      isApproved: true,
      isActive: true,
      department: department?.trim() || null,
      employeeId: employeeId?.trim() || null,
      designation: designation?.trim() || null,
      phoneNumber: phoneNumber?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      employeeId: true,
      designation: true,
      createdAt: true,
    },
  })

  return apiSuccess(user)
}

export const dynamic = 'force-dynamic'
