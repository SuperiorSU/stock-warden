'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { SAFilters, SARequest } from './types'
import { SARequestRowMemo } from './SARequestRow'
import { formatINR } from '@/lib/utils/format'

function buildUrl(base: string, params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null) sp.set(k, String(v))
  }
  return `${base}?${sp.toString()}`
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[--ink-secondary]">{label}</span>
      <span className="font-semibold text-[--ink-primary]">{value}</span>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-[--bg-subtle] rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  )
}

export function SARequestsTable({
  filters,
  basePath = '/super-admin/employees/requests',
  employeeBasePath = '/super-admin/employees',
}: {
  filters: SAFilters
  basePath?: string
  employeeBasePath?: string | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['sa-emp-requests', basePath, filters, cursor],
    queryFn: () =>
      api
        .get(buildUrl(basePath, { ...filters, cursor }))
        .then((r) => r.data),
    staleTime: 3 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const requests: SARequest[] = data?.data?.requests ?? []
  const summary  = data?.data?.summary
  const meta     = data?.meta

  return (
    <div className="space-y-4">
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load requests.</span>
          <button onClick={() => refetch()} disabled={isFetching} className="text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed">{isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      )}
      {/* Summary strip */}
      {summary && (
        <div className="flex flex-wrap gap-6 px-4 py-3 bg-[--bg-subtle] rounded-lg text-sm">
          <SummaryStat label="Total Requests" value={String(summary.totalRequests)} />
          <SummaryStat label="Total Amount" value={formatINR(summary.totalAmount)} />
          <SummaryStat label="Items Requested" value={String(summary.totalItemsRequested)} />
          <SummaryStat label="Items Fulfilled" value={String(summary.totalItemsFulfilled)} />
        </div>
      )}

      {/* Table */}
      <div className="relative bg-white rounded-lg border border-[--border-default] overflow-hidden">
        {isFetching && !isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-black animate-pulse" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                {['Employee', 'Department', 'Date', 'Items', 'Amount', 'Status', 'Approved By', 'Alloc. By (IM)', ''].map(
                  (h) => (
                    <th key={h} className="px-6 py-4 font-medium text-[--ink-secondary]">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[--ink-secondary]">
                    No requests match these filters.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <SARequestRowMemo
                    key={r.id}
                    request={r}
                    isExpanded={expandedId === r.id}
                    onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                    employeeBasePath={employeeBasePath}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta?.hasMore && (
        <div className="flex justify-center">
          <AsyncButton
            variant="secondary"
            isPending={isFetching}
            pendingLabel="Loading..."
            onClick={() => setCursor(meta.nextCursor)}
          >
            Load More
          </AsyncButton>
        </div>
      )}
    </div>
  )
}
