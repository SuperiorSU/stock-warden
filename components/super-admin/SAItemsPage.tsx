'use client'

import React, { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatINR } from '@/lib/utils/format'
import { format } from 'date-fns'
import { SAExportButton } from './SAExportButton'
import { ChevronDown, ChevronRight } from 'lucide-react'

type SortBy = 'amount' | 'qty' | 'requests'
type Order  = 'asc' | 'desc'

const filterSelectCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black'

interface ItemRow {
  itemId: string
  itemName: string
  category: string | null
  totalAmountSpent: number
  totalQtyFulfilled: number
  totalRequestCount: number
  currentStock: number | null
  totalStock: number | null
  unitPrice: number | null
  totalInventoryValue: number | null
}

interface ItemsSummary {
  totalCatalogValue: number
  totalSpent: number
  totalQtyFulfilled: number
  topCategory: string | null
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[--ink-secondary]">{label}</span>
      <span className="font-semibold text-[--ink-primary]">{value}</span>
    </div>
  )
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-[--bg-subtle] rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  )
}

export function SAItemsPage() {
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear())
  const [monthFrom, setMonthFrom]     = useState('')
  const [monthTo, setMonthTo]         = useState('')
  const [category, setCategory]       = useState('')
  const [sortBy, setSortBy]           = useState<SortBy>('amount')
  const [order, setOrder]             = useState<Order>('desc')
  const [tab, setTab]                 = useState<'items' | 'employees'>('items')
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  const filters = {
    sessionYear,
    monthFrom: monthFrom || undefined,
    monthTo:   monthTo   || undefined,
    category:  category  || undefined,
    sortBy,
    order,
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sa-item-analytics', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v != null) params.set(k, String(v)) })
      return api.get(`/super-admin/items/analytics?${params}`).then((r) => r.data)
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const items: ItemRow[] = data?.data?.items ?? []
  const summary: ItemsSummary | undefined = data?.data?.summary

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Item Analytics</h1>
          <p className="text-sm text-[--ink-secondary]">
            Per-item financial and usage analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SAExportButton type="items" filters={filters as Record<string, unknown>} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={sessionYear}
          onChange={(e) => setSessionYear(Number(e.target.value))}
          className={filterSelectCls}
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          type="month"
          value={monthFrom}
          onChange={(e) => setMonthFrom(e.target.value)}
          className={filterSelectCls}
        />
        <span className="text-sm text-[--ink-secondary]">to</span>
        <input
          type="month"
          value={monthTo}
          onChange={(e) => setMonthTo(e.target.value)}
          className={filterSelectCls}
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category..."
          className={filterSelectCls + ' w-36'}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className={filterSelectCls}
        >
          <option value="amount">Sort: Amount</option>
          <option value="qty">Sort: Qty</option>
          <option value="requests">Sort: Requests</option>
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as Order)}
          className={filterSelectCls}
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="flex flex-wrap gap-6 px-4 py-3 bg-[--bg-subtle] rounded-lg text-sm">
          <SummaryStat label="Catalog Value" value={formatINR(summary.totalCatalogValue)} />
          <SummaryStat label="Total Spent" value={formatINR(summary.totalSpent)} />
          <SummaryStat label="Qty Fulfilled" value={String(summary.totalQtyFulfilled)} />
          {summary.topCategory && (
            <SummaryStat label="Top Category" value={summary.topCategory} />
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex border-b border-[--border-default]">
        {(['items', 'employees'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-black text-[--ink-primary]'
                : 'border-transparent text-[--ink-secondary] hover:text-[--ink-primary]'
            }`}
          >
            {t === 'items' ? 'By Item' : 'By Employee'}
          </button>
        ))}
      </div>

      {/* By Item table */}
      {tab === 'items' && (
        <div className="relative bg-white rounded-lg border border-[--border-default] overflow-hidden">
          {isFetching && !isLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-black animate-pulse" />
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  {['Item Name', 'Category', 'Stock Left', 'Total Spent', 'Qty Fulfilled', 'Requests', ''].map(
                    (h) => (
                      <th key={h} className="px-6 py-4 font-medium text-[--ink-secondary]">{h}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : items.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[--ink-secondary]">
                        No items found for this period.
                      </td>
                    </tr>
                  )
                  : items.map((item) => (
                    <React.Fragment key={item.itemId}>
                      <tr
                        className="hover:bg-[--bg-canvas] transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedId((id) => (id === item.itemId ? null : item.itemId))
                        }
                      >
                        <td className="px-6 py-4 font-medium text-[--ink-primary]">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 text-[--ink-secondary]">
                          {item.category ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          {item.currentStock != null ? (
                            <span className={item.currentStock < 10 ? 'text-red-600 font-medium' : ''}>
                              {item.currentStock}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {formatINR(item.totalAmountSpent)}
                        </td>
                        <td className="px-6 py-4">{item.totalQtyFulfilled}</td>
                        <td className="px-6 py-4">{item.totalRequestCount}</td>
                        <td className="px-6 py-4">
                          {expandedId === item.itemId
                            ? <ChevronDown size={16} className="text-[--ink-secondary]" />
                            : <ChevronRight size={16} className="text-[--ink-secondary]" />}
                        </td>
                      </tr>
                      {expandedId === item.itemId && (
                        <tr key={`${item.itemId}-detail`}>
                          <td colSpan={7} className="p-0">
                            <SAItemEmployeeBreakdown
                              itemId={item.itemId}
                              sessionYear={sessionYear}
                              monthFrom={monthFrom || undefined}
                              monthTo={monthTo || undefined}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Employee tab — uses employees/requests endpoint with itemId filter */}
      {tab === 'employees' && (
        <div className="bg-white rounded-lg border border-[--border-default] p-6 text-sm text-[--ink-secondary]">
          Expand any item row in the &ldquo;By Item&rdquo; tab to view its employee breakdown, or use the Employees page to filter by item.
        </div>
      )}
    </div>
  )
}

function SAItemEmployeeBreakdown({
  itemId,
  sessionYear,
  monthFrom,
  monthTo,
}: {
  itemId: string
  sessionYear: number
  monthFrom?: string
  monthTo?: string
}) {
  const params = new URLSearchParams({ sessionYear: String(sessionYear) })
  if (monthFrom) params.set('monthFrom', monthFrom)
  if (monthTo)   params.set('monthTo', monthTo)

  const { data, isLoading } = useQuery({
    queryKey: ['sa-item-approved', itemId, sessionYear, monthFrom, monthTo],
    queryFn: () =>
      api.get(`/super-admin/items/${itemId}/approved?${params}`).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  })

  const records: {
    id: string
    unitPrice: number
    quantityFulfilled: number
    totalAmount: number
    approvedAt: string
    inventoryProcessedAt: string | null
    employeeName: string
    employeeId: string | null
    department: string | null
    designation: string | null
    adminName: string | null
    imName: string | null
  }[] = data?.data?.records ?? []

  const summary = data?.data?.summary

  return (
    <div className="px-6 py-4 bg-[--bg-canvas] border-t border-[--border-default] space-y-3">
      <p className="text-xs font-medium text-[--ink-secondary] uppercase tracking-wide">
        Approved allocations only
      </p>
      {isLoading ? (
        <div className="text-xs text-[--ink-secondary]">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-xs text-[--ink-secondary]">No approved allocations for this item in this period.</div>
      ) : (
        <div className="overflow-x-auto rounded border border-[--border-default]">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[--bg-subtle]">
              <tr>
                {['Employee', 'Dept', 'Units', 'Unit Price', 'Total', 'Date Approved', 'Date Allocated', 'Approved By', 'Alloc. By (IM)'].map(
                  (h) => <th key={h} className="px-4 py-2 font-medium text-[--ink-secondary]">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default] bg-white">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-[--ink-primary]">{r.employeeName}</td>
                  <td className="px-4 py-2 text-[--ink-secondary]">{r.department ?? '—'}</td>
                  <td className="px-4 py-2 tabular-nums">{r.quantityFulfilled}</td>
                  <td className="px-4 py-2 tabular-nums">₹{r.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 font-semibold text-green-700 tabular-nums">
                    ₹{r.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {format(new Date(r.approvedAt), 'd MMM yyyy')}
                  </td>
                  <td className="px-4 py-2">
                    {r.inventoryProcessedAt ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-2">{r.adminName ?? '—'}</td>
                  <td className="px-4 py-2">{r.imName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t border-[--border-default] bg-[--bg-subtle]">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-[--ink-secondary]">
                    Total ({summary.totalRecords} allocations)
                  </td>
                  <td className="px-4 py-2 font-semibold tabular-nums">{summary.totalUnits}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 font-bold text-green-700 tabular-nums">
                    ₹{summary.totalAmount.toFixed(2)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
