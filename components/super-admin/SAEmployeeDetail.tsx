'use client'

import { useReducer, useRef, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/format'
import { ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { useXlsxExport } from '@/lib/hooks/use-xlsx-export'

interface ApprovedRecord {
  id: string
  itemName: string
  category: string | null
  unitPrice: number
  quantityFulfilled: number
  totalAmount: number
  approvedAt: string
  inventoryProcessedAt: string | null
  adminName: string | null
  imName: string | null
}

interface Employee {
  id: string
  name: string
  employeeId: string | null
  department: string | null
  designation: string | null
  email: string
}

interface Filters {
  sessionYear: number
  monthFrom: string
  monthTo: string
}

function filterReducer(s: Filters, patch: Partial<Filters>): Filters {
  return { ...s, ...patch }
}

const selectCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black'
const inputCls = selectCls + ' w-36'

export function SAEmployeeDetail({ userId }: { userId: string }) {
  const [filters, dispatch] = useReducer(filterReducer, {
    sessionYear: new Date().getFullYear(),
    monthFrom:   '',
    monthTo:     '',
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [applied, setApplied] = useState(filters)

  // Debounce filter changes
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setApplied(filters), 400)
    return () => clearTimeout(timerRef.current)
  }, [filters])

  const params = new URLSearchParams({ sessionYear: String(applied.sessionYear) })
  if (applied.monthFrom) params.set('monthFrom', applied.monthFrom)
  if (applied.monthTo)   params.set('monthTo',   applied.monthTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sa-emp-approved', userId, applied],
    queryFn: () =>
      api.get(`/super-admin/employees/${userId}/approved?${params}`).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  })

  const employee: Employee | undefined = data?.data?.employee
  const records: ApprovedRecord[]      = data?.data?.records ?? []
  const summary                        = data?.data?.summary

  const exportParams = new URLSearchParams({
    employeeId:  userId,
    status:      'APPROVED',
    sessionYear: String(applied.sessionYear),
  })
  if (applied.monthFrom) exportParams.set('monthFrom', applied.monthFrom)
  if (applied.monthTo)   exportParams.set('monthTo',   applied.monthTo)

  const { isExporting: exporting, exportFile: handleExport } = useXlsxExport(
    `/api/super-admin/export/requests?${exportParams}`,
    `export-${employee?.name ?? userId}.xlsx`
  )

  return (
    <div className="space-y-6 page-enter">
      {/* Back nav */}
      <Link
        href="/super-admin/employees"
        className="inline-flex items-center gap-1.5 text-sm text-[--ink-secondary] hover:text-[--ink-primary]"
      >
        <ArrowLeft size={14} />
        All Employees
      </Link>

      {/* Employee header */}
      {employee && (
        <div className="bg-white rounded-lg border border-[--border-default] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-display font-bold text-[--ink-primary]">
              {employee.name}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-[--ink-secondary]">
              {employee.employeeId && <span>ID: {employee.employeeId}</span>}
              {employee.department && <span>{employee.department}</span>}
              {employee.designation && <span>{employee.designation}</span>}
              <span>{employee.email}</span>
            </div>
          </div>
          <AsyncButton
            variant="secondary"
            isPending={exporting}
            pendingLabel="Exporting…"
            onClick={handleExport}
          >
            <Download size={14} />
            Export (.xlsx)
          </AsyncButton>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filters.sessionYear}
          onChange={(e) => dispatch({ sessionYear: Number(e.target.value) })}
          className={selectCls}
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          type="month"
          value={filters.monthFrom}
          onChange={(e) => dispatch({ monthFrom: e.target.value })}
          className={inputCls}
        />
        <span className="text-sm text-[--ink-secondary]">to</span>
        <input
          type="month"
          value={filters.monthTo}
          onChange={(e) => dispatch({ monthTo: e.target.value })}
          className={inputCls}
        />
        {(filters.monthFrom || filters.monthTo) && (
          <button
            type="button"
            onClick={() => dispatch({ monthFrom: '', monthTo: '' })}
            className="text-xs text-[--ink-tertiary] hover:text-[--ink-primary] underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load this employee&apos;s allocation history.</span>
          <button onClick={() => refetch()} className="text-sm font-medium underline">Retry</button>
        </div>
      )}

      {/* Summary strip */}
      {summary && (
        <div className="flex flex-wrap gap-6 px-4 py-3 bg-[--bg-subtle] rounded-lg text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-[--ink-secondary]">Total Records</span>
            <span className="font-semibold">{summary.totalRecords}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[--ink-secondary]">Total Units Fulfilled</span>
            <span className="font-semibold">{summary.totalUnits}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[--ink-secondary]">Total Amount</span>
            <span className="font-semibold text-green-700">{formatINR(summary.totalAmount)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-[--border-default] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                {[
                  'Item Name', 'Category',
                  'Date Approved', 'Date Allocated',
                  'Approved By', 'Allocated By (IM)',
                  'Units', 'Unit Price', 'Total Price',
                ].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium text-[--ink-secondary]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-[--bg-subtle] rounded animate-pulse w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[--ink-secondary]">
                    No approved requests found for this period.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-5 py-3 font-medium text-[--ink-primary]">{r.itemName}</td>
                    <td className="px-5 py-3 text-[--ink-secondary]">{r.category ?? '—'}</td>
                    <td className="px-5 py-3">{format(new Date(r.approvedAt), 'd MMM yyyy')}</td>
                    <td className="px-5 py-3">
                      {r.inventoryProcessedAt
                        ? format(new Date(r.inventoryProcessedAt), 'd MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">{r.adminName ?? '—'}</td>
                    <td className="px-5 py-3">{r.imName ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.quantityFulfilled}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatINR(r.unitPrice)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700 tabular-nums">
                      {formatINR(r.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Total row */}
            {!isLoading && records.length > 0 && summary && (
              <tfoot>
                <tr className="border-t-2 border-[--border-default] bg-[--bg-subtle]">
                  <td colSpan={6} className="px-5 py-3 font-semibold text-[--ink-primary]">
                    Total ({summary.totalRecords} items · {summary.totalUnits} units)
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                    {summary.totalUnits}
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right font-bold text-green-700 tabular-nums">
                    {formatINR(summary.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
