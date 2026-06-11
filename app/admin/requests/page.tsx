'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { formatINR } from '@/lib/utils/format'
import { Filter, X, CheckCircle, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TableWrapper } from '@/components/ui/TableWrapper'

export default function AdminRequestsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-requests', statusFilter],
    queryFn: async () => {
      const params: any = {}
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter
      const res = await api.get('/admin/requests', { params })
      return res.data.data
    }
  })

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Manage Requests</h1>
          <p className="text-sm text-[--ink-secondary]">Review and process inventory requests</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[--ink-secondary] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-[--border-default] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : (
          <TableWrapper stackOnMobile>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden lg:table-cell">ID</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Requester</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden md:table-cell">Department</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Items</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right hidden md:table-cell">Amount</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden sm:table-cell">Date</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {!data?.length ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[--ink-secondary]">
                      No requests found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  data.map((req: any) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className="hover:bg-[--bg-subtle] cursor-pointer transition-colors"
                    >
                      <td data-label="ID" className="px-6 py-4 font-mono text-xs text-[--ink-secondary] hidden lg:table-cell">
                        {req.id.split('-')[0]}…
                      </td>
                      <td data-label="Requester" className="px-6 py-4 font-medium text-[--ink-primary]">
                        {req.user?.name || 'Unknown'}
                      </td>
                      <td data-label="Department" className="px-6 py-4 text-[--ink-secondary] hidden md:table-cell">
                        {req.user?.department || '-'}
                      </td>
                      <td data-label="Items" className="px-6 py-4 font-medium text-[--ink-primary]">
                        {req.items?.length} item(s)
                      </td>
                      <td data-label="Amount" className="px-6 py-4 text-right font-medium text-[--ink-primary] hidden md:table-cell">
                        {formatINR(
                          (req.items ?? []).reduce((sum: number, ri: any) => {
                            const qty = ri.quantityAllocated ?? ri.quantityFul ?? ri.quantityReq ?? 0
                            const price = ri.item?.unitPrice ? Number(ri.item.unitPrice) : 0
                            return sum + qty * price
                          }, 0)
                        )}
                      </td>
                      <td data-label="Date" className="px-6 py-4 text-[--ink-secondary] hidden sm:table-cell">
                        {formatDate(req.createdAt)}
                      </td>
                      <td data-label="Status" data-full className="px-6 py-4">
                        <StatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </div>

      {selectedRequest && (
        <RequestDrawer
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] })
            setSelectedRequest(null)
          }}
        />
      )}
    </div>
  )
}

function RequestDrawer({ request, onClose, onSuccess }: { request: any; onClose: () => void; onSuccess: () => void }) {
  const [adminNotes, setAdminNotes] = useState('')
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null)
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const ri of request.items ?? []) {
      init[ri.id] = ri.quantityAllocated ?? ri.quantityReq
    }
    return init
  })
  const [allocErrors, setAllocErrors] = useState<Record<string, string>>({})
  const [allocSaved, setAllocSaved] = useState(false)

  const allocateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/requests/${request.id}/allocate`, {
        allocations: Object.entries(allocations).map(([requestItemId, quantityAllocated]) => ({
          requestItemId,
          quantityAllocated,
        })),
      }),
    onSuccess: () => {
      setAllocSaved(true)
      setTimeout(() => setAllocSaved(false), 4000)
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not save quantity changes. Please try again.'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/requests/${request.id}/approve`, { adminNotes }),
    onSuccess: () => { toast.success('Request approved and forwarded to the inventory manager.'); onSuccess() },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not approve this request. Please try again.'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.patch(`/admin/requests/${request.id}/reject`, { adminNotes }),
    onSuccess: () => { toast.success('Request rejected. The requester has been notified.'); onSuccess() },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not reject this request. Please try again.'),
  })

  const isActionable = request.status === 'REQUESTED'
  const isProcessing = approveMutation.isPending || rejectMutation.isPending

  function validateAlloc(riId: string, val: number, ri: any) {
    if (!val || val < 1) return 'Must be at least 1'
    if (val > ri.quantityReq) return `Cannot exceed ${ri.quantityReq}`
    const avail = ri.item?.availableQty ?? 0
    if (val > avail) return `Only ${avail} available`
    return ''
  }

  function handleAllocChange(riId: string, val: string, ri: any) {
    const num = Number(val)
    setAllocSaved(false)
    setAllocations((prev) => ({ ...prev, [riId]: num }))
    setAllocErrors((prev) => ({ ...prev, [riId]: validateAlloc(riId, num, ri) }))
  }

  const hasAllocErrors =
    Object.values(allocErrors).some(Boolean) || Object.values(allocations).some((v) => !v || v < 1)

  const handleConfirm = () => {
    if (confirmAction === 'approve') approveMutation.mutate()
    else if (confirmAction === 'reject') rejectMutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg lg:max-w-2xl bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Sticky header */}
        <div className="p-4 sm:p-6 border-b border-[--border-default] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">Process Request</h2>
            <p className="text-xs font-mono text-[--ink-secondary] mt-1 break-all">{request.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[--ink-secondary] hover:text-[--ink-primary] hover:bg-[--bg-subtle] rounded-md transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-8 flex-1">
          {/* Requester Info */}
          <div>
            <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requester Details</h3>
            <div className="bg-[--bg-subtle] p-4 rounded-md text-sm space-y-2">
              <p><span className="text-[--ink-secondary] inline-block w-28">Name</span><span className="font-medium">{request.user?.name}</span></p>
              <p><span className="text-[--ink-secondary] inline-block w-28">Department</span>{request.user?.department || '-'}</p>
              <p><span className="text-[--ink-secondary] inline-block w-28">Employee ID</span>{request.user?.employeeId || '-'}</p>
              <p><span className="text-[--ink-secondary] inline-block w-28">Email</span>{request.user?.email || '-'}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requested Items</h3>
            <div className="border border-[--border-default] rounded-md overflow-x-auto">
              <table className="w-full text-left text-sm min-w-100">
                <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium text-right">Req. Qty</th>
                    <th className="px-4 py-2 font-medium text-right">Unit Price</th>
                    <th className="px-4 py-2 font-medium text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-default]">
                  {request.items?.map((ri: any) => {
                    const alloc = allocations[ri.id] ?? ri.quantityReq
                    return (
                      <tr key={ri.id}>
                        <td className="px-4 py-3">{ri.item?.name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {ri.quantityReq}{' '}
                          <span className="text-[--ink-secondary] font-normal">{ri.item?.unit}</span>
                          {alloc !== ri.quantityReq && (
                            <span className="ml-1 text-xs text-blue-600">→ {alloc}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{ri.item?.unitPrice ? formatINR(Number(ri.item.unitPrice)) : '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {ri.item?.unitPrice ? formatINR(Number(ri.item.unitPrice) * alloc) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-right text-sm font-semibold">
              Request Total:{' '}
              {formatINR(
                (request.items ?? []).reduce((sum: number, ri: any) => {
                  const qty = allocations[ri.id] ?? ri.quantityAllocated ?? ri.quantityFul ?? ri.quantityReq ?? 0
                  const price = ri.item?.unitPrice ? Number(ri.item.unitPrice) : 0
                  return sum + qty * price
                }, 0)
              )}
            </div>
          </div>

          {/* Adjust Quantities — only for actionable REQUESTED requests */}
          {isActionable && (
            <div>
              <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Adjust Quantities</h3>
              <div className="border border-[--border-default] rounded-md overflow-x-auto">
                <table className="w-full text-sm min-w-[320px]">
                  <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                    <tr>
                      <th className="px-4 py-2 font-medium text-left">Item</th>
                      <th className="px-4 py-2 font-medium text-center">Req.</th>
                      <th className="px-4 py-2 font-medium text-center">Allocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border-default]">
                    {request.items?.map((ri: any) => (
                      <tr key={ri.id}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{ri.item?.name}</div>
                          <div className="text-xs text-[--ink-secondary]">{ri.item?.availableQty ?? 0} available</div>
                        </td>
                        <td className="px-4 py-2 text-center text-[--ink-secondary]">{ri.quantityReq}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={1}
                            max={ri.quantityReq}
                            value={allocations[ri.id] ?? ri.quantityReq}
                            onChange={(e) => handleAllocChange(ri.id, e.target.value, ri)}
                            className={`w-20 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-black ${
                              allocErrors[ri.id] ? 'border-red-400' : 'border-[--border-default]'
                            }`}
                          />
                          {allocErrors[ri.id] && (
                            <div className="text-xs text-red-600 mt-0.5">{allocErrors[ri.id]}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {allocSaved ? (
                  <span className="text-xs text-green-700 font-medium">Quantities saved ✓</span>
                ) : (
                  <span className="text-xs text-[--ink-secondary]">Save allocations before approving if you changed quantities.</span>
                )}
                <button
                  onClick={() => allocateMutation.mutate()}
                  disabled={hasAllocErrors || allocateMutation.isPending}
                  className="px-3 py-1.5 text-sm border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle] disabled:opacity-50 transition-colors shrink-0"
                >
                  {allocateMutation.isPending ? 'Saving…' : 'Save Allocations'}
                </button>
              </div>
            </div>
          )}

          {request.notes && (
            <div>
              <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">User Notes</h3>
              <p className="text-sm bg-white p-3 rounded-md border border-[--border-default]">{request.notes}</p>
            </div>
          )}

          {request.adminNotes && (
            <div>
              <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Admin Remarks</h3>
              <p className="text-sm bg-amber-50 text-amber-900 p-3 rounded-md border border-amber-200">{request.adminNotes}</p>
            </div>
          )}

          {/* Status info for already-processed requests */}
          {!isActionable && (
            <div>
              <h3 className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Current Status</h3>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={request.status} />
                {request.status === 'APPROVED' && (
                  <a
                    href={`/api/user/requests/${request.id}/invoice-download`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-black hover:underline"
                  >
                    View Invoice
                  </a>
                )}
              </div>
              {request.status === 'PENDING' && (
                <p className="mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-start gap-2">
                  <Clock size={15} className="shrink-0 mt-0.5" />
                  This request has been approved and forwarded to the inventory manager for final confirmation.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        {isActionable && (
          <div className="p-4 sm:p-6 border-t border-[--border-default] bg-white space-y-4 sticky bottom-0">
            <div>
              <label className="block text-sm font-medium mb-1 text-[--ink-primary]">Admin Remarks (Optional)</label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Reason for approval/rejection…"
                className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction('reject')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-200 bg-red-50 text-red-700 rounded-md font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle size={18} />
                Reject
              </button>
              <button
                onClick={() => setConfirmAction('approve')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50"
              >
                <CheckCircle size={18} />
                Approve & Forward
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmAction !== null}
        title={confirmAction === 'approve' ? 'Approve and Forward Request' : 'Reject Request'}
        description={
          confirmAction === 'approve'
            ? 'Approve this request and send it to the inventory manager for final confirmation?'
            : 'Reject this request. The requester will be notified.'
        }
        confirmText={confirmAction === 'approve' ? 'Approve & Forward' : 'Reject'}
        isDestructive={confirmAction === 'reject'}
        isLoading={isProcessing}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
