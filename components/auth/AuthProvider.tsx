'use client'

import { useEffect, useRef } from 'react'
import { tokenStore } from '@/lib/auth/token-store'

/**
 * Attempts a silent token refresh on mount using the HttpOnly session cookie.
 * If the refresh token cookie is gone (browser was closed), the server returns
 * 401 and the user is redirected to /login by the existing axios interceptor.
 *
 * Wrap this around the app in the root layout (below SessionProvider).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  async function silentRefresh(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        tokenStore.clear()
        return false
      }
      const { data } = await res.json()
      if (data?.accessToken) {
        tokenStore.set(data.accessToken, 14 * 60 * 1000) // 14 min
        scheduleRefresh(13 * 60 * 1000)                  // refresh at 13 min
      }
      return true
    } catch {
      tokenStore.clear()
      return false
    }
  }

  function scheduleRefresh(ms: number) {
    clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(silentRefresh, ms)
  }

  useEffect(() => {
    silentRefresh()
    return () => clearTimeout(refreshTimerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
