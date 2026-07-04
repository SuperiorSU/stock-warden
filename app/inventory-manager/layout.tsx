import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { InventoryManagerLayout } from '@/components/layout/inventory-manager-layout'

export default async function InventoryManagerRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user?.role !== 'INVENTORY_MANAGER') {
    redirect('/dashboard')
  }
  return <InventoryManagerLayout>{children}</InventoryManagerLayout>
}
