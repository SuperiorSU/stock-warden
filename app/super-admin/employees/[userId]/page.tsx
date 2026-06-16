import { SAEmployeeDetail } from '@/components/super-admin/SAEmployeeDetail'

export default async function SAEmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  return <SAEmployeeDetail userId={userId} />
}
