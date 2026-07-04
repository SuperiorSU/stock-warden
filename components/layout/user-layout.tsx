'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { AppShell } from './AppShell'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLogout } from '@/lib/hooks/use-logout'

export function UserLayout({ children }: { children: React.ReactNode }) {
  const logout = useLogout()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data.data as { name: string; role: string; department?: string } | undefined
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: notificationsData } = useQuery({
    queryKey: ['user-notifications'],
    queryFn: async () => {
      const res = await api.get('/user/notifications?limit=10')
      return res.data.data
    },
    refetchInterval: 45000,
    staleTime: 45000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const unreadCount = (notificationsData ?? []).filter((n: any) => !n.isRead).length

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  const user = me
    ? { name: me.name, role: me.role, department: me.department }
    : { name: '…', role: 'USER' }

  return (
    <>
      <AppShell
        user={user}
        unreadCount={unreadCount}
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
