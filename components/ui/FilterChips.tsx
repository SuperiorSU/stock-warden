import { cn } from '@/lib/utils'

interface Chip {
  label:  string
  value:  string
  icon?:  React.ReactNode
}

interface FilterChipsProps {
  chips:      Chip[]
  value:      string
  onChange:   (value: string) => void
  className?: string
}

export function FilterChips({ chips, value, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn('flex items-center flex-wrap gap-1.5', className)}>
      {chips.map(chip => (
        <button
          key={chip.value}
          type="button"
          onClick={() => onChange(chip.value)}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-13',
            'font-medium border transition-colors duration-150',
            value === chip.value
              ? 'bg-accent-tint text-accent-text border-transparent'
              : 'bg-surface text-ink-2 border-border hover:bg-sunken hover:text-ink-1'
          )}
        >
          {chip.icon}
          {chip.label}
        </button>
      ))}
    </div>
  )
}
