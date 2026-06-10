'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Download, XCircle, RotateCcw, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const requestId = params.id as string
  const [confirmAction, setConfirmAction] = useState<'cancel' | 're-request' | null>(null)

  const { data: req, isLoading } = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => {
      const res = await api.get(`/user/requests/${requestId}`)
      return res.data.data
    }
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/user/requests/${requestId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['user-requests-all'] })
      toast.success('Request cancelled successfully')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to cancel request')
  })

  const reRequestMutation = useMutation({
    mutationFn: () => api.patch(`/user/requests/${requestId}/re-request`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['user-requests-all'] })
      toast.success('Request resubmitted successfully')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to resubmit request')
  })

  const handleConfirm = () => {
    if (confirmAction === 'cancel') {
      cancelMutation.mutate()
    } else if (confirmAction === 're-request') {
      reRequestMutation.mutate()
    }
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  if (!req) return <div className="p-8 text-center text-[--ink-secondary]">Request not found.</div>

  const isCancelable = req.status === 'REQUESTED'
  const isReRequestable = req.status === 'REJECTED'
  const isApproved = req.status === 'APPROVED'

  const STATUS_STEPS = ['REQUESTED', 'PENDING', 'APPROVED']
  const terminalStatus = req.status === 'REJECTED' || req.status === 'CANCELLED'

  return (
    <div className="space-y-6 max-w-4xl mx-auto page-enter">
      <Link href="/requests" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        Back to Requests
      </Link>

      <div className="bg-white rounded-lg border border-[--border-default] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[--border-default]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-display font-bold">Request Details</h1>
                <p className="text-xs font-mono text-[--ink-secondary] mt-1 break-all">ID: {req.id}</p>
              </div>
              <StatusBadge status={req.status} />
            </div>

            {/* Action buttons row - wraps on mobile */}
            {(isApproved || isCancelable || isReRequestable) && (
              <div className="flex flex-wrap gap-2">
                {isApproved && (
                  <>
                    <a
                      href={`/api/user/requests/${req.id}/invoice-download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-md font-medium text-sm hover:bg-[--accent-hover] transition-colors"
                    >
                      <Download size={15} />
                      Invoice PDF
                    </a>
                    <a
                      href={`/api/user/requests/${req.id}/receipt-download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[--border-default] rounded-md font-medium text-sm hover:bg-[--bg-subtle] transition-colors"
                    >
                      <Download size={15} />
                      Receipt PDF
                    </a>
                  </>
                )}

                {isCancelable && (
                  <button
                    onClick={() => setConfirmAction('cancel')}
                    disabled={cancelMutation.isPending || reRequestMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[--border-default] text-[--ink-secondary] rounded-md font-medium text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={15} />
                    {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
                  </button>
                )}

                {isReRequestable && (
                  <button
                    onClick={() => setConfirmAction('re-request')}
                    disabled={cancelMutation.isPending || reRequestMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[--border-default] text-[--ink-secondary] rounded-md font-medium text-sm hover:bg-[--accent-primary-bg] hover:text-black transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    {reRequestMutation.isPending ? 'Resubmitting…' : 'Re-Request'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="p-4 sm:p-6 border-b border-[--border-default] bg-[--bg-subtle]">
          <div className="relative flex items-start justify-between">
            {/* Connector line */}
            <div className="absolute left-4 right-4 top-1.5 h-0.5 bg-[--border-default] z-0" />
            <div
              className="absolute left-4 top-1.5 h-0.5 bg-black z-0 transition-all duration-300"
              style={{
                width: req.status === 'APPROVED'
                  ? 'calc(100% - 2rem)'
                  : req.status === 'PENDING'
                  ? '50%'
                  : '0%',
              }}
            />

            {STATUS_STEPS.map((step, idx) => {
              const stepIndex = STATUS_STEPS.indexOf(req.status)
              const isCompleted =
                req.status === 'APPROVED'
                  ? idx < 3
                  : req.status === 'PENDING'
                  ? idx <= 1
                  : idx === 0

              const isCurrent = req.status === step

              const isFailed =
                terminalStatus && idx === (req.status === 'REJECTED' ? 1 : 1)

              let dotClass = 'w-4 h-4 rounded-full border-2 border-[--border-default] bg-white z-10 relative'
              if (isCurrent) dotClass = 'w-4 h-4 rounded-full border-2 border-black bg-black ring-4 ring-black/10 z-10 relative'
              else if (isCompleted && !terminalStatus) dotClass = 'w-4 h-4 rounded-full border-2 border-black bg-black z-10 relative'

              let label = step
              if (terminalStatus && idx === 2) label = req.status
              if (terminalStatus && idx === 1 && req.status === 'CANCELLED') label = 'CANCELLED'

              const labelColor = (isCurrent || isCompleted) && !terminalStatus
                ? 'text-black font-semibold'
                : terminalStatus && idx <= 1
                ? 'text-black font-semibold'
                : 'text-[--ink-disabled]'

              return (
                <div key={step} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                  <div className={dotClass} />
                  <span className={`text-[10px] uppercase tracking-wider text-center ${labelColor}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status messages */}
          {req.status === 'PENDING' && (
            <p className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              Your request has been approved by admin and is awaiting inventory manager confirmation.
            </p>
          )}
          {req.status === 'REJECTED' && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Your request was rejected.{req.adminNotes ? ` Reason: ${req.adminNotes}` : ''}
            </p>
          )}
          {req.status === 'CANCELLED' && (
            <p className="mt-4 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
              This request was cancelled by the inventory manager.{req.inventoryManagerNotes ? ` Reason: ${req.inventoryManagerNotes}` : ''}
            </p>
          )}
          {req.status === 'APPROVED' && (
            <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={16} />
              Your request has been fulfilled. Download your invoice below.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requested Items</h3>
              <div className="border border-[--border-default] rounded-md overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[320px]">
                  <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium text-right">Requested</th>
                      {req.items?.some((ri: any) => ri.quantityAllocated != null && ri.quantityAllocated !== ri.quantityReq) && (
                        <th className="px-4 py-2 font-medium text-right text-blue-700">Allocated</th>
                      )}
                      {req.status === 'APPROVED' && (
                        <th className="px-4 py-2 font-medium text-right text-green-700">Fulfilled</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border-default]">
                    {req.items?.map((ri: any) => {
                      const hasAlloc = ri.quantityAllocated != null && ri.quantityAllocated !== ri.quantityReq
                      const showAllocCol = req.items?.some((r: any) => r.quantityAllocated != null && r.quantityAllocated !== r.quantityReq)
                      return (
                        <tr key={ri.id}>
                          <td className="px-4 py-3">{ri.item.name}</td>
                          <td className="px-4 py-3 text-right">
                            {ri.quantityReq}{' '}
                            <span className="font-normal text-[--ink-secondary]">{ri.item.unit}</span>
                          </td>
                          {showAllocCol && (
                            <td className="px-4 py-3 text-right font-medium text-blue-700">
                              {ri.quantityAllocated ?? ri.quantityReq}{' '}
                              <span className="font-normal text-[--ink-secondary]">{ri.item.unit}</span>
                            </td>
                          )}
                          {req.status === 'APPROVED' && (
                            <td className="px-4 py-3 text-right font-medium text-green-700">
                              {ri.quantityFul ?? ri.quantityAllocated ?? ri.quantityReq}{' '}
                              <span className="font-normal text-[--ink-secondary]">{ri.item.unit}</span>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {req.items?.some((ri: any) => ri.quantityAllocated != null && ri.quantityAllocated !== ri.quantityReq) && (
                <p className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                  The admin adjusted the quantities before approving this request.
                </p>
              )}
            </div>

            {req.notes && (
              <div>
                <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Your Notes</h3>
                <p className="text-sm bg-[--bg-canvas] p-4 rounded-md border border-[--border-default]">{req.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[--ink-secondary] shrink-0">Submitted</dt>
                  <dd className="font-medium text-right">{formatDate(req.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[--ink-secondary] shrink-0">Session Year</dt>
                  <dd className="font-medium text-right">{req.sessionYear}</dd>
                </div>
                {req.processedAt && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[--ink-secondary] shrink-0">Processed</dt>
                    <dd className="font-medium text-right">{formatDate(req.processedAt)}</dd>
                  </div>
                )}
                {req.invoiceNumber && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[--ink-secondary] shrink-0">Invoice No.</dt>
                    <dd className="font-mono text-right">{req.invoiceNumber}</dd>
                  </div>
                )}
                {req.receiptNumber && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[--ink-secondary] shrink-0">Receipt No.</dt>
                    <dd className="font-mono text-right">{req.receiptNumber}</dd>
                  </div>
                )}
              </dl>
            </div>

            {req.adminNotes && (
              <div>
                <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Admin Remarks</h3>
                <p className="text-sm bg-amber-50 text-amber-900 p-3 rounded-md border border-amber-200">{req.adminNotes}</p>
              </div>
            )}

            {req.inventoryManagerNotes && (
              <div>
                <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Inventory Manager Remarks</h3>
                <p className="text-sm bg-zinc-50 text-zinc-800 p-3 rounded-md border border-zinc-200">{req.inventoryManagerNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAction !== null}
        title={confirmAction === 'cancel' ? 'Cancel Request' : 'Re-request Items'}
        description={
          confirmAction === 'cancel'
            ? 'Cancel this request? This action cannot be undone.'
            : 'Re-submit this request for admin approval again?'
        }
        confirmText={confirmAction === 'cancel' ? 'Cancel Request' : 'Re-Request'}
        isDestructive={confirmAction === 'cancel'}
        isLoading={cancelMutation.isPending || reRequestMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
