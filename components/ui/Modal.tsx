'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title:      string
  children:   React.ReactNode
  size?:      'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement
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
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full bg-surface outline-none',
          'rounded-t-xl sm:rounded-lg shadow-md',
          SIZE_MAP[size],
          className
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="modal-title" className="text-16 font-semibold text-ink-1">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-3 hover:text-ink-1 hover:bg-sunken transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto max-h-[80dvh]">
          {children}
        </div>
      </div>
    </div>
  )
}
