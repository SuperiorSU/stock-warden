'use client'

import { useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { formatINR } from '@/lib/utils/format'
import { Filter, X, CheckCircle2, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TableWrapper } from '@/components/ui/TableWrapper'

type InventoryRequestLine = {
  id: string
  quantityReq: number
  quantityAllocated?: number | null
  quantityFul?: number | null
  item: {
    name: string
    unitPrice?: string | number | null
    availableQty?: number | null
    unit?: string | null
  }
}

type InventoryRequest = {
  id: string
  status: 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  createdAt: string | Date
  adminNotes?: string | null
  inventoryManagerNotes?: string | null
  invoiceNumber?: string | null
  user: {
    name: string
    department?: string | null
    employeeId?: string | null
    email?: string | null
  }
  items: InventoryRequestLine[]
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending (Admin Approved)' },
  { value: 'APPROVED', label: 'Confirmed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function InventoryManagerRequestsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null)
  const [managerNotes, setManagerNotes] = useState('')
  const [pendingAction, setPendingAction] = useState<'confirm' | 'cancel' | null>(null)

  const requestsQuery = useInfiniteQuery({
    queryKey: ['im-all-requests', statusFilter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '50' }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (pageParam) params.cursor = pageParam
      const res = await api.get('/inventory-manager/requests', { params })
      return res.data as { data: InventoryRequest[]; meta?: { nextCursor?: string | null } }
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  })

  const data = useMemo(
    () => requestsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [requestsQuery.data]
  )
  const isLoading = requestsQuery.isLoading
  const isError = requestsQuery.isError

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedRequest?.id) throw new Error('No request selected')
      return api.patch(`/inventory-manager/requests/${selectedRequest.id}/confirm`, { notes: managerNotes })
    },
    onSuccess: () => {
      toast.success('Request confirmed. Inventory updated and requester notified.')
      queryClient.invalidateQueries({ queryKey: ['im-all-requests'] })
      queryClient.invalidateQueries({ queryKey: ['im-pending-requests'] })
      setSelectedRequest(null)
      setPendingAction(null)
      setManagerNotes('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not confirm this request. Please check stock levels and try again.'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!selectedRequest?.id) throw new Error('No request selected')
      return api.patch(`/inventory-manager/requests/${selectedRequest.id}/cancel`, { notes: managerNotes })
    },
    onSuccess: () => {
      toast.success('Request cancelled. No inventory changes were made.')
      queryClient.invalidateQueries({ queryKey: ['im-all-requests'] })
      queryClient.invalidateQueries({ queryKey: ['im-pending-requests'] })
      setSelectedRequest(null)
      setPendingAction(null)
      setManagerNotes('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not cancel this request. Please try again.'),
  })

  const isMutating = confirmMutation.isPending || cancelMutation.isPending

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Requests</h1>
          <p className="text-sm text-[--ink-secondary]">Review and act on admin-approved requests</p>
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

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load requests.</span>
          <button onClick={() => requestsQuery.refetch()} className="text-sm font-medium underline">Retry</button>
        </div>
      )}

      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : !data?.length ? (
          <div className="p-8 text-center text-[--ink-secondary] text-sm">
            No requests found for the selected status.
          </div>
        ) : (
          <TableWrapper stackOnMobile>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Requester</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden md:table-cell">Department</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Items</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right hidden sm:table-cell">Value</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden sm:table-cell">Date</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Status</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {data.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-[--bg-subtle] transition-colors cursor-pointer"
                    onClick={() => { setSelectedRequest(req); setManagerNotes('') }}
                  >
                    <td data-label="Requester" className="px-6 py-4 font-medium text-[--ink-primary]">
                      {req.user?.name ?? 'Unknown'}
                    </td>
                    <td data-label="Department" className="px-6 py-4 text-[--ink-secondary] hidden md:table-cell">
                      {req.user?.department ?? '-'}
                    </td>
                    <td data-label="Items" className="px-6 py-4 text-[--ink-primary]">
                      {req.items?.length ?? 0} item(s)
                    </td>
                    <td data-label="Value" className="px-6 py-4 text-right font-medium text-[--ink-primary] hidden sm:table-cell">
                      {formatINR((req.items ?? []).reduce((sum, ri) => {
                        const qty = ri.quantityAllocated ?? ri.quantityReq ?? 0
                        const price = ri.item?.unitPrice ? Number(ri.item.unitPrice) : 0
                        return sum + qty * price
                      }, 0))}
                    </td>
                    <td data-label="Date" className="px-6 py-4 text-[--ink-secondary] hidden sm:table-cell">
                      {formatDate(req.createdAt)}
                    </td>
                    <td data-label="Status" className="px-6 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td data-label="Action" data-full className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedRequest(req); setManagerNotes('') }}
                        className="text-sm font-medium text-[--ink-primary] hover:underline"
                      >
                        {req.status === 'PENDING' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </div>

      {requestsQuery.hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => requestsQuery.fetchNextPage()}
            disabled={requestsQuery.isFetchingNextPage}
            className="px-4 py-2 border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle] disabled:opacity-50"
          >
            {requestsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {/* Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRequest(null)} />
          <div
            className="relative w-full sm:max-w-lg lg:max-w-2xl bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-[--border-default] flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold">
                  {selectedRequest.status === 'PENDING' ? 'Review Request' : 'Request Details'}
                </h2>
                <p className="text-xs font-mono text-[--ink-secondary] mt-1 break-all">{selectedRequest.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-2 text-[--ink-secondary] hover:text-[--ink-primary] hover:bg-[--bg-subtle] rounded-md transition-colors shrink-0"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 flex-1">
              {/* Requester info */}
              <div className="bg-[--bg-subtle] rounded-md p-4 text-sm space-y-2">
                <p><span className="text-[--ink-secondary] inline-block w-28">Name</span><span className="font-medium">{selectedRequest.user?.name}</span></p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Department</span>{selectedRequest.user?.department ?? '-'}</p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Employee ID</span>{selectedRequest.user?.employeeId ?? '-'}</p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Date</span>{formatDate(selectedRequest.createdAt)}</p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Status</span><StatusBadge status={selectedRequest.status} /></p>
              </div>

              {/* Items */}
              <div>
                <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requested Items</h3>
                <div className="border border-[--border-default] rounded-md overflow-x-auto">
                  <table className="w-full text-sm min-w-72">
                    <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                      <tr>
                        <th className="px-4 py-2 font-medium text-left">Item</th>
                        <th className="px-4 py-2 font-medium text-right">Req.</th>
                        <th className="px-4 py-2 font-medium text-right">Allocated</th>
                        {selectedRequest.status === 'APPROVED' && (
                          <th className="px-4 py-2 font-medium text-right text-green-700">Fulfilled</th>
                        )}
                        {selectedRequest.status === 'PENDING' && (
                          <th className="px-4 py-2 font-medium text-right">Available</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border-default]">
                      {selectedRequest.items?.map((ri) => {
                        const allocated = ri.quantityAllocated ?? ri.quantityReq
                        const available = ri.item?.availableQty ?? 0
                        const isShort = selectedRequest.status === 'PENDING' && allocated > available
                        return (
                          <tr key={ri.id}>
                            <td className="px-4 py-3">{ri.item?.name}</td>
                            <td className="px-4 py-3 text-right">{ri.quantityReq}</td>
                            <td className="px-4 py-3 text-right font-medium">{allocated}</td>
                            {selectedRequest.status === 'APPROVED' && (
                              <td className="px-4 py-3 text-right font-medium text-green-700">
                                {ri.quantityFul ?? allocated}
                              </td>
                            )}
                            {selectedRequest.status === 'PENDING' && (
                              <td className={`px-4 py-3 text-right ${isShort ? 'text-red-600 font-medium' : 'text-[--ink-secondary]'}`}>
                                {available}
                                {isShort && <span className="ml-1 text-xs">(⚠ short)</span>}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-right text-sm font-semibold">
                  Total:{' '}
                  {formatINR((selectedRequest.items ?? []).reduce((sum, ri) => {
                    const qty = ri.quantityAllocated ?? ri.quantityReq ?? 0
                    const price = ri.item?.unitPrice ? Number(ri.item.unitPrice) : 0
                    return sum + qty * price
                  }, 0))}
                </div>
              </div>

              {selectedRequest.adminNotes && (
                <div>
                  <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Admin Notes</h3>
                  <p className="text-sm bg-amber-50 text-amber-900 p-3 rounded-md border border-amber-200">{selectedRequest.adminNotes}</p>
                </div>
              )}

              {selectedRequest.inventoryManagerNotes && (
                <div>
                  <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Your Remarks</h3>
                  <p className="text-sm bg-[--bg-canvas] p-3 rounded-md border border-[--border-default]">{selectedRequest.inventoryManagerNotes}</p>
                </div>
              )}

              {selectedRequest.invoiceNumber && (
                <div>
                  <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Invoice</h3>
                  <p className="text-sm font-mono">{selectedRequest.invoiceNumber}</p>
                </div>
              )}

              {/* Remarks textarea — only for pending requests */}
              {selectedRequest.status === 'PENDING' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-[--ink-primary]">Your Remarks (Optional)</label>
                  <textarea
                    rows={3}
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    placeholder="Optional note for this action…"
                    className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                  />
                </div>
              )}
            </div>

            {/* Action bar — only for pending requests */}
            {selectedRequest.status === 'PENDING' ? (
              <div className="p-4 sm:p-6 border-t border-[--border-default] bg-white sticky bottom-0 space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingAction('cancel')}
                    disabled={isMutating}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 border border-red-200 bg-red-50 text-red-700 rounded-md font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Ban size={16} />
                    Cancel Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction('confirm')}
                    disabled={isMutating}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Confirm Request
                  </button>
                </div>
                <p className="text-xs text-[--ink-secondary]">
                  Confirming deducts stock and finalises the request. Cancelling leaves inventory unchanged.
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-6 border-t border-[--border-default] bg-[--bg-subtle] text-sm text-[--ink-secondary]">
                {selectedRequest.status === 'APPROVED'
                  ? 'This request was confirmed and fulfilled. Inventory has been updated.'
                  : 'This request was cancelled. No inventory changes were made.'}
              </div>
            )}
          </div>

          <ConfirmModal
            isOpen={pendingAction !== null}
            title={pendingAction === 'confirm' ? 'Confirm Request' : 'Cancel Request'}
            description={
              pendingAction === 'confirm'
                ? 'Confirm this request? Stock will be deducted and the requester will be notified.'
                : 'Cancel this admin-approved request? Inventory will not be changed.'
            }
            confirmText={pendingAction === 'confirm' ? 'Confirm & Fulfil' : 'Cancel Request'}
            isDestructive={pendingAction === 'cancel'}
            isLoading={isMutating}
            onConfirm={() => {
              if (pendingAction === 'confirm') confirmMutation.mutate()
              else if (pendingAction === 'cancel') cancelMutation.mutate()
            }}
            onCancel={() => setPendingAction(null)}
          />
        </div>
      )}
    </div>
  )
}
