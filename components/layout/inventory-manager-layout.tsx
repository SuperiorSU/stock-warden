'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { AppShell } from './AppShell'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export function InventoryManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut({ redirect: false })
    } catch {
      // ignore
    } finally {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cims-auth')
        channel.postMessage({ type: 'LOGOUT' })
        channel.close()
      }
      router.push('/login')
    }
  }

  const user = me
    ? { name: me.name, role: 'INVENTORY_MANAGER', department: me.department }
    : { name: '…', role: 'INVENTORY_MANAGER' }

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
