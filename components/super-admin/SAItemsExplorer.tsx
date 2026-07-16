'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatINR } from '@/lib/utils/format'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SAExportButton } from './SAExportButton'
import { useSessionYear } from '@/lib/hooks/use-session-year'

const STATUS_LABELS = ['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING', 'REQUESTED'] as const
const ITEM_COLORS = ['#16603A', '#14532D', '#15803D', '#22C55E', '#86EFAC', '#4ADE80', '#16A34A', '#1D7A4A']

type SortBy = 'amount' | 'qty' | 'requests'
type Order  = 'asc' | 'desc'

interface ItemRow {
  itemId:              string
  name:                string
  category:            string | null
  unitPrice:           number | null
  totalInventoryValue: number | null
  totalAmountSpent:    number
  totalRequestCount:   number
  totalQuantity:       number
  totalRequested:      number
  totalFulfilled:      number
  totalRejected:       number
  remainingStock:      number
}

const controlCls =
  'text-13 border border-border rounded-md px-3 py-1.5 bg-surface text-ink-1 ' +
  'focus:outline-none focus:ring-1 focus:ring-border-focus focus:border-border-focus ' +
  'hover:border-border-strong transition-colors'

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-12 text-ink-3 uppercase tracking-wide">{label}</span>
      <span className="text-14 font-semibold text-ink-1">{value}</span>
    </div>
  )
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="skeleton h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

export function SAItemsExplorer({
  itemsBasePath = '/super-admin/items',
  employeeBasePath = '/super-admin/employees',
  exportBasePath = '/api/super-admin/export',
}: {
  itemsBasePath?: string
  employeeBasePath?: string
  exportBasePath?: string
}) {
  const [sessionYear, setSessionYear] = useSessionYear()
  const [monthFrom, setMonthFrom] = useState('')
  const [monthTo, setMonthTo]     = useState('')
  const [category, setCategory]   = useState('')
  const [sortBy, setSortBy]       = useState<SortBy>('amount')
  const [order, setOrder]         = useState<Order>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filters = {
    sessionYear,
    monthFrom: monthFrom || undefined,
    monthTo:   monthTo   || undefined,
    category:  category  || undefined,
    sortBy,
    order,
  }

  const { data: itemsData, isLoading: isItemsLoading, isFetching: isItemsFetching, isError: isItemsError, refetch: refetchItems } = useQuery({
    queryKey: ['sa-items', filters],
    queryFn: () => api.get('/admin/stats/items', { params: filters }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const statusQueries = useQueries({
    queries: STATUS_LABELS.map((status) => ({
      queryKey: ['sa-status-count', sessionYear, status],
      queryFn: () =>
        api.get('/admin/requests', { params: { sessionYear, status, limit: 1 } })
          .then((r) => r.data.meta?.total ?? 0),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const items: ItemRow[] = itemsData?.items ?? []

  const topItems = useMemo(() => {
    return [...items]
      .sort((a, b) => b.totalRequested - a.totalRequested)
      .slice(0, 8)
      .map((item) => ({ name: item.name, qty: item.totalRequested }))
  }, [items])

  const statusDistribution = useMemo(() => {
    return STATUS_LABELS.map((status, i) => ({
      name:  status,
      value: statusQueries[i]?.data ?? 0,
    }))
  }, [statusQueries])

  const totalRequests = statusDistribution.reduce((s, d) => s + d.value, 0)

  const summary = useMemo(() => ({
    totalCatalogValue: items.reduce((s, i) => s + (i.totalInventoryValue ?? 0), 0),
    totalSpent:        items.reduce((s, i) => s + i.totalAmountSpent, 0),
    totalQtyFulfilled: items.reduce((s, i) => s + i.totalFulfilled, 0),
  }), [items])

  const isLoading = isItemsLoading || statusQueries.some((q) => q.isLoading)

  return (
    <div className="space-y-8 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-24 font-semibold text-ink-1">Items</h1>
          <p className="text-14 text-ink-3">Stock, fulfillment, and spend for every catalog item</p>
        </div>
        <SAExportButton type="items" filters={filters as Record<string, unknown>} basePath={exportBasePath} />
      </div>

      {isItemsError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-13">Couldn&apos;t load item data.</span>
          <button onClick={() => refetchItems()} disabled={isItemsFetching} className="text-13 font-medium underline disabled:opacity-50 disabled:cursor-not-allowed">{isItemsFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
            <div className="text-12 text-ink-3 uppercase tracking-wide">Total Requests</div>
            <div className="mt-1 text-32 font-semibold text-ink-1 tabular">{totalRequests.toLocaleString('en-IN')}</div>
            <div className="mt-1 text-12 text-ink-3">All statuses · {sessionYear}</div>
          </div>
          <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
            <div className="text-12 text-ink-3 uppercase tracking-wide">Approved</div>
            <div className="mt-1 text-32 font-semibold text-status-positive tabular">
              {(statusDistribution.find(s => s.name === 'APPROVED')?.value ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-12 text-ink-3">
              {totalRequests > 0
                ? `${Math.round(((statusDistribution.find(s => s.name === 'APPROVED')?.value ?? 0) / totalRequests) * 100)}% approval rate`
                : 'No data'}
            </div>
          </div>
          <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
            <div className="text-12 text-ink-3 uppercase tracking-wide">Unique Items Tracked</div>
            <div className="mt-1 text-32 font-semibold text-ink-1 tabular">{items.length}</div>
            <div className="mt-1 text-12 text-ink-3">Items with request data</div>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-surface p-6 rounded-lg border border-border shadow-sm min-w-0">
            <h3 className="text-14 font-semibold text-ink-1 mb-5">Top Requested Items</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={topItems} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} width={120} />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--surface-sunken)' }}
                    contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
                  />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} maxBarSize={32}>
                    {topItems.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={ITEM_COLORS[i % ITEM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {topItems.length === 0 && (
                <p className="mt-4 text-13 text-ink-3">No item request data for this session.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="space-y-5">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-13 font-medium text-ink-2">Session Year</label>
          <select value={sessionYear} onChange={(e) => setSessionYear(parseInt(e.target.value))} className={controlCls}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className={controlCls} aria-label="From month" />
          <span className="text-13 text-ink-3">to</span>
          <input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className={controlCls} aria-label="To month" />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category…"
            className={controlCls + ' w-36'}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={controlCls}>
            <option value="amount">Sort: Amount</option>
            <option value="qty">Sort: Qty</option>
            <option value="requests">Sort: Requests</option>
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value as Order)} className={controlCls}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-6 px-4 py-3 bg-sunken rounded-lg">
          <SummaryStat label="Catalog Value" value={formatINR(summary.totalCatalogValue)} />
          <SummaryStat label="Total Spent"   value={formatINR(summary.totalSpent)} />
          <SummaryStat label="Qty Fulfilled" value={summary.totalQtyFulfilled.toLocaleString('en-IN')} />
        </div>

        <p className="text-12 text-ink-3">
          Total Stock = all units ever added · Consumed = fulfilled from requests · Remaining = currently available
        </p>

        <div className="relative bg-surface rounded-lg border border-border overflow-hidden">
          {isItemsFetching && !isItemsLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent animate-pulse" />
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-14 text-left whitespace-nowrap">
              <thead className="border-b border-border">
                <tr>
                  {['Item', 'Category', 'Total Stock', 'Requested', 'Fulfilled', 'Rejected', 'Remaining', 'Stock Usage', 'Unit Price', 'Total Spent', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-12 font-semibold text-ink-3 uppercase tracking-[0.04em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isItemsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={11} />)
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-14 text-ink-3">No items found for this period.</td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const remaining = item.remainingStock ?? 0
                    const total     = Math.max(item.totalQuantity ?? 0, remaining + (item.totalFulfilled ?? 0))
                    const consumed  = Math.max(0, total - remaining)
                    const pct       = total > 0 ? Math.round((consumed / total) * 100) : 0
                    const isLow     = remaining === 0 || pct >= 90

                    return (
                      <React.Fragment key={item.itemId}>
                        <tr
                          className="hover:bg-sunken transition-colors duration-100 cursor-pointer"
                          onClick={() => setExpandedId(id => id === item.itemId ? null : item.itemId)}
                        >
                          <td className="px-4 py-3 font-medium text-ink-1">
                            <Link
                              href={`${itemsBasePath}/${item.itemId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {item.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-ink-2">{item.category ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular">{total.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular">{item.totalRequested.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-medium tabular text-status-positive">{item.totalFulfilled.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular text-status-negative">{item.totalRejected.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular">
                            <span className={isLow ? 'text-status-negative font-semibold' : 'text-status-positive font-medium'}>
                              {remaining.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-4 py-3 min-w-35">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-sunken overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isLow ? 'bg-status-negative' : 'bg-status-positive'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-12 tabular ${isLow ? 'text-status-negative' : 'text-ink-3'}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular">{item.unitPrice != null ? formatINR(item.unitPrice) : '—'}</td>
                          <td className="px-4 py-3 font-medium tabular">{formatINR(item.totalAmountSpent)}</td>
                          <td className="px-4 py-3">
                            {expandedId === item.itemId
                              ? <ChevronDown  size={15} className="text-ink-3" />
                              : <ChevronRight size={15} className="text-ink-3" />}
                          </td>
                        </tr>
                        {expandedId === item.itemId && (
                          <tr key={`${item.itemId}-detail`}>
                            <td colSpan={11} className="p-0">
                              <SAItemEmployeeBreakdown
                                itemId={item.itemId}
                                sessionYear={sessionYear}
                                monthFrom={monthFrom || undefined}
                                monthTo={monthTo || undefined}
                                itemsBasePath={itemsBasePath}
                                employeeBasePath={employeeBasePath}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function SAItemEmployeeBreakdown({
  itemId, sessionYear, monthFrom, monthTo, itemsBasePath, employeeBasePath,
}: {
  itemId:           string
  sessionYear:      number
  monthFrom?:       string
  monthTo?:         string
  itemsBasePath:    string
  employeeBasePath: string
}) {
  const params = new URLSearchParams({ sessionYear: String(sessionYear), limit: '50' })
  if (monthFrom) params.set('monthFrom', monthFrom)
  if (monthTo)   params.set('monthTo',   monthTo)

  const { data, isLoading } = useQuery({
    queryKey: ['sa-item-approved', itemId, sessionYear, monthFrom, monthTo],
    queryFn: () =>
      api.get(`/super-admin/items/${itemId}/approved?${params}`).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  })

  const records: {
    id: string; unitPrice: number; quantityFulfilled: number; totalAmount: number
    approvedAt: string; inventoryProcessedAt: string | null
    userId: string; employeeName: string; employeeId: string | null; department: string | null
    designation: string | null; adminName: string | null; imName: string | null
  }[] = data?.data?.records ?? []

  const summary = data?.data?.summary
  const hasMore = data?.meta?.hasMore

  return (
    <div className="px-6 py-4 bg-canvas border-t border-border space-y-3">
      <p className="text-12 font-semibold text-ink-3 uppercase tracking-wide">Approved allocations only</p>
      {isLoading ? (
        <div className="text-13 text-ink-3">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-13 text-ink-3">No approved allocations for this item in this period.</div>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-13 text-left whitespace-nowrap">
            <thead className="bg-sunken border-b border-border">
              <tr>
                {['Employee', 'Dept', 'Units', 'Unit Price', 'Total', 'Date Approved', 'Date Allocated', 'Approved By', 'Alloc. By (IM)'].map(h => (
                  <th key={h} className="px-4 py-2 font-semibold text-ink-3 text-12 uppercase tracking-[0.04em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-ink-1">
                    <Link href={`${employeeBasePath}/${r.userId}`} className="hover:underline">{r.employeeName}</Link>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{r.department ?? '—'}</td>
                  <td className="px-4 py-2 tabular">{r.quantityFulfilled}</td>
                  <td className="px-4 py-2 tabular">{formatINR(r.unitPrice)}</td>
                  <td className="px-4 py-2 font-semibold text-status-positive tabular">{formatINR(r.totalAmount)}</td>
                  <td className="px-4 py-2">{format(new Date(r.approvedAt), 'd MMM yyyy')}</td>
                  <td className="px-4 py-2">{r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-2">{r.adminName ?? '—'}</td>
                  <td className="px-4 py-2">{r.imName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t border-border bg-sunken">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-ink-2">Total ({summary.totalRecords} allocations)</td>
                  <td className="px-4 py-2 font-semibold tabular">{summary.totalUnits}</td>
                  <td />
                  <td className="px-4 py-2 font-bold text-status-positive tabular">{formatINR(summary.totalAmount)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {hasMore && (
        <Link
          href={`${itemsBasePath}/${itemId}`}
          className="inline-block text-12 font-medium text-accent hover:underline"
        >
          View full allocation history &amp; download &rarr;
        </Link>
      )}
    </div>
  )
}
