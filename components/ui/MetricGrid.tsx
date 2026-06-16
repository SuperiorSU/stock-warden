import React from 'react'
import { cn } from '@/lib/utils'

export function MetricGrid({
  children, className
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-px bg-border',
        'grid-cols-2 md:grid-cols-4',
        'rounded-lg overflow-hidden border border-border',
        className
      )}
    >
      {React.Children.map(children, child => (
        <div className="bg-surface px-5 py-5 md:px-6 md:py-6">
          {child}
        </div>
      ))}
    </div>
  )
}
