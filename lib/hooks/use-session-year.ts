'use client'

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'sw:super-admin:sessionYear'

/**
 * Session-year selection persisted to localStorage, so the value survives
 * navigation between super-admin pages (sidebar clicks, links) without a
 * global store. Mirrors the same localStorage-persistence pattern already
 * used for sidebar collapse state (see components/layout/Sidebar.tsx).
 */
export function useSessionYear(defaultYear: number = new Date().getFullYear()) {
  const [sessionYear, setSessionYearState] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultYear
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? parseInt(stored, 10) : NaN
    return Number.isNaN(parsed) ? defaultYear : parsed
  })

  const setSessionYear = useCallback((year: number) => {
    setSessionYearState(year)
    window.localStorage.setItem(STORAGE_KEY, String(year))
  }, [])

  return [sessionYear, setSessionYear] as const
}
