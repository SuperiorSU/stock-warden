'use client'

import { formatDistanceToNow } from 'date-fns'
import { Clock } from 'lucide-react'

export function DraftBanner({
  onRestore,
  onDiscard,
  savedAt,
}: {
  onRestore: () => void
  onDiscard: () => void
  savedAt?:  number
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-yellow-800">
        <Clock size={14} className="shrink-0" />
        <span className="font-medium">You have an unsaved draft</span>
        {savedAt && (
          <span className="text-yellow-600 font-normal">
            from {formatDistanceToNow(savedAt, { addSuffix: true })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onRestore}
          className="font-medium text-yellow-800 hover:text-yellow-900 underline"
        >
          Restore draft
        </button>
        <span className="text-yellow-400">·</span>
        <button
          type="button"
          onClick={onDiscard}
          className="text-yellow-600 hover:text-yellow-800 underline"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
