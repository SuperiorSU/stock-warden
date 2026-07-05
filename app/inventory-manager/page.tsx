'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Package, AlertTriangle, XCircle, Plus, CheckCircle2, Ban, Clock3, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { formatINR } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/status-badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import toast from 'react-hot-toast'

const LOW_STOCK_THRESHOLD = 20
const PAGE_SIZE = 50

type InventoryItem = {
  id: string
  name: string
  category?: string | null
  availableQty: number
  unit: string
  createdAt: string | Date
  isActive: boolean
  isStale: boolean
}

type InventoryRequestLine = {
  id: string
  quantityReq: number
  quantityAllocated?: number | null
  item: {
    name: string
    unitPrice?: string | number | null
    availableQty?: number | null
    category?: string | null
    unit?: string | null
  }
}

type InventoryRequest = {
  id: string
  status: 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  createdAt: string | Date
  adminNotes?: string | null
  user: {
    name: string
    department?: string | null
    employeeId?: string | null
    email?: string | null
  }
  items: InventoryRequestLine[]
}

type ListResponse<T> = {
  data: T
  meta?: { nextCursor?: string | null }
}

function getErrorMessage(error: unknown, fallback: string) {
  const apiMessage = (error as any)?.response?.data?.error?.message
  if (typeof apiMessage === 'string' && apiMessage) return apiMessage
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export default function InventoryManagerDashboard() {
  const queryClient = useQueryClient()

  const inventoryQuery = useInfiniteQuery<ListResponse<InventoryItem[]>>({
    queryKey: ['im-inventory-all'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/inventory', {
        params: { limit: PAGE_SIZE, cursor: pageParam },
      })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  })

  const requestsQuery = useQuery<InventoryRequest[]>({
    queryKey: ['im-pending-requests'],
    queryFn: async () => {
      const res = await api.get('/inventory-manager/requests', {
        params: { limit: 20, status: 'PENDING' },
      })
      return res.data.data as InventoryRequest[]
    },
    staleTime: 60 * 1000,
  })

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = inventoryQuery

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const stats = useMemo(() => {
    const items: InventoryItem[] = inventoryQuery.data?.pages.flatMap((p) => p.data) ?? []
    const seen = new Set<string>()
    const unique = items.filter((i) => {
      if (!i?.id || seen.has(i.id)) return false
      seen.add(i.id)
      return true
    })
    const active = unique.filter((i) => i.isActive && !i.isStale)
    return {
      total: active.length,
      lowStock: active.filter((i) => i.availableQty > 0 && i.availableQty < LOW_STOCK_THRESHOLD).length,
      outOfStock: active.filter((i) => i.availableQty === 0).length,
      pendingRequests: requestsQuery.data?.length ?? 0,
      recent: [...unique]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 10),
    }
  }, [inventoryQuery.data, requestsQuery.data])

  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null)
  const [managerNotes, setManagerNotes] = useState('')
  const [pendingAction, setPendingAction] = useState<'confirm' | 'cancel' | null>(null)

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedRequest?.id) throw new Error('No request selected')
      return api.patch(`/inventory-manager/requests/${selectedRequest.id}/confirm`, { notes: managerNotes })
    },
    onSuccess: () => {
      toast.success('Request confirmed. Inventory updated and requester notified.')
      queryClient.invalidateQueries({ queryKey: ['im-pending-requests'] })
      queryClient.invalidateQueries({ queryKey: ['im-inventory-all'] })
      setSelectedRequest(null)
      setPendingAction(null)
      setManagerNotes('')
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Could not confirm this request. Please check stock levels and try again.')),
  })

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!selectedRequest?.id) throw new Error('No request selected')
      return api.patch(`/inventory-manager/requests/${selectedRequest.id}/cancel`, { notes: managerNotes })
    },
    onSuccess: () => {
      toast.success('Request cancelled. No inventory changes were made.')
      queryClient.invalidateQueries({ queryKey: ['im-pending-requests'] })
      setSelectedRequest(null)
      setPendingAction(null)
      setManagerNotes('')
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Could not cancel this request. Please try again.')),
  })

  const isLoading = inventoryQuery.isLoading || requestsQuery.isLoading

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    )
  }

  const pendingCount = stats.pendingRequests
  const isError = inventoryQuery.isError || requestsQuery.isError

  return (
    <div className="space-y-8 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventory Dashboard</h1>
          <p className="text-sm text-[--ink-secondary]">Review admin-approved requests and monitor stock levels</p>
        </div>
        <Link
          href="/inventory-manager/items/new"
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors shrink-0"
        >
          <Plus size={16} />
          Add New Item
        </Link>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Some dashboard data couldn&apos;t be loaded.</span>
          <button
            onClick={() => { inventoryQuery.refetch(); requestsQuery.refetch() }}
            disabled={inventoryQuery.isFetching || requestsQuery.isFetching}
            className="text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inventoryQuery.isFetching || requestsQuery.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[--border-default] rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-[--ink-secondary] shrink-0" />
            <span className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider leading-tight">Total Items</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold">{stats.total}</p>
          <p className="mt-1 text-xs text-[--ink-secondary]">Active, non-stale items</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider leading-tight">Low Stock</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold text-amber-700">{stats.lowStock}</p>
          <p className="mt-1 text-xs text-amber-600">Below {LOW_STOCK_THRESHOLD} units</p>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-600 shrink-0" />
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider leading-tight">Out of Stock</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold text-red-700">{stats.outOfStock}</p>
          <p className="mt-1 text-xs text-red-600">Zero available quantity</p>
        </div>

        <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-blue-600 shrink-0" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider leading-tight">Awaiting Review</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold text-blue-700">{pendingCount}</p>
          <p className="mt-1 text-xs text-blue-600">Admin-approved requests</p>
        </div>
      </div>

      {/* Pending requests table */}
      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[--border-default] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[--ink-primary]">Requests Awaiting Confirmation</h2>
            <p className="text-sm text-[--ink-secondary]">Confirm or cancel approved requests before inventory is updated.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-[--ink-secondary]">{pendingCount} open</span>
            <Link
              href="/inventory-manager/requests"
              className="text-sm font-medium text-black hover:underline"
            >
              View all →
            </Link>
          </div>
        </div>
        {(requestsQuery.data?.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-[--ink-secondary] text-center">No requests are waiting for inventory confirmation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary]">Requester</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] hidden sm:table-cell">Department</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary]">Items</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] text-right hidden md:table-cell">Value</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] hidden sm:table-cell">Submitted</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {requestsQuery.data?.map((request) => (
                  <tr key={request.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-5 py-3 font-medium text-[--ink-primary]">{request.user?.name ?? 'Unknown'}</td>
                    <td className="px-5 py-3 text-[--ink-secondary] hidden sm:table-cell">{request.user?.department ?? '-'}</td>
                    <td className="px-5 py-3 text-[--ink-primary]">{request.items?.length ?? 0} item(s)</td>
                    <td className="px-5 py-3 text-right font-medium text-[--ink-primary] hidden md:table-cell">
                      {formatINR((request.items ?? []).reduce((sum: number, ri) => {
                        const qty = ri.quantityAllocated ?? ri.quantityReq ?? 0
                        const price = ri.item?.unitPrice ? Number(ri.item.unitPrice) : 0
                        return sum + qty * price
                      }, 0))}
                    </td>
                    <td className="px-5 py-3 text-[--ink-secondary] hidden sm:table-cell">{formatDate(request.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setSelectedRequest(request); setManagerNotes('') }}
                        className="text-sm font-medium text-[--ink-primary] hover:underline"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent additions */}
      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[--border-default]">
          <h2 className="font-semibold text-[--ink-primary]">Recent Additions</h2>
        </div>
        {stats.recent.length === 0 ? (
          <p className="p-6 text-sm text-[--ink-secondary] text-center">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary]">Item</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] hidden sm:table-cell">Category</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] text-right">Qty</th>
                  <th className="px-5 py-3 font-medium text-[--ink-secondary] hidden sm:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {stats.recent.map((item) => (
                  <tr key={item.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/inventory-manager/items/${item.id}`} className="hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[--ink-secondary] hidden sm:table-cell">{item.category ?? '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={item.availableQty === 0 ? 'text-red-600 font-medium' : ''}>
                        {item.availableQty}
                      </span>
                      <span className="text-[--ink-secondary] ml-1">{item.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-[--ink-secondary] hidden sm:table-cell">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRequest(null)} />
          <div className="relative w-full sm:max-w-lg lg:max-w-2xl bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-[--border-default] flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold">Review Request</h2>
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
              <div className="bg-[--bg-subtle] rounded-md p-4 text-sm space-y-2">
                <p><span className="text-[--ink-secondary] inline-block w-28">Name</span><span className="font-medium">{selectedRequest.user?.name}</span></p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Department</span>{selectedRequest.user?.department ?? '-'}</p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Employee ID</span>{selectedRequest.user?.employeeId ?? '-'}</p>
                <p><span className="text-[--ink-secondary] inline-block w-28">Status</span><StatusBadge status={selectedRequest.status} /></p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requested Items</h3>
                <div className="border border-[--border-default] rounded-md overflow-x-auto">
                  <table className="w-full text-sm min-w-72">
                    <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                      <tr>
                        <th className="px-4 py-2 font-medium text-left">Item</th>
                        <th className="px-4 py-2 font-medium text-right">Req.</th>
                        <th className="px-4 py-2 font-medium text-right">Allocated</th>
                        <th className="px-4 py-2 font-medium text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border-default]">
                      {selectedRequest.items?.map((ri) => {
                        const allocated = ri.quantityAllocated ?? ri.quantityReq
                        const available = ri.item?.availableQty ?? 0
                        const isShort = allocated > available
                        return (
                          <tr key={ri.id}>
                            <td className="px-4 py-3">{ri.item?.name}</td>
                            <td className="px-4 py-3 text-right">{ri.quantityReq}</td>
                            <td className="px-4 py-3 text-right font-medium">{allocated}</td>
                            <td className={`px-4 py-3 text-right ${isShort ? 'text-red-600 font-medium' : 'text-[--ink-secondary]'}`}>
                              {available}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-right text-sm font-semibold">
                  Request Total:{' '}
                  {formatINR((selectedRequest.items ?? []).reduce((sum: number, ri) => {
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

              <div>
                <label className="block text-sm font-medium mb-1 text-[--ink-primary]">Inventory Manager Remarks (Optional)</label>
                <textarea
                  rows={3}
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Optional note for the final action"
                  className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                />
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-[--border-default] bg-white sticky bottom-0 space-y-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingAction('cancel')}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 border border-red-200 bg-red-50 text-red-700 rounded-md font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Ban size={16} />
                  Cancel Request
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction('confirm')}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Confirm Request
                </button>
              </div>
              <p className="text-xs text-[--ink-secondary]">Confirming deducts stock and finalises the request. Cancelling leaves inventory unchanged.</p>
            </div>
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
            isLoading={confirmMutation.isPending || cancelMutation.isPending}
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
