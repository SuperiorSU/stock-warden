'use client'

import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { useMemo, useState } from 'react'

const STATUS_LABELS = ['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING', 'REQUESTED'] as const
const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#166534',
  REJECTED: '#B91C1C',
  CANCELLED: '#71717A',
  PENDING: '#1D4ED8',
  REQUESTED: '#B45309',
}
const ITEM_COLORS = ['#166534', '#14532D', '#15803D', '#22C55E', '#86EFAC', '#4ADE80', '#16A34A', '#166534']

export default function SAConsumptionPage() {
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear())
  const [granularity, setGranularity] = useState<'monthly' | 'yearly'>('monthly')

  const { data: itemsStats, isLoading: isItemsLoading } = useQuery({
    queryKey: ['sa-consumption-items', sessionYear],
    queryFn: async () => {
      const res = await api.get('/admin/stats/items', { params: { sessionYear } })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: requestStats, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['sa-consumption-requests', sessionYear, granularity],
    queryFn: async () => {
      const res = await api.get('/admin/stats/requests', { params: { sessionYear, granularity } })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const statusQueries = useQueries({
    queries: STATUS_LABELS.map((status) => ({
      queryKey: ['sa-status-count', sessionYear, status],
      queryFn: async () => {
        const res = await api.get('/admin/requests', { params: { sessionYear, status, limit: 1 } })
        return res.data.meta?.total ?? 0
      },
      staleTime: 5 * 60 * 1000,
    })),
  })

  const requestSeries = useMemo(() => {
    const series = requestStats?.series ?? []
    return series.map((entry: { bucket: string; total: number }) => {
      const date = new Date(entry.bucket)
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return { month: label, requests: entry.total }
    })
  }, [requestStats])

  const topItems = useMemo(() => {
    const items = itemsStats?.items ?? []
    return [...items]
      .sort((a: { totalRequested: number }, b: { totalRequested: number }) => b.totalRequested - a.totalRequested)
      .slice(0, 8)
      .map((item: { name: string; totalRequested: number }) => ({
        name: item.name,
        qty: item.totalRequested,
      }))
  }, [itemsStats])

  const statusDistribution = useMemo(() => {
    return STATUS_LABELS.map((status, index) => ({
      name: status,
      value: statusQueries[index]?.data ?? 0,
    }))
  }, [statusQueries])

  const totalRequests = statusDistribution.reduce((s, d) => s + d.value, 0)

  const isLoading =
    isItemsLoading ||
    isRequestsLoading ||
    statusQueries.some((q) => q.isLoading)

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Platform Consumption</h1>
          <p className="text-sm text-[--ink-secondary]">Item usage and fulfillment trends across all departments</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-[--ink-secondary]">Session Year:</label>
          <select
            value={sessionYear}
            onChange={(e) => setSessionYear(parseInt(e.target.value))}
            className="text-sm border border-[--border-default] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black"
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'monthly' | 'yearly')}
            className="text-sm border border-[--border-default] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Total Requests</div>
          <div className="mt-1 text-2xl font-display font-bold">{totalRequests.toLocaleString('en-IN')}</div>
          <div className="mt-1 text-xs text-[--ink-secondary]">All statuses · {sessionYear}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Approved</div>
          <div className="mt-1 text-2xl font-display font-bold text-green-700">
            {(statusDistribution.find(s => s.name === 'APPROVED')?.value ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-[--ink-secondary]">
            {totalRequests > 0
              ? `${Math.round(((statusDistribution.find(s => s.name === 'APPROVED')?.value ?? 0) / totalRequests) * 100)}% approval rate`
              : 'No data'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Unique Items Tracked</div>
          <div className="mt-1 text-2xl font-display font-bold">{itemsStats?.items?.length ?? 0}</div>
          <div className="mt-1 text-xs text-[--ink-secondary]">Items with request data</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request volume over time */}
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
          <h3 className="font-bold text-[--ink-primary] mb-6">Request Volume Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <LineChart data={requestSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
                <Line type="monotone" dataKey="requests" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            {requestSeries.length === 0 && (
              <div className="mt-4 text-sm text-[--ink-secondary]">No request data for this session.</div>
            )}
          </div>
        </div>

        {/* Status distribution donut */}
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
          <h3 className="font-bold text-[--ink-primary] mb-6">Request Status Distribution</h3>
          <div className="h-48 flex justify-center">
            <ResponsiveContainer width="100%" height={192} minWidth={0}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
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
              <div key={entry.name} className="flex items-center space-x-1.5 text-xs text-[--ink-secondary]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.name] }} />
                <span>{entry.name}</span>
                <span className="text-[--ink-disabled]">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top requested items */}
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm lg:col-span-2 min-w-0">
          <h3 className="font-bold text-[--ink-primary] mb-6">Top Requested Items (Platform-wide)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
              <BarChart data={topItems} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <RechartsTooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {topItems.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={ITEM_COLORS[index % ITEM_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {topItems.length === 0 && (
              <div className="mt-4 text-sm text-[--ink-secondary]">No item request data for this session.</div>
            )}
          </div>
        </div>
      </div>

      {/* Per-item fulfillment table */}
      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-4">Item Fulfillment Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                <th className="px-4 py-3 font-medium text-[--ink-secondary]">Item</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Requested</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Fulfilled</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Rejected</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Remaining Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {(itemsStats?.items ?? []).map((item: any) => (
                <tr key={item.itemId} className="hover:bg-[--bg-canvas] transition-colors">
                  <td className="px-4 py-3 font-medium text-[--ink-primary]">{item.name}</td>
                  <td className="px-4 py-3 text-right">{item.totalRequested ?? 0}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{item.totalFulfilled ?? 0}</td>
                  <td className="px-4 py-3 text-right text-red-600">{item.totalRejected ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={item.remainingStock === 0 ? 'text-red-600 font-medium' : ''}>
                      {item.remainingStock ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
              {(itemsStats?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[--ink-secondary]">No item data for this session.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
