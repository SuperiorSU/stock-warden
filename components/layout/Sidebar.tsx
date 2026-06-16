'use client'

import { useState, useCallback, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ClipboardList, BarChart2,
  Bell, Users, LogOut, ChevronLeft, ChevronRight,
  User, Archive, Plus, Settings, TrendingUp, Activity,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label:  string
  href:   string
  icon:   React.ElementType
  exact?: boolean
}

export interface SidebarUser {
  name:        string
  role:        string
  department?: string
  avatarUrl?:  string
}

interface SidebarProps {
  user:          SidebarUser
  unreadCount?:  number
  isMobileOpen:  boolean
  onMobileClose: () => void
  onLogout:      () => void
}

const USER_NAV: NavItem[] = [
  { label: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard },
  { label: 'Inventory',     href: '/inventory',     icon: Package },
  { label: 'My Requests',   href: '/requests',      icon: ClipboardList },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile',       href: '/profile',       icon: User },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Requests',     href: '/admin/requests',     icon: Inbox },
  { label: 'Inventory',    href: '/admin/inventory',    icon: Archive },
  { label: 'Users',        href: '/admin/users',        icon: Users },
  { label: 'Analytics',    href: '/admin/analytics',    icon: BarChart2 },
  { label: 'Stock Alerts', href: '/admin/stock-alerts', icon: Bell },
  { label: 'Settings',     href: '/admin/settings',     icon: Settings },
]

const IM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/inventory-manager',           icon: LayoutDashboard, exact: true },
  { label: 'Requests',  href: '/inventory-manager/requests',  icon: ClipboardList },
  { label: 'All Items', href: '/inventory-manager/items',     icon: Archive },
  { label: 'Add Item',  href: '/inventory-manager/items/new', icon: Plus, exact: true },
  { label: 'Profile',   href: '/inventory-manager/profile',   icon: User },
]

const SA_NAV: NavItem[] = [
  { label: 'Overview',    href: '/super-admin/overview',               icon: LayoutDashboard },
  { label: 'Users',       href: '/super-admin/users',                  icon: Users },
  { label: 'Employees',   href: '/super-admin/employees',              icon: Users },
  { label: 'Expenditure', href: '/super-admin/analytics/expenditure',  icon: TrendingUp },
  { label: 'Analytics',   href: '/super-admin/analytics/consumption',  icon: Activity },
]

const NAV_MAP: Record<string, NavItem[]> = {
  USER:              USER_NAV,
  ADMIN:             ADMIN_NAV,
  INVENTORY_MANAGER: IM_NAV,
  SUPER_ADMIN:       SA_NAV,
}

const STORAGE_KEY = 'sw:sidebar:collapsed'

export const Sidebar = memo(function Sidebar({
  user, unreadCount, isMobileOpen, onMobileClose, onLogout
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === '1'
  })

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const navItems = NAV_MAP[user.role] ?? USER_NAV

  return (
    <>
      {/*
        Outer wrapper owns the width transition and is the positioning
        parent for the collapse toggle. It must NOT have overflow-hidden
        so the toggle button (at -right-3) is visible outside the sidebar edge.
      */}
      <div
        style={{
          width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
          transition: `width var(--dur-sidebar) var(--ease-out), transform var(--dur-sidebar) var(--ease-out)`,
        }}
        className={cn(
          'relative shrink-0 h-screen',
          // Mobile: slide in/out
          '-translate-x-full lg:translate-x-0',
          'fixed lg:relative z-40 lg:z-auto',
          isMobileOpen && 'translate-x-0',
        )}
      >
        {/* Sidebar panel — overflow-hidden clips content to current width during animation */}
        <aside
          className="flex flex-col w-full h-full bg-surface border-r border-border overflow-hidden"
          aria-label="Main navigation"
        >
          {/* Brand */}
          <div className="h-(--nav-height) flex items-center px-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-7 rounded-sm bg-accent shrink-0 flex items-center justify-center text-white font-bold text-13">
                SW
              </div>
              <span
                className="text-14 font-semibold text-ink-1 whitespace-nowrap overflow-hidden transition-opacity duration-200"
                style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
              >
                Stock Warden
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
            <ul role="list" className="space-y-0.5">
              {navItems.map(item => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                const Icon = item.icon
                const showBadge = item.label === 'Notifications' && !!unreadCount && unreadCount > 0

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        'group flex items-center gap-3 px-2.5 py-2 rounded-md',
                        'text-13 font-medium transition-colors duration-150',
                        'relative overflow-hidden',
                        'active:opacity-80',
                        active
                          ? 'bg-accent-tint text-accent-text'
                          : 'text-ink-2 hover:bg-sunken hover:text-ink-1'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {/* Active left-edge indicator */}
                      {active && (
                        <span
                          className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r-full"
                          aria-hidden
                        />
                      )}

                      <Icon
                        size={16}
                        strokeWidth={active ? 2 : 1.75}
                        className="shrink-0"
                      />

                      <span
                        className="whitespace-nowrap overflow-hidden transition-opacity duration-200"
                        style={{ opacity: collapsed ? 0 : 1 }}
                        aria-hidden={collapsed}
                      >
                        {item.label}
                      </span>

                      {showBadge && (
                        <span
                          className={cn(
                            'ml-auto shrink-0 min-w-4.5 h-4.5 px-1',
                            'bg-status-negative text-white text-10 font-bold',
                            'rounded-full flex items-center justify-center',
                            'transition-opacity duration-200',
                            collapsed ? 'opacity-0' : 'opacity-100'
                          )}
                          aria-label={`${unreadCount} unread`}
                        >
                          {unreadCount! > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User card + logout */}
          <div className="shrink-0 border-t border-border p-2 space-y-0.5">
            {/* User card — not clickable, just display */}
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md">
              <div className="size-7 rounded-full bg-accent-tint shrink-0 flex items-center justify-center text-12 font-semibold text-accent-text overflow-hidden">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="size-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div
                className="min-w-0 transition-opacity duration-200"
                style={{ opacity: collapsed ? 0 : 1 }}
              >
                <p className="text-13 font-medium text-ink-1 truncate leading-tight">{user.name}</p>
                <p className="text-11 text-ink-3 truncate leading-tight capitalize">
                  {user.role.toLowerCase().replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                'flex items-center gap-3 w-full px-2.5 py-2 rounded-md',
                'text-13 font-medium transition-colors duration-150',
                'text-ink-3 hover:bg-status-negative-tint hover:text-status-negative',
                'active:opacity-80',
                'cursor-pointer'
              )}
              title={collapsed ? 'Sign Out' : undefined}
            >
              <LogOut size={16} strokeWidth={1.75} className="shrink-0" />
              <span
                className="whitespace-nowrap overflow-hidden transition-opacity duration-200"
                style={{ opacity: collapsed ? 0 : 1 }}
                aria-hidden={collapsed}
              >
                Sign Out
              </span>
            </button>
          </div>
        </aside>

        {/*
          Collapse toggle — positioned on the wrapper (not inside aside)
          so overflow-hidden on aside does not clip it.
          Visible on desktop only.
        */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'hidden lg:flex',
            'absolute -right-3 top-18 z-10',
            'size-6 rounded-full bg-surface border border-border shadow-sm',
            'items-center justify-center',
            'text-ink-3 hover:text-ink-1 hover:border-border-strong hover:bg-sunken',
            'active:scale-90',
            'transition-all duration-150',
          )}
        >
          {collapsed
            ? <ChevronRight size={12} strokeWidth={2.5} />
            : <ChevronLeft  size={12} strokeWidth={2.5} />
          }
        </button>
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          onClick={onMobileClose}
          aria-hidden
        />
      )}
    </>
  )
})
