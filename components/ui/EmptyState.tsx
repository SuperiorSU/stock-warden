import Link from 'next/link'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      {icon && (
        <div className="mb-4 text-[--ink-disabled]">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-[--ink-primary] mb-1">{title}</p>
      {description && (
        <p className="text-sm text-[--ink-secondary] max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
