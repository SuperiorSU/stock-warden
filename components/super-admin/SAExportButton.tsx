'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AsyncButton } from '@/components/ui/AsyncButton'

type ExportType = 'requests' | 'items'

export function SAExportButton({
  type,
  filters,
}: {
  type: ExportType
  filters?: Record<string, unknown>
}) {
  const [isPending, setIsPending] = useState(false)

  async function handleExport() {
    setIsPending(true)
    try {
      const params = new URLSearchParams(
        Object.entries(filters ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      )
      const url = `/api/super-admin/export/${type}?${params}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
        `export-${type}.xlsx`

      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AsyncButton
      variant="secondary"
      isPending={isPending}
      pendingLabel="Exporting..."
      onClick={handleExport}
    >
      <Download size={14} />
      Export {type === 'requests' ? 'Requests' : 'Items'} (.xlsx)
    </AsyncButton>
  )
}
