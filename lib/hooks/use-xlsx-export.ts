'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function useXlsxExport(url: string, fallbackFilename: string) {
  const [isExporting, setIsExporting] = useState(false)

  async function exportFile() {
    setIsExporting(true)
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
        fallbackFilename
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return { isExporting, exportFile }
}
