'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmModalProps {
  isOpen:        boolean
  title:         string
  description:   string
  confirmText?:  string
  cancelText?:   string
  onConfirm:     () => void
  onCancel:      () => void
  isLoading?:    boolean
  isDestructive?: boolean
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText  = 'Confirm',
  cancelText   = 'Cancel',
  onConfirm,
  onCancel,
  isLoading    = false,
  isDestructive = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]">
      <div
        className="bg-surface rounded-lg shadow-md border border-border w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <h3 className="text-16 font-semibold text-ink-1">{title}</h3>
          <p className="mt-2 text-14 text-ink-2 leading-relaxed">{description}</p>
        </div>

        <div className="px-6 py-4 bg-canvas border-t border-border flex justify-end gap-3">
          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-14 font-medium rounded-md',
              'border border-border text-ink-2 bg-surface',
              'hover:bg-sunken hover:text-ink-1 hover:border-border-strong',
              'active:scale-[0.98] transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {cancelText}
          </button>

          {/* Confirm */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-14 font-medium rounded-md text-white',
              'inline-flex items-center gap-2',
              'active:scale-[0.98] transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDestructive
                ? 'bg-status-negative hover:bg-status-negative/90 focus-visible:ring-status-negative'
                : 'bg-accent hover:bg-accent-mid focus-visible:ring-accent'
            )}
          >
            {isLoading && <Loader2 size={14} className="animate-spin shrink-0" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
