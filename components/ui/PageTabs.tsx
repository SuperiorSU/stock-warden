'use client'

import { cn } from '@/lib/utils'

interface Tab {
  label:  string
  value:  string
  count?: number
}

interface PageTabsProps {
  tabs:       Tab[]
  value:      string
  onChange:   (value: string) => void
  className?: string
}

export function PageTabs({ tabs, value, onChange, className }: PageTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-0 border-b border-border overflow-x-auto',
        '[&::-webkit-scrollbar]:hidden',
        className
      )}
      role="tablist"
    >
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'relative flex items-center gap-2 px-4 py-3',
            'text-13 font-medium whitespace-nowrap',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-inset focus-visible:ring-border-focus',
            value === tab.value
              ? 'text-ink-1'
              : 'text-ink-3 hover:text-ink-2'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-11 font-semibold px-1.5 py-0.5 rounded-sm',
              value === tab.value
                ? 'bg-accent-tint text-accent-text'
                : 'bg-sunken text-ink-3'
            )}>
              {tab.count}
            </span>
          )}
          {value === tab.value && (
            <span
              className="absolute bottom-0 left-0 right-0 h-px bg-accent rounded-t-full"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  )
}
