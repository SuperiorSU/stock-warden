'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DrawerProps {
  open:       boolean
  onClose:    () => void
  title:      string
  subtitle?:  string
  children:   React.ReactNode
  className?: string
}

export function Drawer({ open, onClose, title, subtitle, children, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-45 bg-black/20 backdrop-blur-[1px]',
          'transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50',
          'w-full sm:w-[480px] lg:w-[540px]',
          'bg-surface border-l border-border',
          'flex flex-col outline-none',
          'transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="min-w-0 pr-3">
            <h2 id="drawer-title" className="text-16 font-semibold text-ink-1 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-13 text-ink-3 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mt-0.5 -mr-1 rounded-md text-ink-3 hover:text-ink-1 hover:bg-sunken transition-colors shrink-0"
            aria-label="Close panel"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </>
  )
}
