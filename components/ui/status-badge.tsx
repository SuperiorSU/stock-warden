import { cn } from '@/lib/utils'

export type RequestStatus = 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const CONFIG: Record<RequestStatus, { label: string; cls: string; dot: string }> = {
  REQUESTED: {
    label: 'Requested',
    cls:  'bg-status-info-tint text-status-info',
    dot:  'bg-status-info',
  },
  PENDING: {
    label: 'Awaiting IM',
    cls:  'bg-status-warning-tint text-status-warning',
    dot:  'bg-status-warning',
  },
  APPROVED: {
    label: 'Approved',
    cls:  'bg-status-positive-tint text-status-positive',
    dot:  'bg-status-positive',
  },
  REJECTED: {
    label: 'Rejected',
    cls:  'bg-status-negative-tint text-status-negative',
    dot:  'bg-status-negative',
  },
  CANCELLED: {
    label: 'Cancelled',
    cls:  'bg-status-neutral-tint text-status-neutral',
    dot:  'bg-status-neutral',
  },
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.REQUESTED
  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm',
        'text-12 font-medium leading-none',
        cfg.cls
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', cfg.dot)} aria-hidden />
      {cfg.label}
    </span>
  )
}
