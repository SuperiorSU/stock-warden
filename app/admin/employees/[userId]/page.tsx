import { SAEmployeeDetail } from '@/components/super-admin/SAEmployeeDetail'

export default async function AdminEmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  return <SAEmployeeDetail userId={userId} backHref="/admin/employees" />
}
