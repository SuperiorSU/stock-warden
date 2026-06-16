'use client'

import { useState, useCallback } from 'react'
import { Sidebar, type SidebarUser } from './Sidebar'
import { TopNav } from './TopNav'
import { cn } from '@/lib/utils'

interface AppShellProps {
  user:          SidebarUser
  pageTitle?:    string
  breadcrumbs?:  { label: string; href?: string }[]
  unreadCount?:  number
  children:      React.ReactNode
  className?:    string
  onLogout:      () => void
}

export function AppShell({
  user, pageTitle, breadcrumbs, unreadCount, children, className, onLogout
}: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const openMobile  = useCallback(() => setIsMobileOpen(true),  [])
  const closeMobile = useCallback(() => setIsMobileOpen(false), [])

  return (
    <div className="flex h-dvh bg-canvas overflow-hidden">
      <Sidebar
        user={user}
        unreadCount={unreadCount}
        isMobileOpen={isMobileOpen}
        onMobileClose={closeMobile}
        onLogout={onLogout}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          title={pageTitle ?? ''}
          onMenuToggle={openMobile}
          unreadCount={unreadCount}
          breadcrumbs={breadcrumbs}
        />
        <main className={cn('flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 page-enter', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
