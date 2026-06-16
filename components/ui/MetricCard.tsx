import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label:        string
  value:        string | number
  delta?:       number
  deltaLabel?:  string
  prefix?:      string
  size?:        'sm' | 'md' | 'lg'
  loading?:     boolean
  className?:   string
}

const SIZE_MAP = {
  sm: 'var(--metric-sm)',
  md: 'var(--metric-md)',
  lg: 'var(--metric-lg)',
}

export function MetricCard({
  label, value, delta, deltaLabel, prefix,
  size = 'md', loading, className
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="skeleton h-3.5 w-20" />
        <div className="skeleton h-9 w-32" />
        <div className="skeleton h-3 w-24" />
      </div>
    )
  }

  const positive = delta !== undefined && delta > 0
  const negative = delta !== undefined && delta < 0
  const flat     = delta !== undefined && delta === 0

  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-12 font-medium text-ink-3 uppercase tracking-[0.05em]">
        {label}
      </p>

      <p
        className="font-semibold text-ink-1 leading-none tabular"
        style={{ fontSize: SIZE_MAP[size] }}
      >
        {prefix && <span className="text-ink-3 mr-0.5">{prefix}</span>}
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>

      {delta !== undefined && (
        <p className={cn(
          'flex items-center gap-1 text-12 font-medium',
          positive && 'delta-up',
          negative && 'delta-down',
          flat     && 'delta-flat'
        )}>
          {positive && <TrendingUp   size={12} strokeWidth={2} />}
          {negative && <TrendingDown size={12} strokeWidth={2} />}
          {flat     && <Minus        size={12} strokeWidth={2} />}
          <span>
            {positive ? '+' : ''}{delta.toFixed(1)}%
            {deltaLabel && (
              <span className="text-ink-3 font-normal ml-1">{deltaLabel}</span>
            )}
          </span>
        </p>
      )}
    </div>
  )
}
