'use client'

import { usePathname } from 'next/navigation'
import { UserLayout } from '@/components/layout/user-layout'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SuperAdminLayout } from '@/components/layout/super-admin-layout'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const publicRoutes = new Set(['/', '/login', '/register'])

  if (pathname.startsWith('/super-admin')) {
    return <SuperAdminLayout>{children}</SuperAdminLayout>
  }

  if (pathname.startsWith('/admin')) {
    return <AdminLayout>{children}</AdminLayout>
  }

  // Inventory-manager has its own route-group layout — pass through without wrapping
  if (pathname.startsWith('/inventory-manager')) {
    return <>{children}</>
  }

  if (publicRoutes.has(pathname)) {
    return <>{children}</>
  }

  return <UserLayout>{children}</UserLayout>
}
