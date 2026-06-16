'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatINR } from '@/lib/utils/format'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SAExportButton } from '@/components/super-admin/SAExportButton'

// ── Colour maps ───────────────────────────────────────────────────────────────
const STATUS_LABELS = ['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING', 'REQUESTED'] as const
const STATUS_COLORS: Record<string, string> = {
  APPROVED:  '#16A34A',
  REJECTED:  '#DC2626',
  CANCELLED: '#52525B',
  PENDING:   '#D97706',
  REQUESTED: '#2563EB',
}
const ITEM_COLORS = ['#16603A', '#14532D', '#15803D', '#22C55E', '#86EFAC', '#4ADE80', '#16A34A', '#1D7A4A']

// ── Types ─────────────────────────────────────────────────────────────────────
type SortBy  = 'amount' | 'qty' | 'requests'
type Order   = 'asc' | 'desc'
type TabKey  = 'items' | 'employees'

interface ItemRow {
  itemId:              string
  itemName:            string
  category:            string | null
  totalAmountSpent:    number
  totalQtyFulfilled:   number
  totalRequestCount:   number
  currentStock:        number | null
  totalStock:          number | null
  unitPrice:           number | null
  totalInventoryValue: number | null
}

interface ItemsSummary {
  totalCatalogValue:  number
  totalSpent:         number
  totalQtyFulfilled:  number
  topCategory:        string | null
}

// ── Small helpers ─────────────────────────────────────────────────────────────
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SAConsumptionPage() {
  // Shared filter
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear())

  // Consumption-specific filters
  const [granularity, setGranularity] = useState<'monthly' | 'yearly'>('monthly')

  // Item-analytics-specific filters
  const [monthFrom, setMonthFrom]   = useState('')
  const [monthTo, setMonthTo]       = useState('')
  const [category, setCategory]     = useState('')
  const [sortBy, setSortBy]         = useState<SortBy>('amount')
  const [order, setOrder]           = useState<Order>('desc')
  const [tab, setTab]               = useState<TabKey>('items')
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)

  // ── Consumption queries ───────────────────────────────────────────────────
  const { data: itemsStats, isLoading: isItemsLoading } = useQuery({
    queryKey: ['sa-consumption-items', sessionYear],
    queryFn: () =>
      api.get('/admin/stats/items', { params: { sessionYear } }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: requestStats, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['sa-consumption-requests', sessionYear, granularity],
    queryFn: () =>
      api.get('/admin/stats/requests', { params: { sessionYear, granularity } }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
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

  // ── Item-analytics query ──────────────────────────────────────────────────
  const itemFilters = {
    sessionYear,
    monthFrom: monthFrom || undefined,
    monthTo:   monthTo   || undefined,
    category:  category  || undefined,
    sortBy,
    order,
  }

  // ── Employee-analytics query ──────────────────────────────────────────────
  const { data: userStatsData, isLoading: isUserStatsLoading } = useQuery({
    queryKey: ['sa-user-stats', sessionYear, granularity],
    queryFn: () =>
      api.get('/admin/stats/users', { params: { sessionYear, granularity } }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'employees',
  })

  const { data: analyticsData, isLoading: isAnalyticsLoading, isFetching: isAnalyticsFetching } = useQuery({
    queryKey: ['sa-item-analytics', itemFilters],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(itemFilters).forEach(([k, v]) => { if (v != null) params.set(k, String(v)) })
      return api.get(`/super-admin/items/analytics?${params}`).then((r) => r.data)
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // ── Derived data ──────────────────────────────────────────────────────────
  const requestSeries = useMemo(() => {
    return (requestStats?.series ?? []).map((entry: { bucket: string; total: number }) => ({
      month:    new Date(entry.bucket).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      requests: entry.total,
    }))
  }, [requestStats])

  const topItems = useMemo(() => {
    return [...(itemsStats?.items ?? [])]
      .sort((a: any, b: any) => b.totalRequested - a.totalRequested)
      .slice(0, 8)
      .map((item: any) => ({ name: item.name, qty: item.totalRequested }))
  }, [itemsStats])

  const statusDistribution = useMemo(() => {
    return STATUS_LABELS.map((status, i) => ({
      name:  status,
      value: statusQueries[i]?.data ?? 0,
    }))
  }, [statusQueries])

  const totalRequests = statusDistribution.reduce((s, d) => s + d.value, 0)

  const analyticsItems: ItemRow[]       = analyticsData?.data?.items   ?? []
  const analyticsSummary: ItemsSummary  = analyticsData?.data?.summary

  interface EmpRow {
    userId: string; userName: string; department: string | null
    approvedRequests: number; totalUnits: number; totalAmount: number
  }
  const empRows: EmpRow[]    = userStatsData?.byUser ?? []
  const topEmployees         = empRows.slice(0, 8).map((e) => ({ name: e.userName, amount: e.totalAmount }))
  const empTotalSpent        = empRows.reduce((s, e) => s + e.totalAmount, 0)
  const empTotalUnits        = empRows.reduce((s, e) => s + e.totalUnits, 0)

  const isConsumptionLoading =
    isItemsLoading || isRequestsLoading || statusQueries.some((q) => q.isLoading)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 page-enter">

      {/* ━━ SECTION 1 — CONSUMPTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-24 font-semibold text-ink-1">Platform Consumption</h1>
            <p className="text-14 text-ink-3">Item usage and fulfillment trends across all departments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-13 font-medium text-ink-2">Session Year</label>
            <select
              value={sessionYear}
              onChange={(e) => setSessionYear(parseInt(e.target.value))}
              className={controlCls}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'monthly' | 'yearly')}
              className={controlCls}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* Summary cards */}
        {isConsumptionLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}
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
              <div className="mt-1 text-32 font-semibold text-ink-1 tabular">{itemsStats?.items?.length ?? 0}</div>
              <div className="mt-1 text-12 text-ink-3">Items with request data</div>
            </div>
          </div>
        )}

        {/* Charts grid */}
        {!isConsumptionLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request volume line chart */}
            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm min-w-0">
              <h3 className="text-14 font-semibold text-ink-1 mb-5">Request Volume Over Time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={requestSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink-3)' }} />
                    <RechartsTooltip contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'var(--accent)' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {requestSeries.length === 0 && (
                  <p className="mt-4 text-13 text-ink-3">No request data for this session.</p>
                )}
              </div>
            </div>

            {/* Status distribution donut */}
            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm min-w-0">
              <h3 className="text-14 font-semibold text-ink-1 mb-5">Request Status Distribution</h3>
              <div className="h-44 flex justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#888'} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-12 text-ink-2">
                    <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.name] }} />
                    <span>{entry.name}</span>
                    <span className="text-ink-4">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top requested items bar chart */}
            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm lg:col-span-2 min-w-0">
              <h3 className="text-14 font-semibold text-ink-1 mb-5">Top Requested Items (Platform-wide)</h3>
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
                      {topItems.map((_: any, i: number) => (
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

        {/* Item fulfillment table */}
        {!isConsumptionLoading && (
          <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
            <h3 className="text-14 font-semibold text-ink-1 mb-1">Item Fulfillment Summary</h3>
            <p className="text-12 text-ink-3 mb-4">
              Total Stock = all units ever added · Consumed = fulfilled from requests · Remaining = currently available
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-14 whitespace-nowrap">
                <thead className="border-b border-border">
                  <tr>
                    {['Item', 'Total Stock', 'Requested', 'Fulfilled', 'Rejected', 'Remaining', 'Stock Usage'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-12 font-semibold text-ink-3 uppercase tracking-[0.04em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(itemsStats?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-14 text-ink-3">
                        No item data for this session.
                      </td>
                    </tr>
                  ) : (
                    (itemsStats?.items ?? []).map((item: any) => {
                      const remaining = item.remainingStock ?? 0
                      const total     = Math.max(item.totalQuantity ?? 0, remaining + (item.totalFulfilled ?? 0))
                      const consumed  = Math.max(0, total - remaining)
                      const pct       = total > 0 ? Math.round((consumed / total) * 100) : 0
                      const isLow     = remaining === 0 || pct >= 90

                      return (
                        <tr key={item.itemId} className="hover:bg-sunken transition-colors duration-100">
                          <td className="px-4 py-3 font-medium text-ink-1">{item.name}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular">{total.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular">{(item.totalRequested ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-medium tabular text-status-positive">
                            {(item.totalFulfilled ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right tabular text-status-negative">
                            {(item.totalRejected ?? 0).toLocaleString('en-IN')}
                          </td>
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
                              <span className={`text-12 tabular ${isLow ? 'text-status-negative' : 'text-ink-3'}`}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ━━ DIVIDER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="border-t border-border" />

      {/* ━━ SECTION 2 — ITEM ANALYTICS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-20 font-semibold text-ink-1">Item Analytics</h2>
            <p className="text-14 text-ink-3">Per-item financial and usage analytics</p>
          </div>
          <SAExportButton type="items" filters={itemFilters as Record<string, unknown>} />
        </div>

        {/* Filters — month range, category, sort (session year is shared above) */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="month"
            value={monthFrom}
            onChange={(e) => setMonthFrom(e.target.value)}
            className={controlCls}
            aria-label="From month"
          />
          <span className="text-13 text-ink-3">to</span>
          <input
            type="month"
            value={monthTo}
            onChange={(e) => setMonthTo(e.target.value)}
            className={controlCls}
            aria-label="To month"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category…"
            className={controlCls + ' w-36'}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={controlCls}
          >
            <option value="amount">Sort: Amount</option>
            <option value="qty">Sort: Qty</option>
            <option value="requests">Sort: Requests</option>
          </select>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as Order)}
            className={controlCls}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        {/* Summary strip */}
        {analyticsSummary && (
          <div className="flex flex-wrap gap-6 px-4 py-3 bg-sunken rounded-lg">
            <SummaryStat label="Catalog Value"  value={formatINR(analyticsSummary.totalCatalogValue)} />
            <SummaryStat label="Total Spent"    value={formatINR(analyticsSummary.totalSpent)} />
            <SummaryStat label="Qty Fulfilled"  value={String(analyticsSummary.totalQtyFulfilled)} />
            {analyticsSummary.topCategory && (
              <SummaryStat label="Top Category" value={analyticsSummary.topCategory} />
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-border">
          {(['items', 'employees'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-13 font-medium whitespace-nowrap transition-colors duration-150 ${
                tab === t
                  ? 'text-ink-1'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {t === 'items' ? 'By Item' : 'By Employee'}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-accent rounded-t-full" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {/* By Item table */}
        {tab === 'items' && (
          <div className="relative bg-surface rounded-lg border border-border overflow-hidden">
            {isAnalyticsFetching && !isAnalyticsLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent animate-pulse" />
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-14 text-left whitespace-nowrap">
                <thead className="border-b border-border">
                  <tr>
                    {['Item Name', 'Category', 'Stock Left', 'Total Spent', 'Qty Fulfilled', 'Requests', ''].map(h => (
                      <th key={h} className="px-6 py-2.5 text-12 font-semibold text-ink-3 uppercase tracking-[0.04em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isAnalyticsLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  ) : analyticsItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-14 text-ink-3">
                        No items found for this period.
                      </td>
                    </tr>
                  ) : (
                    analyticsItems.map((item) => (
                      <React.Fragment key={item.itemId}>
                        <tr
                          className="hover:bg-sunken transition-colors duration-100 cursor-pointer"
                          onClick={() => setExpandedId(id => id === item.itemId ? null : item.itemId)}
                        >
                          <td className="px-6 py-3 font-medium text-ink-1">{item.itemName}</td>
                          <td className="px-6 py-3 text-ink-2">{item.category ?? '—'}</td>
                          <td className="px-6 py-3 tabular">
                            {item.currentStock != null ? (
                              <span className={item.currentStock < 10 ? 'text-status-negative font-medium' : 'text-ink-1'}>
                                {item.currentStock}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-3 font-medium tabular">{formatINR(item.totalAmountSpent)}</td>
                          <td className="px-6 py-3 tabular">{item.totalQtyFulfilled}</td>
                          <td className="px-6 py-3 tabular">{item.totalRequestCount}</td>
                          <td className="px-6 py-3">
                            {expandedId === item.itemId
                              ? <ChevronDown  size={15} className="text-ink-3" />
                              : <ChevronRight size={15} className="text-ink-3" />
                            }
                          </td>
                        </tr>
                        {expandedId === item.itemId && (
                          <tr key={`${item.itemId}-detail`}>
                            <td colSpan={7} className="p-0">
                              <SAItemEmployeeBreakdown
                                itemId={item.itemId}
                                sessionYear={sessionYear}
                                monthFrom={monthFrom || undefined}
                                monthTo={monthTo   || undefined}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <div className="space-y-5">
            {/* Summary strip */}
            {!isUserStatsLoading && empRows.length > 0 && (
              <div className="flex flex-wrap gap-6 px-4 py-3 bg-sunken rounded-lg">
                <SummaryStat label="Employees"    value={String(empRows.length)} />
                <SummaryStat label="Total Spent"  value={formatINR(empTotalSpent)} />
                <SummaryStat label="Total Units"  value={empTotalUnits.toLocaleString('en-IN')} />
              </div>
            )}

            {/* Top employees bar chart */}
            {!isUserStatsLoading && topEmployees.length > 0 && (
              <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
                <h3 className="text-14 font-semibold text-ink-1 mb-5">Top Employees by Spend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={topEmployees} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                        tick={{ fontSize: 12, fill: 'var(--ink-3)' }} width={120} />
                      <RechartsTooltip
                        cursor={{ fill: 'var(--surface-sunken)' }}
                        contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
                        formatter={(v) => [formatINR(Number(v ?? 0)), 'Amount']}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {topEmployees.map((_: any, i: number) => (
                          <Cell key={`emp-cell-${i}`} fill={ITEM_COLORS[i % ITEM_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Employee table */}
            <div className="relative bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-14 text-left whitespace-nowrap">
                  <thead className="border-b border-border">
                    <tr>
                      {['Employee', 'Department', 'Approved Requests', 'Units Received', 'Total Spent', ''].map((h) => (
                        <th key={h} className="px-6 py-2.5 text-12 font-semibold text-ink-3 uppercase tracking-[0.04em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isUserStatsLoading ? (
                      Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                    ) : empRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-14 text-ink-3">
                          No expenditure data for this session year.
                        </td>
                      </tr>
                    ) : (
                      empRows.map((emp) => (
                        <React.Fragment key={emp.userId}>
                          <tr
                            className="hover:bg-sunken transition-colors duration-100 cursor-pointer"
                            onClick={() => setExpandedEmpId((id) => id === emp.userId ? null : emp.userId)}
                          >
                            <td className="px-6 py-3 font-medium text-ink-1">{emp.userName}</td>
                            <td className="px-6 py-3 text-ink-2">{emp.department ?? '—'}</td>
                            <td className="px-6 py-3 tabular">{emp.approvedRequests}</td>
                            <td className="px-6 py-3 tabular">{emp.totalUnits.toLocaleString('en-IN')}</td>
                            <td className="px-6 py-3 font-semibold tabular text-status-positive">
                              {formatINR(emp.totalAmount)}
                            </td>
                            <td className="px-6 py-3">
                              {expandedEmpId === emp.userId
                                ? <ChevronDown  size={15} className="text-ink-3" />
                                : <ChevronRight size={15} className="text-ink-3" />
                              }
                            </td>
                          </tr>
                          {expandedEmpId === emp.userId && (
                            <tr key={`${emp.userId}-detail`}>
                              <td colSpan={6} className="p-0">
                                <SAEmployeeItemBreakdown
                                  userId={emp.userId}
                                  userName={emp.userName}
                                  sessionYear={sessionYear}
                                  monthFrom={monthFrom || undefined}
                                  monthTo={monthTo   || undefined}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Expandable per-employee item breakdown ────────────────────────────────────
function SAEmployeeItemBreakdown({
  userId, userName, sessionYear, monthFrom, monthTo,
}: {
  userId:      string
  userName:    string
  sessionYear: number
  monthFrom?:  string
  monthTo?:    string
}) {
  const params = new URLSearchParams({ sessionYear: String(sessionYear) })
  if (monthFrom) params.set('monthFrom', monthFrom)
  if (monthTo)   params.set('monthTo',   monthTo)

  const { data, isLoading } = useQuery({
    queryKey: ['sa-emp-approved', userId, sessionYear, monthFrom, monthTo],
    queryFn: () =>
      api.get(`/super-admin/employees/${userId}/approved?${params}`).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  })

  const records: {
    id: string; itemName: string; category: string | null
    unitPrice: number; quantityFulfilled: number; totalAmount: number
    approvedAt: string; inventoryProcessedAt: string | null
    adminName: string | null; imName: string | null
  }[] = data?.data?.records ?? []

  const summary = data?.data?.summary

  return (
    <div className="px-6 py-4 bg-canvas border-t border-border space-y-3">
      <p className="text-12 font-semibold text-ink-3 uppercase tracking-wide">
        Items received by {userName}
      </p>
      {isLoading ? (
        <div className="text-13 text-ink-3">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-13 text-ink-3">No approved allocations for this employee in this period.</div>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-13 text-left whitespace-nowrap">
            <thead className="bg-sunken border-b border-border">
              <tr>
                {['Item', 'Category', 'Units', 'Unit Price', 'Total', 'Date Approved', 'Date Allocated', 'Approved By', 'Alloc. By (IM)'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-ink-3 text-12 uppercase tracking-[0.04em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-ink-1">{r.itemName}</td>
                  <td className="px-4 py-2 text-ink-2">{r.category ?? '—'}</td>
                  <td className="px-4 py-2 tabular">{r.quantityFulfilled}</td>
                  <td className="px-4 py-2 tabular">₹{r.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 font-semibold text-status-positive tabular">
                    ₹{r.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">{format(new Date(r.approvedAt), 'd MMM yyyy')}</td>
                  <td className="px-4 py-2">
                    {r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-2">{r.adminName ?? '—'}</td>
                  <td className="px-4 py-2">{r.imName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t border-border bg-sunken">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-ink-2">
                    Total ({summary.totalRecords} allocations)
                  </td>
                  <td className="px-4 py-2 font-semibold tabular">{summary.totalUnits}</td>
                  <td />
                  <td className="px-4 py-2 font-bold text-status-positive tabular">
                    ₹{summary.totalAmount.toFixed(2)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ── Expandable per-item employee breakdown ────────────────────────────────────
function SAItemEmployeeBreakdown({
  itemId, sessionYear, monthFrom, monthTo,
}: {
  itemId:       string
  sessionYear:  number
  monthFrom?:   string
  monthTo?:     string
}) {
  const params = new URLSearchParams({ sessionYear: String(sessionYear) })
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
    employeeName: string; employeeId: string | null; department: string | null
    designation: string | null; adminName: string | null; imName: string | null
  }[] = data?.data?.records ?? []

  const summary = data?.data?.summary

  return (
    <div className="px-6 py-4 bg-canvas border-t border-border space-y-3">
      <p className="text-12 font-semibold text-ink-3 uppercase tracking-wide">
        Approved allocations only
      </p>
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
                  <td className="px-4 py-2 font-medium text-ink-1">{r.employeeName}</td>
                  <td className="px-4 py-2 text-ink-2">{r.department ?? '—'}</td>
                  <td className="px-4 py-2 tabular">{r.quantityFulfilled}</td>
                  <td className="px-4 py-2 tabular">₹{r.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 font-semibold text-status-positive tabular">
                    ₹{r.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">{format(new Date(r.approvedAt), 'd MMM yyyy')}</td>
                  <td className="px-4 py-2">
                    {r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-2">{r.adminName ?? '—'}</td>
                  <td className="px-4 py-2">{r.imName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t border-border bg-sunken">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-ink-2">
                    Total ({summary.totalRecords} allocations)
                  </td>
                  <td className="px-4 py-2 font-semibold tabular">{summary.totalUnits}</td>
                  <td />
                  <td className="px-4 py-2 font-bold text-status-positive tabular">
                    ₹{summary.totalAmount.toFixed(2)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
