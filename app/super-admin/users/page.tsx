'use client'

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Loader2 } from 'lucide-react'

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  isActive: boolean
  isApproved: boolean
  requestCount: number
  createdAt: string
}

const PAGE_SIZE = 50

export default function SuperAdminUsersPage() {
  const usersQuery = useInfiniteQuery({
    queryKey: ['super-admin-users'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/super-admin/users', { params: { cursor: pageParam, limit: PAGE_SIZE } })
      return res.data as { data: UserRecord[]; meta?: { nextCursor?: string | null } }
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  })

  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [usersQuery.data]
  )

  if (usersQuery.isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-[--ink-primary]">User Management</h1>
          <p className="text-sm text-[--ink-secondary]">View all registered users and administrators across the platform.</p>
        </div>
      </div>

      {usersQuery.isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load users.</span>
          <button onClick={() => usersQuery.refetch()} className="text-sm font-medium underline">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[--border-default] overflow-hidden shadow-sm">
        {users.length === 0 ? (
          <div className="p-12 text-center text-[--ink-secondary]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default] text-[--ink-secondary]">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Requests</th>
                  <th className="px-6 py-4 font-medium text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-[--ink-primary]">{user.name}</span>
                        <span className="text-xs text-[--ink-secondary]">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary]">{user.department || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        !user.isApproved ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        !user.isActive ? 'bg-red-100 text-red-800 border-red-200' :
                        'bg-green-100 text-green-800 border-green-200'
                      }`}>
                        {!user.isApproved ? 'Pending' : !user.isActive ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[--ink-primary] font-medium text-right">
                      {user.requestCount}
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary] text-right">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {users.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--ink-secondary]">
          <span>Showing {users.length} users</span>
          {usersQuery.hasNextPage && (
            <button
              onClick={() => usersQuery.fetchNextPage()}
              disabled={usersQuery.isFetchingNextPage}
              className="px-4 py-2 border border-[--border-default] hover:bg-black hover:text-white transition duration-75 rounded-md font-medium disabled:opacity-50"
            >
              {usersQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
