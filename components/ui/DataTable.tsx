import { cn } from '@/lib/utils'

export function Table({
  children, stackOnMobile = false, className
}: {
  children:       React.ReactNode
  stackOnMobile?: boolean
  className?:     string
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className={cn(
        'w-full text-14 border-collapse',
        stackOnMobile && 'stack-table'
      )}>
        {children}
      </table>
    </div>
  )
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({
  children, className, sortable, sorted
}: {
  children:   React.ReactNode
  className?: string
  sortable?:  boolean
  sorted?:    boolean
  direction?: 'asc' | 'desc'
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left text-12 font-semibold text-ink-3',
        'uppercase tracking-[0.04em] whitespace-nowrap bg-transparent',
        sortable && 'cursor-pointer select-none hover:text-ink-2',
        sorted   && 'text-ink-1',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function Tr({
  children, onClick, className
}: {
  children:   React.ReactNode
  onClick?:   () => void
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors duration-100 hover:bg-sunken',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  )
}

export function Td({
  children, className, label, full
}: {
  children:   React.ReactNode
  className?: string
  label?:     string
  full?:      boolean
}) {
  return (
    <td
      data-label={label}
      data-full={full ? '' : undefined}
      className={cn('px-4 py-3 text-14 text-ink-1', className)}
    >
      {children}
    </td>
  )
}
