'use client'

import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/format'
import { SARequest } from './types'

export function SARequestItemBreakdown({ request }: { request: SARequest }) {
  return (
    <div className="px-6 py-4 bg-[--bg-canvas] border-t border-[--border-default] space-y-4">
      {/* Metadata */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[--ink-secondary]">
        {request.receiptNumber && (
          <span>
            Receipt: <span className="font-medium text-[--ink-primary]">{request.receiptNumber}</span>
          </span>
        )}
        {request.adminName && (
          <span>Approved by: <span className="font-medium text-[--ink-primary]">{request.adminName}</span></span>
        )}
        {request.processedAt && (
          <span>
            Approved on:{' '}
            <span className="font-medium text-[--ink-primary]">
              {format(new Date(request.processedAt), 'd MMM yyyy, h:mm a')}
            </span>
          </span>
        )}
        {request.inventoryManagerName && (
          <span>
            Allocated by:{' '}
            <span className="font-medium text-[--ink-primary]">{request.inventoryManagerName}</span>
          </span>
        )}
        {request.inventoryProcessedAt && (
          <span>
            Allocated on:{' '}
            <span className="font-medium text-[--ink-primary]">
              {format(new Date(request.inventoryProcessedAt), 'd MMM yyyy, h:mm a')}
            </span>
          </span>
        )}
        {request.notes && (
          <span>Note: &ldquo;{request.notes}&rdquo;</span>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded border border-[--border-default]">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-[--bg-subtle]">
            <tr>
              {['Item', 'Category', 'Requested', 'Allocated', 'Fulfilled', 'Unit Price', 'Total'].map(
                (h) => (
                  <th key={h} className="px-4 py-2 font-medium text-[--ink-secondary]">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[--border-default] bg-white">
            {request.items.map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td className="px-4 py-2 font-medium text-[--ink-primary]">{item.item.name}</td>
                <td className="px-4 py-2 text-[--ink-secondary]">{item.item.category ?? '—'}</td>
                <td className="px-4 py-2">{item.quantityReq} {item.item.unit}</td>
                <td className="px-4 py-2">
                  {(item.quantityAllocated ?? item.quantityReq)} {item.item.unit}
                </td>
                <td className="px-4 py-2">
                  {item.quantityFul != null ? `${item.quantityFul} ${item.item.unit}` : '—'}
                </td>
                <td className="px-4 py-2">
                  {item.unitPrice != null ? formatINR(item.unitPrice) : '—'}
                </td>
                <td className="px-4 py-2">
                  {item.lineTotal != null ? formatINR(item.lineTotal) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {request.totalAmount != null && (
            <tfoot>
              <tr className="border-t border-[--border-default] bg-[--bg-subtle]">
                <td colSpan={6} className="px-4 py-2 font-medium text-right text-[--ink-secondary]">
                  Total
                </td>
                <td className="px-4 py-2 font-bold text-[--ink-primary]">
                  {formatINR(request.totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
