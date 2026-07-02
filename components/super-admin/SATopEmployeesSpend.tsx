'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatINR } from '@/lib/utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useSessionYear } from '@/lib/hooks/use-session-year'

const ITEM_COLORS = ['#16603A', '#14532D', '#15803D', '#22C55E', '#86EFAC', '#4ADE80', '#16A34A', '#1D7A4A']

const controlCls =
  'text-13 border border-border rounded-md px-3 py-1.5 bg-surface text-ink-1 ' +
  'focus:outline-none focus:ring-1 focus:ring-border-focus focus:border-border-focus ' +
  'hover:border-border-strong transition-colors'

interface EmpRow {
  userId: string; userName: string; department: string | null
  approvedRequests: number; totalUnits: number; totalAmount: number
}

export function SATopEmployeesSpend() {
  const [sessionYear, setSessionYear] = useSessionYear()

  const { data, isLoading } = useQuery({
    queryKey: ['sa-top-employees-spend', sessionYear],
    queryFn: () =>
      api.get('/admin/stats/users', { params: { sessionYear, granularity: 'monthly' } }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const empRows: EmpRow[] = data?.data?.byUser ?? []
  const topEmployees = empRows.slice(0, 8).map((e) => ({ name: e.userName, amount: e.totalAmount }))
  const totalSpent = empRows.reduce((s, e) => s + e.totalAmount, 0)
  const totalUnits = empRows.reduce((s, e) => s + e.totalUnits, 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-20 font-semibold text-ink-1">Employee Spend</h2>
          <p className="text-14 text-ink-3">Top spenders across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-13 font-medium text-ink-2">Session Year</label>
          <select value={sessionYear} onChange={(e) => setSessionYear(parseInt(e.target.value))} className={controlCls}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-lg" />
      ) : empRows.length === 0 ? (
        <div className="bg-surface p-6 rounded-lg border border-border text-14 text-ink-3">No expenditure data for this session year.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-6 px-4 py-3 bg-sunken rounded-lg">
            <div className="flex flex-col">
              <span className="text-12 text-ink-3 uppercase tracking-wide">Employees</span>
              <span className="text-14 font-semibold text-ink-1">{empRows.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-12 text-ink-3 uppercase tracking-wide">Total Spent</span>
              <span className="text-14 font-semibold text-ink-1">{formatINR(totalSpent)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-12 text-ink-3 uppercase tracking-wide">Total Units</span>
              <span className="text-14 font-semibold text-ink-1">{totalUnits.toLocaleString('en-IN')}</span>
            </div>
          </div>

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
                    {topEmployees.map((_, i) => (
                      <Cell key={`emp-cell-${i}`} fill={ITEM_COLORS[i % ITEM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
