'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const { data: profileData, isLoading: isLoadingProfile, isError: isProfileError, isFetching: isProfileFetching, refetch: refetchProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await api.get('/user/profile')
      return res.data.data
    }
  })

  const { data: requestsData, isLoading: isLoadingRequests, isError: isRequestsError, isFetching: isRequestsFetching, refetch: refetchRequests } = useQuery({
    queryKey: ['user-requests', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/user/requests?limit=5')
      return res.data.data
    }
  })

  if (isLoadingProfile || isLoadingRequests) {
    return (
      <div className="space-y-8">
        <div className="skeleton h-24 rounded-lg w-full" />
        <div className="skeleton h-64 rounded-lg w-full" />
      </div>
    )
  }

  const stats = profileData?.stats || {
    totalRequests: 0,
    approvedRequests: 0,
    pendingRequests: 0,
    rejectedRequests: 0,
  }

  const recentRequests = requestsData || []

  return (
    <div className="space-y-8 page-enter">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-display font-bold">Welcome back, {profileData?.user?.name?.split(' ')[0] || 'User'}</h1>
        <Link 
          href="/inventory"
          className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md font-medium hover:bg-[--accent-hover] transition-colors"
        >
          <PlusCircle size={18} />
          New Request
        </Link>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={stats.totalRequests} />
        <StatCard title="Approved" value={stats.approvedRequests} color="text-green-700" />
        <StatCard title="Pending" value={stats.pendingRequests} color="text-blue-700" />
        <StatCard title="Rejected" value={stats.rejectedRequests} color="text-red-700" />
      </div>

      {(isProfileError || isRequestsError) && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Some dashboard data couldn&apos;t be loaded.</span>
          <button
            onClick={() => { if (isProfileError) refetchProfile(); if (isRequestsError) refetchRequests() }}
            disabled={isProfileFetching || isRequestsFetching}
            className="text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProfileFetching || isRequestsFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* RECENT REQUESTS */}
      <div className="bg-white rounded-lg border border-[--border-default] p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Recent Requests</h2>
        
        {recentRequests.length === 0 ? (
          <div className="text-center py-8 text-[--ink-tertiary]">
            <p>You haven't made any requests yet.</p>
            <Link href="/inventory" className="text-black hover:underline mt-2 inline-block">
              Browse inventory
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentRequests.map((req: any) => (
              <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between border-l-4 border-black pl-4 py-2 bg-[--bg-canvas] rounded-r-md">
                <div>
                  <p className="font-medium text-[--ink-primary]">
                    {req.items?.length > 0 ? req.items[0].item.name : 'Unknown Item'} 
                    {req.items?.length > 1 && ` +${req.items.length - 1} more`}
                  </p>
                  <p className="text-xs text-[--ink-tertiary] mt-1">{formatDate(req.createdAt)}</p>
                </div>
                <div className="mt-2 md:mt-0 flex items-center space-x-4">
                  <StatusBadge status={req.status} />
                  <Link 
                    href={`/requests/${req.id}`}
                    className="text-sm text-black font-medium hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, color = "text-[--ink-primary]" }: { title: string, value: number, color?: string }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-[--border-default] shadow-sm flex flex-col items-center justify-center text-center">
      <span className="text-[--ink-secondary] text-sm font-medium mb-2">{title}</span>
      <span className={`font-display text-4xl ${color}`}>{value}</span>
    </div>
  )
}
