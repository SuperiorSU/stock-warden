'use client'

import { useState } from 'react'
import { SAFilterBar } from './SAFilterBar'
import { SARequestsTable } from './SARequestsTable'
import { SAExportButton } from './SAExportButton'
import { SAFilters, DEFAULT_FILTERS } from './types'

export function SAEmployeeExplorer({
  departments,
  items,
}: {
  departments: string[]
  items: { id: string; name: string }[]
}) {
  const [filters, setFilters] = useState<SAFilters>(DEFAULT_FILTERS)

  function handleFiltersChange(patch: Partial<SAFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SAFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          departments={departments}
          items={items}
        />
        <SAExportButton type="requests" filters={filters as unknown as Record<string, unknown>} />
      </div>
      <SARequestsTable filters={filters} />
    </div>
  )
}
