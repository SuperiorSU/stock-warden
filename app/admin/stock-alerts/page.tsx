'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Bell, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function StockAlertsPage() {
  const queryClient = useQueryClient()
  const [selectedAlert, setSelectedAlert] = useState<{ id: string; itemName?: string | null } | null>(null)

  const alertsQuery = useInfiniteQuery({
    queryKey: ['admin-stock-alerts'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/stock-alerts', { params: { isRead: false, cursor: pageParam, limit: 20 } })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  })

  const alerts = alertsQuery.data?.pages.flatMap((page) => page.data) ?? []
  const totalAlerts = alertsQuery.data?.pages[0]?.meta?.total ?? 0

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/stock-alerts/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stock-alerts'] })
      toast.success('Alert marked as resolved')
      setSelectedAlert(null)
    },
    onError: () => toast.error('Failed to resolve alert')
  })

  const handleResolveConfirm = () => {
    if (!selectedAlert) return
    resolveMutation.mutate(selectedAlert.id)
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-display font-bold">Stock Alerts</h1>
        <p className="text-sm text-[--ink-secondary]">User notifications about out-of-stock items</p>
      </div>

      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        {alertsQuery.isLoading ? (
          <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="mx-auto text-[--ink-disabled] mb-4" size={48} />
            <h3 className="text-lg font-medium text-[--ink-primary]">No pending alerts</h3>
            <p className="text-[--ink-secondary] text-sm">All stock issues have been resolved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Item</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Alert By</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Message</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Date</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {alerts.map((alert: any) => (
                  <tr key={alert.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4 font-medium text-[--ink-primary]">
                      {alert.item?.name}
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary]">
                      {alert.user?.name}
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary] max-w-xs truncate">
                      {alert.message || '-'}
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary]">
                      {formatDate(alert.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedAlert({ id: alert.id, itemName: alert.item?.name })}
                        disabled={resolveMutation.isPending}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={14} />
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 sm:space-x-3 text-sm text-[--ink-secondary]">
          <div>
            Showing {alerts.length} of {totalAlerts} alerts
          </div>
          {alertsQuery.hasNextPage && (
            <button
              onClick={() => alertsQuery.fetchNextPage()}
              disabled={alertsQuery.isFetchingNextPage}
              className="px-4 py-2 border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle] disabled:opacity-50"
            >
              {alertsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={selectedAlert !== null}
        title="Resolve Stock Alert"
        description={`Mark the alert${selectedAlert?.itemName ? ` for "${selectedAlert.itemName}"` : ''} as resolved?`}
        confirmText="Resolve"
        isLoading={resolveMutation.isPending}
        onConfirm={handleResolveConfirm}
        onCancel={() => setSelectedAlert(null)}
      />
    </div>
  )
}
