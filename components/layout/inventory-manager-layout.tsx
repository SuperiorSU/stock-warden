'use client'

import { Archive, ClipboardList, LogOut, Menu, Package, Plus, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export function InventoryManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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

  const links = [
    { href: '/inventory-manager', label: 'Dashboard', icon: Package, exact: true },
    { href: '/inventory-manager/requests', label: 'Requests', icon: ClipboardList, exact: false },
    { href: '/inventory-manager/items', label: 'All Items', icon: Archive, exact: false },
    { href: '/inventory-manager/items/new', label: 'Add New Item', icon: Plus, exact: true },
    { href: '/inventory-manager/profile', label: 'My Profile', icon: Settings, exact: false },
  ]

  return (
    <div className="min-h-screen bg-[--bg-canvas] flex">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-[--border-default]">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-display text-base font-bold text-[--ink-primary]">
            <Package className="text-black" size={18} />
            Inventory Desk
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-[--border-default] p-2 text-[--ink-secondary] hover:text-[--ink-primary]"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`w-60 bg-white border-r border-[--border-default] flex flex-col fixed h-full z-30 transform transition-transform duration-200 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="h-16 flex items-center px-6 border-b border-[--border-default]">
          <Link href="/inventory-manager" className="font-display text-xl font-bold text-[--ink-primary] flex items-center space-x-2">
            <Package className="text-black" />
            Inventory Desk
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto lg:hidden inline-flex cursor-pointer items-center justify-center rounded-md border border-[--border-default] p-1.5 text-[--ink-secondary] hover:text-[--ink-primary]"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 py-6 px-3 flex flex-col space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-[--ink-secondary] hover:bg-[--bg-subtle] hover:text-[--ink-primary]'
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[--border-default]">
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center space-x-3 px-3 py-2 w-full rounded-md cursor-pointer text-sm font-medium text-[--ink-secondary] hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-60 flex flex-col min-h-screen pt-14 lg:pt-0">
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        isDestructive={true}
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  )
}
