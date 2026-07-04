'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from 'next-auth/react'

export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    try {
      await signOut({ redirect: false })
    } catch {
      // ignore
    } finally {
      queryClient.clear()
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cims-auth')
        channel.postMessage({ type: 'LOGOUT' })
        channel.close()
      }
      router.push('/login')
    }
  }, [queryClient, router])
}
