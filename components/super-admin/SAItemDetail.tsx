'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts'
import { ArrowLeft, Download } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { formatINR } from '@/lib/utils/format'
import { useSessionYear } from '@/lib/hooks/use-session-year'
import { useXlsxExport } from '@/lib/hooks/use-xlsx-export'

const COLORS = ['#166534', '#14532D', '#15803D', '#22C55E', '#86EFAC']

const controlCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black'

interface ItemStats {
  itemId: string
  name: string
  unit: string
  category: string | null
  totalRequested: number
  totalApproved: number
  totalRejected: number
  yearlyDemand: { year: number; totalRequested: number; totalApproved: number }[]
  departmentUsage: { department: string; qty: number }[]
}

interface AllocationRecord {
  id: string
  unitPrice: number
  quantityFulfilled: number
  totalAmount: number
  approvedAt: string
  inventoryProcessedAt: string | null
  userId: string
  employeeName: string
  department: string | null
  adminName: string | null
  imName: string | null
}

const PAGE_SIZE = 25

export function SAItemDetail({
  itemId,
  itemsBasePath = '/super-admin/items',
  employeeBasePath = '/super-admin/employees',
  exportBasePath = '/api/super-admin/export',
}: {
  itemId: string
  itemsBasePath?: string
  employeeBasePath?: string
  exportBasePath?: string
}) {
  const [sessionYear, setSessionYear] = useSessionYear()
  const [monthFrom, setMonthFrom] = useState('')
  const [monthTo, setMonthTo] = useState('')
  const [offset, setOffset] = useState(0)

  const statsFilters = { monthFrom: monthFrom || undefined, monthTo: monthTo || undefined }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['super-admin-item-stats', itemId, statsFilters],
    queryFn: async () => {
      const res = await api.get(`/super-admin/stats/items/${itemId}`, { params: statsFilters })
      return res.data.data as ItemStats
    },
  })

  const allocationFilters = { sessionYear, monthFrom: monthFrom || undefined, monthTo: monthTo || undefined, limit: PAGE_SIZE, offset }

  const { data: allocationsData, isLoading: isAllocationsLoading, isFetching: isAllocationsFetching, isError: isAllocationsError, refetch: refetchAllocations } = useQuery({
    queryKey: ['sa-item-allocations', itemId, allocationFilters],
    queryFn: () => api.get(`/super-admin/items/${itemId}/approved`, { params: allocationFilters }).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const records: AllocationRecord[] = allocationsData?.data?.records ?? []
  const summary = allocationsData?.data?.summary
  const hasMore = allocationsData?.meta?.hasMore

  function resetPaging() {
    setOffset(0)
  }

  const exportParams = new URLSearchParams({ sessionYear: String(sessionYear) })
  if (monthFrom) exportParams.set('monthFrom', monthFrom)
  if (monthTo)   exportParams.set('monthTo', monthTo)

  const { isExporting, exportFile: handleExport } = useXlsxExport(
    `${exportBasePath}/items/${itemId}/allocations?${exportParams}`,
    `export-item-${itemId}.xlsx`
  )

  return (
    <div className="space-y-6 page-enter">
      <Link href={itemsBasePath} className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        Back to Items
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">{data?.name ?? (isLoading ? 'Loading…' : 'Item')}</h1>
          <p className="text-sm text-[--ink-secondary]">
            {data?.category ?? '—'} · Cross-session analytics for this item
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-[--ink-secondary]">Session Year:</label>
          <select
            value={sessionYear}
            onChange={(e) => { setSessionYear(parseInt(e.target.value)); resetPaging() }}
            className={controlCls}
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <input type="month" value={monthFrom} onChange={(e) => { setMonthFrom(e.target.value); resetPaging() }} className={controlCls} aria-label="From month" />
          <span className="text-sm text-[--ink-secondary]">to</span>
          <input type="month" value={monthTo} onChange={(e) => { setMonthTo(e.target.value); resetPaging() }} className={controlCls} aria-label="To month" />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          Couldn&apos;t load analytics for this item.
        </div>
      )}

      {!isLoading && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
            <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Total Requested</div>
            <div className="mt-1 text-2xl font-display font-bold">{data.totalRequested.toLocaleString('en-IN')}</div>
            <div className="mt-1 text-xs text-[--ink-secondary]">Unit: {data.unit}</div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
            <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Total Approved</div>
            <div className="mt-1 text-2xl font-display font-bold text-green-700">{data.totalApproved.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
            <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Total Rejected</div>
            <div className="mt-1 text-2xl font-display font-bold text-red-700">{data.totalRejected.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-6">Year-over-Year Demand</h3>
        {isLoading ? (
          <div className="skeleton h-72 rounded" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.yearlyDemand ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <RechartsTooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
                <Bar dataKey="totalRequested" name="Total Requested" fill="var(--ink-disabled)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalApproved" name="Total Approved" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {(data?.yearlyDemand ?? []).length === 0 && (
              <p className="mt-4 text-sm text-[--ink-secondary]">No historical demand data for this item.</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-6">Usage by Department</h3>
        {isLoading ? (
          <div className="skeleton h-72 rounded" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.departmentUsage ?? []} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis dataKey="department" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <RechartsTooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
                <Bar dataKey="qty" name="Quantity" radius={[0, 4, 4, 0]}>
                  {(data?.departmentUsage ?? []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {(data?.departmentUsage ?? []).length === 0 && (
              <p className="mt-4 text-sm text-[--ink-secondary]">No department usage data for this period.</p>
            )}
          </div>
        )}
      </div>

      {/* Allocation log — who received this item, when, and by whom it was approved/allocated */}
      <div className="bg-white rounded-lg border border-[--border-default] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-[--border-default]">
          <div>
            <h3 className="font-bold text-[--ink-primary]">Allocation History</h3>
            <p className="text-xs text-[--ink-secondary]">Approved allocations for Session Year {sessionYear}</p>
          </div>
          <AsyncButton variant="secondary" isPending={isExporting} pendingLabel="Exporting…" onClick={handleExport}>
            <Download size={14} />
            Export (.xlsx)
          </AsyncButton>
        </div>

        {summary && (
          <div className="flex flex-wrap gap-6 px-6 py-3 bg-[--bg-subtle] border-b border-[--border-default] text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-[--ink-secondary]">Total Records</span>
              <span className="font-semibold">{summary.totalRecords}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[--ink-secondary]">Total Units</span>
              <span className="font-semibold">{summary.totalUnits}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[--ink-secondary]">Total Amount</span>
              <span className="font-semibold text-green-700">{formatINR(summary.totalAmount)}</span>
            </div>
          </div>
        )}

        {isAllocationsError && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-red-800 flex items-center justify-between">
            <span className="text-sm">Couldn&apos;t load the allocation log.</span>
            <button onClick={() => refetchAllocations()} disabled={isAllocationsFetching} className="text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed">{isAllocationsFetching ? 'Retrying…' : 'Retry'}</button>
          </div>
        )}

        <div className="relative overflow-x-auto">
          {isAllocationsFetching && !isAllocationsLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-black animate-pulse" />
          )}
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                {['Employee', 'Department', 'Units', 'Unit Price', 'Total', 'Date Approved', 'Date Allocated', 'Approved By', 'Alloc. By (IM)'].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium text-[--ink-secondary]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {isAllocationsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-5 py-3"><div className="skeleton h-4 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[--ink-secondary]">
                    No approved allocations for this item in this period.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-5 py-3 font-medium text-[--ink-primary]">
                      <Link href={`${employeeBasePath}/${r.userId}`} className="hover:underline">{r.employeeName}</Link>
                    </td>
                    <td className="px-5 py-3 text-[--ink-secondary]">{r.department ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.quantityFulfilled}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatINR(r.unitPrice)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700 tabular-nums">{formatINR(r.totalAmount)}</td>
                    <td className="px-5 py-3">{format(new Date(r.approvedAt), 'd MMM yyyy')}</td>
                    <td className="px-5 py-3">{r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy') : '—'}</td>
                    <td className="px-5 py-3">{r.adminName ?? '—'}</td>
                    <td className="px-5 py-3">{r.imName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center py-4 border-t border-[--border-default]">
            <AsyncButton
              variant="secondary"
              isPending={isAllocationsFetching}
              pendingLabel="Loading..."
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Load More
            </AsyncButton>
          </div>
        )}
      </div>
    </div>
  )
}
