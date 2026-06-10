'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { useMemo, useState } from 'react'
import { formatINR, abbreviateINR } from '@/lib/utils/format'


export default function SAExpenditurePage() {
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear())
  const [granularity, setGranularity] = useState<'monthly' | 'yearly'>('monthly')

  const { data: expenditureData, isLoading } = useQuery({
    queryKey: ['sa-expenditure', sessionYear, granularity],
    queryFn: async () => {
      const res = await api.get('/admin/stats/expenditure', { params: { sessionYear, granularity } })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: userStats, isLoading: isUserStatsLoading } = useQuery({
    queryKey: ['sa-expenditure-users', sessionYear, granularity],
    queryFn: async () => {
      const res = await api.get('/admin/stats/users', { params: { sessionYear, granularity } })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const series = useMemo(() => {
    const raw = expenditureData?.series
    const arr: { bucket: string; total: number }[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.monthly)
        ? raw.monthly
        : Array.isArray(raw?.yearly)
          ? raw.yearly
          : []
    return arr.map((entry) => {
      const date = new Date(entry.bucket)
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return { month: label, amount: entry.total }
    })
  }, [expenditureData])

  const byCategory = useMemo(() => {
    return (expenditureData?.byCategory ?? []).slice(0, 8).map((c: any) => ({
      name: c.category ?? c.name ?? 'Other',
      amount: c.totalAmount ?? c.amount ?? 0,
    }))
  }, [expenditureData])

  if (isLoading || isUserStatsLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Platform Expenditure</h1>
          <p className="text-sm text-[--ink-secondary]">Organisation-wide spend across all departments and session years</p>
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
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Total Expenditure</div>
          <div className="mt-1 text-2xl font-display font-bold">{formatINR(expenditureData?.totalExpenditure ?? 0)}</div>
          <div className="mt-1 text-xs text-[--ink-secondary]">All approved requests · {sessionYear}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Top User Spend</div>
          <div className="mt-1 text-2xl font-display font-bold">
            {userStats?.byUser?.[0] ? abbreviateINR(userStats.byUser[0].totalAmount ?? 0) : '₹0'}
          </div>
          <div className="mt-1 text-xs text-[--ink-secondary] truncate">
            {userStats?.byUser?.[0]?.userName ?? '—'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-xs text-[--ink-secondary] uppercase tracking-wide">Active Spending Users</div>
          <div className="mt-1 text-2xl font-display font-bold">{userStats?.byUser?.length ?? 0}</div>
          <div className="mt-1 text-xs text-[--ink-secondary]">Users with approved requests</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend over time */}
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
          <h3 className="font-bold text-[--ink-primary] mb-6">Spend Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-secondary)' }}
                  tickFormatter={(v) => abbreviateINR(v)}
                />
                <RechartsTooltip
                  formatter={(value) => [formatINR(Number(value ?? 0)), 'Spend']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="amount" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            {series.length === 0 && (
              <div className="mt-4 text-sm text-[--ink-secondary]">No expenditure data for this session.</div>
            )}
          </div>
        </div>

        {/* Spend by category */}
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
          <h3 className="font-bold text-[--ink-primary] mb-6">Spend by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-secondary)' }}
                  tickFormatter={(v) => abbreviateINR(v)}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-secondary)' }}
                  width={90}
                />
                <RechartsTooltip
                  formatter={(value) => [formatINR(Number(value ?? 0)), 'Spend']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#166534" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {byCategory.length === 0 && (
              <div className="mt-4 text-sm text-[--ink-secondary]">No category data for this session.</div>
            )}
          </div>
        </div>
      </div>

      {/* User-wise breakdown */}
      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-4">User-wise Approved Amounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                <th className="px-4 py-3 font-medium text-[--ink-secondary]">User</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary]">Department</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Approved Requests</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Units</th>
                <th className="px-4 py-3 font-medium text-[--ink-secondary] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {(userStats?.byUser ?? []).map((u: any) => (
                <tr key={u.userId} className="hover:bg-[--bg-canvas] transition-colors">
                  <td className="px-4 py-3 font-medium text-[--ink-primary]">{u.userName}</td>
                  <td className="px-4 py-3 text-[--ink-secondary]">{u.department ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{u.approvedRequests}</td>
                  <td className="px-4 py-3 text-right">{u.totalUnits}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(u.totalAmount)}</td>
                </tr>
              ))}
              {(userStats?.byUser ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[--ink-secondary]">No approved expenditure data for this session.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
