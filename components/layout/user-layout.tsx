'use client'

import { Bell, Package, UserCircle, LogOut, Check, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut({ redirect: false })
    } catch (err) {
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

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.patch(`/user/notifications/${id}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] })
    }
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return await api.patch(`/user/notifications/read-all`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] })
    }
  })

  const notifications = notificationsData || []
  const unreadCount = notifications.filter((n: any) => !n.isRead).length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className={[
        'bg-[--bg-surface]/95 backdrop-blur-sm border-b border-[--border-default] sticky top-0 z-30',
        'transition-shadow duration-200',
        scrolled ? 'shadow-md' : 'shadow-none',
      ].join(' ')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-3 sm:space-x-8">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              className="md:hidden inline-flex items-center justify-center rounded-md border border-[--border-default] p-2 text-[--ink-secondary] hover:text-[--ink-primary]"
              aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link href="/dashboard" className="font-display text-lg sm:text-xl font-bold text-[--ink-primary] flex items-center space-x-2">
              <Package className="text-black" />
              Stock Warden
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/inventory', label: 'Inventory' },
                { href: '/requests', label: 'My Requests' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-[--ink-primary] ${
                    pathname.startsWith(link.href) ? 'text-[--ink-primary] border-b-2 border-black h-16 flex items-center' : 'text-[--ink-secondary] h-16 flex items-center'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative" ref={notificationRef}>
              <button 
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-1.5 text-[--ink-secondary] hover:text-black hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <div className="absolute right-0 bg-white mt-2 w-[90vw] max-w-sm sm:w-80 rounded-lg shadow-lg border border-[--border-default] z-50 overflow-hidden">
                  <div className="p-3 border-b border-[--border-default] flex items-center justify-between">
                    <h3 className="font-medium text-[--ink-primary] text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        type="button"
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-xs text-black cursor-pointer hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto bg-white">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-[--ink-secondary]">
                        No notifications
                      </div>
                    ) : (
                      <div className="divide-y divide-[--border-default]">
                        {notifications.map((notif: any) => (
                          <div 
                            key={notif.id} 
                            className={`p-3 text-sm flex space-x-3 ${!notif.isRead ? 'bg-[--bg-subtle]' : ''}`}
                            onClick={() => !notif.isRead && markReadMutation.mutate(notif.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${!notif.isRead ? 'text-[--ink-primary]' : 'text-[--ink-secondary]'}`}>
                                {notif.title}
                              </p>
                              <p className="text-[--ink-secondary] text-xs mt-0.5 line-clamp-2">
                                {notif.message}
                              </p>
                              <p className="text-[--ink-disabled] text-[10px] mt-1">
                                {new Date(notif.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  markReadMutation.mutate(notif.id)
                                }}
                                className="text-black self-start"
                                title="Mark as read"
                              >
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/profile" className="p-1.5 text-[--ink-secondary] hover:text-black cursor-pointer hover:bg-slate-100 rounded-full transition-colors">
              <UserCircle size={24} />
            </Link>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="p-1.5 text-[--ink-secondary] hover:text-black cursor-pointer hover:bg-red-100 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="md:hidden border-b border-[--border-default] bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col space-y-2">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/inventory', label: 'Inventory' },
              { href: '/requests', label: 'My Requests' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileNavOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'bg-[--bg-subtle] text-[--ink-primary]'
                    : 'text-[--ink-secondary] hover:bg-[--bg-subtle] hover:text-[--ink-primary]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
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
