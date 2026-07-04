'use client'

import { useReducer, useEffect, useRef } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { SAFilters, DEFAULT_FILTERS, RequestStatus } from './types'

const filterSelectCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black'
const filterInputCls =
  'text-sm border border-[--border-default] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black w-36'

function filterReducer(state: SAFilters, patch: Partial<SAFilters>): SAFilters {
  return { ...state, ...patch }
}

function hasActiveFilters(f: SAFilters): boolean {
  return (
    f.monthFrom !== null ||
    f.monthTo !== null ||
    f.department !== null ||
    f.status !== null ||
    f.itemId !== null ||
    f.sortBy !== 'date' ||
    f.order !== 'desc' ||
    f.sessionYear !== new Date().getFullYear()
  )
}

export function SAFilterBar({
  filters,
  onFiltersChange,
  departments,
  items,
}: {
  filters: SAFilters
  onFiltersChange: (f: Partial<SAFilters>) => void
  departments: string[]
  items?: { id: string; name: string }[]
}) {
  const [pending, dispatch] = useReducer(filterReducer, filters)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onFiltersChange(pending), 400)
    return () => clearTimeout(timerRef.current)
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Session Year */}
      <select
        value={pending.sessionYear}
        onChange={(e) => dispatch({ sessionYear: Number(e.target.value) })}
        className={filterSelectCls}
      >
        {[2026, 2025, 2024].map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Month range */}
      <div className="flex items-center gap-2 text-sm text-[--ink-secondary]">
        <input
          type="month"
          value={pending.monthFrom ?? ''}
          onChange={(e) => dispatch({ monthFrom: e.target.value || null })}
          className={filterInputCls}
        />
        <span>to</span>
        <input
          type="month"
          value={pending.monthTo ?? ''}
          onChange={(e) => dispatch({ monthTo: e.target.value || null })}
          className={filterInputCls}
        />
      </div>

      {/* Department */}
      <select
        value={pending.department ?? ''}
        onChange={(e) => dispatch({ department: e.target.value || null })}
        className={filterSelectCls}
      >
        <option value="">All Departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* Item */}
      {items && items.length > 0 && (
        <select
          value={pending.itemId ?? ''}
          onChange={(e) => dispatch({ itemId: e.target.value || null })}
          className={filterSelectCls}
        >
          <option value="">All Items</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      )}

      {/* Status */}
      <select
        value={pending.status ?? ''}
        onChange={(e) =>
          dispatch({ status: (e.target.value as RequestStatus) || null })
        }
        className={filterSelectCls}
      >
        <option value="">All Statuses</option>
        {(['REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as RequestStatus[]).map(
          (s) => (
            <option key={s} value={s}>{s}</option>
          )
        )}
      </select>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <select
          value={pending.sortBy}
          onChange={(e) =>
            dispatch({ sortBy: e.target.value as SAFilters['sortBy'] })
          }
          className={filterSelectCls}
        >
          <option value="date">Sort: Date</option>
          <option value="amount">Sort: Amount</option>
          <option value="items">Sort: Item Count</option>
        </select>
        <button
          type="button"
          onClick={() =>
            dispatch({ order: pending.order === 'asc' ? 'desc' : 'asc' })
          }
          className="p-1.5 rounded border border-[--border-default] bg-[--bg-surface] text-[--ink-secondary] hover:bg-[--bg-muted] transition-colors"
          aria-label={`Sort ${pending.order === 'asc' ? 'descending' : 'ascending'}`}
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {/* Clear filters */}
      {hasActiveFilters(pending) && (
        <button
          type="button"
          onClick={() => {
            dispatch(DEFAULT_FILTERS)
            onFiltersChange(DEFAULT_FILTERS)
          }}
          className="text-xs text-[--ink-tertiary] hover:text-[--ink-primary] underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
