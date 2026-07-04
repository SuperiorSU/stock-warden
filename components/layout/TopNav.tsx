'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Menu, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopNavProps {
  title:               string
  onMenuToggle:        () => void
  unreadCount?:        number
  breadcrumbs?:        { label: string; href?: string }[]
  hideNotifications?:  boolean
  scrolled?:           boolean
}

export const TopNav = memo(function TopNav({
  title, onMenuToggle, unreadCount, breadcrumbs, hideNotifications, scrolled
}: TopNavProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center gap-3',
        'h-[var(--nav-height)] px-4 md:px-6',
        'bg-surface/95 backdrop-blur-sm border-b border-border',
        'transition-shadow duration-200',
        scrolled ? 'shadow-sm' : 'shadow-none' // scroll state is lifted from AppShell's <main> scroll container
      )}
    >
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 -ml-1 rounded-md text-ink-3
                   hover:text-ink-1 hover:bg-sunken transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>

      {/* Page title / breadcrumbs */}
      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-13">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-4 text-11">/</span>}
                  {crumb.href && i < breadcrumbs.length - 1 ? (
                    <a
                      href={crumb.href}
                      className="text-ink-3 hover:text-ink-1 transition-colors truncate"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="font-semibold text-ink-1 truncate">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <h1 className="text-16 font-semibold text-ink-1 truncate">{title}</h1>
        )}
      </div>

      {/* Notification bell */}
      {!hideNotifications && (
        <Link
          href="/notifications"
          className="relative p-1.5 rounded-md text-ink-3 hover:text-ink-1 hover:bg-sunken transition-colors"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell size={18} strokeWidth={1.75} />
          {unreadCount && unreadCount > 0 ? (
            <span
              className="absolute top-0.5 right-0.5 size-[7px] rounded-full bg-status-negative"
              aria-hidden
            />
          ) : null}
        </Link>
      )}
    </header>
  )
})
