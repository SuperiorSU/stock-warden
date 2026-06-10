'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { TableWrapper } from '@/components/ui/TableWrapper'
import { Filter } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function RequestsPage() {
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['user-requests-all', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      const res = await api.get('/user/requests', { params })
      return res.data.data
    }
  })

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">My Requests</h1>
          <p className="text-[--ink-secondary] text-sm">View and track your inventory requests</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[--ink-secondary] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-[--border-default] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[--border-default] overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : !data?.length ? (
          <div className="text-center py-16">
            <p className="text-[--ink-tertiary] mb-2">
              {statusFilter === 'ALL' ? "You haven't made any requests yet." : `No ${statusFilter.toLowerCase()} requests found.`}
            </p>
            {statusFilter === 'ALL' && (
              <Link href="/inventory" className="text-black font-medium hover:underline">
                Browse inventory
              </Link>
            )}
          </div>
        ) : (
          <TableWrapper stackOnMobile>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden sm:table-cell no-wrap-cap">ID</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] no-wrap-cap">Items</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden sm:table-cell no-wrap-cap">Date</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] no-wrap-cap">Status</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right no-wrap-cap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {data.map((req: any) => (
                  <tr key={req.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td data-label="ID" className="px-6 py-4 font-mono text-xs text-[--ink-secondary] hidden sm:table-cell">
                      {req.id.split('-')[0]}…
                    </td>
                    <td data-label="Items" className="px-6 py-4 font-medium text-[--ink-primary]">
                      {req.items?.length > 0 ? req.items[0].item.name : 'Unknown Item'}
                      {req.items?.length > 1 && (
                        <span className="text-[--ink-secondary] font-normal ml-1">+{req.items.length - 1} more</span>
                      )}
                    </td>
                    <td data-label="Date" className="px-6 py-4 text-[--ink-secondary] hidden sm:table-cell">
                      {formatDate(req.createdAt)}
                    </td>
                    <td data-label="Status" className="px-6 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td data-label="Action" data-full className="px-6 py-4 text-right">
                      <Link
                        href={`/requests/${req.id}`}
                        className="text-black font-medium hover:underline text-sm"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </div>
    </div>
  )
}
