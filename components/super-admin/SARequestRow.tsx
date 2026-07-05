'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/utils/format'
import { SARequest } from './types'
import { SARequestItemBreakdown } from './SARequestItemBreakdown'

const STATUS_CLASSES: Record<string, string> = {
  APPROVED:  'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  PENDING:   'bg-yellow-100 text-yellow-800',
  REQUESTED: 'bg-blue-100 text-blue-800',
}

export const SARequestRowMemo = memo(function SARequestRow({
  request,
  isExpanded,
  onToggle,
  employeeBasePath = '/super-admin/employees',
}: {
  request: SARequest
  isExpanded: boolean
  onToggle: () => void
  employeeBasePath?: string | null
}) {
  return (
    <>
      <tr
        className="hover:bg-[--bg-canvas] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[--ink-primary]">{request.user.name}</span>
            {employeeBasePath && (
              <Link
                href={`${employeeBasePath}/${request.user.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[--ink-disabled] hover:text-[--ink-primary] transition-colors"
                title="View employee profile"
              >
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
          <div className="text-xs text-[--ink-secondary]">{request.user.employeeId ?? '—'}</div>
        </td>
        <td className="px-6 py-4 text-[--ink-secondary]">{request.user.department ?? '—'}</td>
        <td className="px-6 py-4">
          <div className="text-[--ink-primary]">
            {format(new Date(request.createdAt), 'd MMM yyyy')}
          </div>
          <div className="text-xs text-[--ink-secondary]">
            {format(new Date(request.createdAt), 'MMMM yyyy')}
          </div>
        </td>
        <td className="px-6 py-4 text-[--ink-primary]">
          {request.items.length} {request.items.length === 1 ? 'item' : 'items'}
        </td>
        <td className="px-6 py-4 font-medium text-[--ink-primary]">
          {request.totalAmount != null ? formatINR(request.totalAmount) : (
            <span className="text-[--ink-disabled]">—</span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[request.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {request.status}
          </span>
        </td>
        <td className="px-6 py-4 text-[--ink-secondary]">{request.adminName ?? '—'}</td>
        <td className="px-6 py-4 text-[--ink-secondary]">{request.inventoryManagerName ?? '—'}</td>
        <td className="px-6 py-4">
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="text-[--ink-secondary] hover:text-[--ink-primary]"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <SARequestItemBreakdown request={request} />
          </td>
        </tr>
      )}
    </>
  )
})
