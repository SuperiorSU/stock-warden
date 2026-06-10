'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import { useState, useEffect } from 'react'
import { formatINR } from '@/lib/utils/format'

export default function SuperAdminOverviewPage() {
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear())
  const [animatedApprovalRate, setAnimatedApprovalRate] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-overview', sessionYear],
    queryFn: async () => {
      // Mocked endpoint wrapper
      const res = await api.get('/super-admin/stats/overview', { params: { sessionYear, granularity: 'monthly' } }).catch(() => ({ 
        data: { 
          data: {
            totalRequests: 1420,
            approvalRate: 0.78,
            avgProcessingTimeHours: 6.4,
            series: {
              monthly: [
                { month: 'Jan', requests: 120, previousYear: 100 },
                { month: 'Feb', requests: 150, previousYear: 110 },
                { month: 'Mar', requests: 180, previousYear: 140 },
                { month: 'Apr', requests: 140, previousYear: 130 },
              ]
            },
            adminPerformance: [
              { name: 'Alice Smith', processed: 340, avgTime: '4.2h', approvalRate: '82%' },
              { name: 'Bob Jones', processed: 280, avgTime: '5.8h', approvalRate: '75%' },
              { name: 'Charlie Davis', processed: 150, avgTime: '8.4h', approvalRate: '68%' },
            ]
          } 
        } 
      }))
      return res.data.data
    }
  })

  const { data: expenditureData, isLoading: expenditureLoading } = useQuery({
    queryKey: ['super-admin-expenditure', sessionYear],
    queryFn: async () => {
      const res = await api.get('/admin/stats/expenditure', { params: { sessionYear, granularity: 'monthly' } })
      return res.data.data
    }
  })

  const { data: usersAmountData, isLoading: usersAmountLoading } = useQuery({
    queryKey: ['super-admin-users-amount', sessionYear],
    queryFn: async () => {
      const res = await api.get('/admin/stats/users', { params: { sessionYear, granularity: 'monthly' } })
      return res.data.data
    }
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
  }, [data?.approvalRate])

  if (isLoading || expenditureLoading || usersAmountLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Platform Overview</h1>
          <p className="text-sm text-[--ink-secondary]">Global metrics and admin performance</p>
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-[--ink-secondary] text-sm font-medium mb-2">Total Requests</span>
          <span className="font-display text-4xl text-[--ink-primary]">{data?.totalRequests}</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-[--ink-secondary] text-sm font-medium mb-2">Platform Approval Rate</span>
          <span className="font-display text-4xl text-green-700">{Math.round(animatedApprovalRate)}%</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-[--ink-secondary] text-sm font-medium mb-2">Avg Processing Time</span>
          <span className="font-display text-2xl text-[--ink-primary]">{data?.avgProcessingTimeHours}h</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-sm text-[--ink-secondary]">Overall Expenditure</div>
          <div className="text-3xl font-display font-bold mt-1">{formatINR(expenditureData?.totalExpenditure ?? 0)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
          <div className="text-sm text-[--ink-secondary]">Active Spending Users</div>
          <div className="text-3xl font-display font-bold mt-1">{usersAmountData?.byUser?.length ?? 0}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm min-w-0">
        <h3 className="font-bold text-[--ink-primary] mb-6">Cross-Session Request Volume</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288} minWidth={0}>
            <LineChart data={data?.series?.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
              <Line type="monotone" name="Current Year" dataKey="requests" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Previous Year" dataKey="previousYear" stroke="var(--ink-disabled)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
              {data?.adminPerformance?.map((admin: any, idx: number) => (
                <tr key={idx} className="hover:bg-[--bg-canvas] transition-colors">
                  <td className="px-6 py-4 font-medium text-[--ink-primary]">{admin.name}</td>
                  <td className="px-6 py-4 text-[--ink-primary] text-right font-medium">{admin.processed}</td>
                  <td className="px-6 py-4 text-[--ink-secondary] text-right">{admin.avgTime}</td>
                  <td className="px-6 py-4 text-[--ink-secondary] text-right">{admin.approvalRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-4">User-wise Approved Amounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                <th className="px-6 py-4 font-medium text-[--ink-secondary]">User</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary]">Department</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Requests</th>
                <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {(usersAmountData?.byUser ?? []).map((u: any) => (
                <tr key={u.userId}>
                  <td className="px-6 py-4 font-medium text-[--ink-primary]">{u.userName}</td>
                  <td className="px-6 py-4 text-[--ink-secondary]">{u.department ?? '-'}</td>
                  <td className="px-6 py-4 text-right">{u.approvedRequests}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatINR(u.totalAmount)}</td>
                </tr>
              ))}
              {(usersAmountData?.byUser ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[--ink-secondary]">No approved expenditure data for this session.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
