'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatINR } from '@/lib/utils/format'
import { useSessionYear } from '@/lib/hooks/use-session-year'

const controlCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black'

function SkeletonCard() {
  return <div className="skeleton h-24 rounded-lg" />
}

export default function SuperAdminOverviewPage() {
  const [sessionYear, setSessionYear] = useSessionYear()
  const [monthFrom, setMonthFrom] = useState('')
  const [monthTo, setMonthTo] = useState('')
  const [animatedApprovalRate, setAnimatedApprovalRate] = useState(0)

  const filters = { sessionYear, granularity: 'monthly', monthFrom: monthFrom || undefined, monthTo: monthTo || undefined }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin-overview', filters],
    queryFn: async () => {
      const res = await api.get('/super-admin/stats/overview', { params: filters })
      return res.data.data
    },
  })

  const { data: expenditureData, isLoading: expenditureLoading } = useQuery({
    queryKey: ['super-admin-expenditure-summary', sessionYear],
    queryFn: async () => {
      const res = await api.get('/admin/stats/expenditure', { params: { sessionYear, granularity: 'monthly' } })
      return res.data.data
    },
  })

  const { data: usersAmountData, isLoading: usersAmountLoading } = useQuery({
    queryKey: ['super-admin-users-amount-summary', sessionYear],
    queryFn: async () => {
      const res = await api.get('/admin/stats/users', { params: { sessionYear, granularity: 'monthly' } })
      return res.data.data
    },
  })

  useEffect(() => {
    if (data?.approvalRate) {
      let start = 0
      const end = data.approvalRate * 100
      const duration = 1000
      const step = end / (duration / 16)
      const timer = setInterval(() => {
        start += step
        if (start >= end) {
          clearInterval(timer)
          setAnimatedApprovalRate(end)
        } else {
          setAnimatedApprovalRate(start)
        }
      }, 16)
      return () => clearInterval(timer)
    }
    setAnimatedApprovalRate(0)
  }, [data?.approvalRate])

  const chartData = useMemo(() => {
    const previousByMonth = new Map<number, number>()
    ;(data?.previousYearSeries ?? []).forEach((row: { bucket: string; total: number }, i: number) => {
      previousByMonth.set(i, row.total)
    })
    return (data?.series ?? []).map((row: { bucket: string; total: number }, i: number) => ({
      month: new Date(row.bucket).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      requests: row.total,
      previousYear: previousByMonth.get(i) ?? null,
    }))
  }, [data])

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Platform Overview</h1>
          <p className="text-sm text-[--ink-secondary]">Global metrics and admin performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-[--ink-secondary]">Session Year:</label>
          <select
            value={sessionYear}
            onChange={(e) => setSessionYear(parseInt(e.target.value))}
            className={controlCls}
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className={controlCls} aria-label="From month" />
          <span className="text-sm text-[--ink-secondary]">to</span>
          <input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className={controlCls} aria-label="To month" />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load platform metrics. The numbers below may be stale or missing.</span>
          <button onClick={() => refetch()} className="text-sm font-medium underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[--ink-secondary] text-sm font-medium mb-2">Total Requests</span>
              <span className="font-display text-4xl text-[--ink-primary]">{data?.totalRequests ?? 0}</span>
            </div>
            <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[--ink-secondary] text-sm font-medium mb-2">Platform Approval Rate</span>
              <span className="font-display text-4xl text-green-700">{Math.round(animatedApprovalRate)}%</span>
            </div>
            <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[--ink-secondary] text-sm font-medium mb-2">Avg Processing Time</span>
              <span className="font-display text-2xl text-[--ink-primary]">{(data?.avgProcessingTimeHours ?? 0).toFixed(1)}h</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {expenditureLoading ? <SkeletonCard /> : (
          <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
            <div className="text-sm text-[--ink-secondary]">Overall Expenditure</div>
            <div className="text-3xl font-display font-bold mt-1">{formatINR(expenditureData?.totalExpenditure ?? 0)}</div>
            <Link href="/super-admin/analytics/expenditure" className="text-xs font-medium text-[--accent-primary] hover:underline mt-2 inline-block">
              View full expenditure breakdown &rarr;
            </Link>
          </div>
        )}
        {usersAmountLoading ? <SkeletonCard /> : (
          <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
            <div className="text-sm text-[--ink-secondary]">Active Spending Users</div>
            <div className="text-3xl font-display font-bold mt-1">{usersAmountData?.byUser?.length ?? 0}</div>
            <Link href="/super-admin/employees" className="text-xs font-medium text-[--accent-primary] hover:underline mt-2 inline-block">
              View employee requests &rarr;
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
        <h3 className="font-bold text-[--ink-primary] mb-6">Cross-Session Request Volume</h3>
        {isLoading ? (
          <div className="skeleton h-72 rounded" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" name="Current Year" dataKey="requests" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Previous Year" dataKey="previousYear" stroke="var(--ink-disabled)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            {chartData.length === 0 && (
              <p className="mt-4 text-sm text-[--ink-secondary]">No request data for this period.</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-6">Admin Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                <th className="px-6 py-4 font-medium text-[--ink-secondary]">Admin Name</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Requests Processed</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Avg Time</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Approval Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-6 py-4"><div className="skeleton h-4 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : (data?.adminPerformance ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[--ink-secondary]">No admin activity for this period.</td>
                </tr>
              ) : (
                data.adminPerformance.map((admin: { name: string; processed: number; avgTime: string; approvalRate: string }, idx: number) => (
                  <tr key={idx} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4 font-medium text-[--ink-primary]">{admin.name}</td>
                    <td className="px-6 py-4 text-[--ink-primary] text-right font-medium">{admin.processed}</td>
                    <td className="px-6 py-4 text-[--ink-secondary] text-right">{admin.avgTime}</td>
                    <td className="px-6 py-4 text-[--ink-secondary] text-right">{admin.approvalRate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
