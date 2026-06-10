import React from 'react'

export type RequestStatus = 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const STATUS_CONFIG = {
  REQUESTED: { label: 'Requested',  color: 'text-amber-700  bg-amber-50  border-amber-200' },
  PENDING:   { label: 'Awaiting Inventory Manager',    color: 'text-blue-700   bg-blue-50   border-blue-200' },
  APPROVED:  { label: 'Approved',   color: 'text-green-700  bg-green-50  border-green-200' },
  REJECTED:  { label: 'Rejected',   color: 'text-red-700    bg-red-50    border-red-200' },
  CANCELLED: { label: 'Cancelled',  color: 'text-zinc-500   bg-zinc-50   border-zinc-200' },
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, color } = STATUS_CONFIG[status] || STATUS_CONFIG.REQUESTED;
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${color}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  )
}
