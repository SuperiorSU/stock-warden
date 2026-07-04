'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { AppShell } from './AppShell'
import { InventoryManagerLayout } from './inventory-manager-layout'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLogout } from '@/lib/hooks/use-logout'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const logout = useLogout()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data.data as { name: string; role: string; department?: string } | undefined
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="min-h-screen bg-canvas" />
  }

  if (me?.role === 'INVENTORY_MANAGER') {
    return <InventoryManagerLayout>{children}</InventoryManagerLayout>
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  const user = me
    ? { name: me.name, role: me.role, department: me.department }
    : { name: '…', role: 'ADMIN' }

  return (
    <>
      <AppShell
        user={user}
        onLogout={() => setIsLogoutModalOpen(true)}
      >
        {children}
      </AppShell>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        isDestructive
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </>
  )
}
