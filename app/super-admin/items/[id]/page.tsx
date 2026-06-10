'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#166534', '#14532D', '#15803D', '#22C55E', '#86EFAC']

export default function SuperAdminItemDetailsPage() {
  const params = useParams()
  const itemId = params.id as string

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-item-stats', itemId],
    queryFn: async () => {
      // Mocked endpoint wrapper
      const res = await api.get(`/super-admin/stats/items/${itemId}`).catch(() => ({ 
        data: { 
          data: {
            item: { name: 'A4 Paper', unit: 'reams', category: 'Stationery' },
            crossSessionStats: [
              { year: '2023', totalRequested: 300, totalApproved: 280 },
              { year: '2024', totalRequested: 450, totalApproved: 410 },
              { year: '2025', totalRequested: 600, totalApproved: 580 },
              { year: '2026', totalRequested: 520, totalApproved: 480 },
            ],
            topDepartments: [
              { name: 'Computer Science', qty: 450 },
              { name: 'Electrical Eng.', qty: 300 },
              { name: 'Administration', qty: 200 },
            ]
          } 
        } 
      }))
      return res.data.data
    }
  })

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  const { item, crossSessionStats, topDepartments } = data || {}

  return (
    <div className="space-y-6 page-enter">
      <Link href="/super-admin/overview" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        Back to Overview
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">{item?.name}</h1>
        <p className="text-sm text-[--ink-secondary]">Cross-session analytics for this item</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-6">Year-over-Year Demand</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crossSessionStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <RechartsTooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
              <Bar dataKey="totalRequested" name="Total Requested" fill="var(--ink-disabled)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalApproved" name="Total Approved" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm">
        <h3 className="font-bold text-[--ink-primary] mb-6">Usage by Department</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDepartments} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-secondary)' }} />
              <RechartsTooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '12px' }} />
              <Bar dataKey="qty" name="Quantity" radius={[0, 4, 4, 0]}>
                {topDepartments?.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
