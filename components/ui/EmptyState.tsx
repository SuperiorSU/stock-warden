import Link from 'next/link'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title:        string
  description?: string
  action?:      { label: string; href?: string; onClick?: () => void }
  icon?:        React.ReactNode
  className?:   string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      {icon && (
        <div className="mb-4 text-ink-4">{icon}</div>
      )}
      <p className="text-16 font-semibold text-ink-1 mb-1">{title}</p>
      {description && (
        <p className="text-14 text-ink-3 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              href={action.href}
              className="text-14 font-medium text-accent hover:text-accent-mid hover:underline"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="text-14 font-medium text-accent hover:underline"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
