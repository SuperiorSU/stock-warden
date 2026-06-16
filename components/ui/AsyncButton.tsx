'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AsyncButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isPending?:    boolean
  pendingLabel?: string
  variant?:      'primary' | 'secondary' | 'danger' | 'ghost'
}

const VARIANT_CLASSES: Record<NonNullable<AsyncButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-mid active:bg-accent/90 ' +
    'focus-visible:ring-accent disabled:opacity-50',
  secondary:
    'border border-border-strong text-ink-1 bg-surface ' +
    'hover:bg-sunken hover:border-border-strong active:bg-sunken/60 ' +
    'focus-visible:ring-accent disabled:opacity-50',
  danger:
    'bg-status-negative text-white hover:bg-status-negative/90 active:bg-status-negative/80 ' +
    'focus-visible:ring-status-negative disabled:opacity-50',
  ghost:
    'text-ink-2 hover:bg-sunken hover:text-ink-1 active:bg-sunken/60 ' +
    'focus-visible:ring-accent disabled:opacity-50',
}

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ isPending = false, pendingLabel, variant = 'primary', disabled, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isPending}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-14 font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'cursor-pointer disabled:cursor-not-allowed',
          'active:scale-[0.98]',
          VARIANT_CLASSES[variant],
          className
        )}
        {...props}
      >
        {isPending && <Loader2 size={14} className="animate-spin shrink-0" />}
        {isPending && pendingLabel ? pendingLabel : children}
      </button>
    )
  }
)
AsyncButton.displayName = 'AsyncButton'
