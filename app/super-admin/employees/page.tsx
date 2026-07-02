import { SAEmployeeExplorer } from '@/components/super-admin/SAEmployeeExplorer'
import { SATopEmployeesSpend } from '@/components/super-admin/SATopEmployeesSpend'
import { prisma } from '@/lib/db/prisma'

async function getDepartments(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ['department'],
    orderBy: { department: 'asc' },
  })
  return users.map((u) => u.department!).filter(Boolean)
}

export default async function SAEmployeesPage() {
  const departments = await getDepartments()

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-display font-bold">Employee Requests</h1>
        <p className="text-sm text-[--ink-secondary]">
          Browse, filter, and export all employee stock requests.
        </p>
      </div>
      <SATopEmployeesSpend />
      <div className="border-t border-[--border-default]" />
      <SAEmployeeExplorer departments={departments} />
    </div>
  )
}
