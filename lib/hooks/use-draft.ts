'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { draftManager } from '@/lib/drafts/draft-manager'

interface UseDraftOptions<T> {
  formId:          string
  initialValues:   T
  maxAgeMs:        number
  saveDebounceMs?: number
}

export function useDraft<T>({
  formId,
  maxAgeMs,
  saveDebounceMs = 800,
}: UseDraftOptions<T>) {
  const [hasDraft, setHasDraft] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setHasDraft(draftManager.exists(formId))
  }, [formId])

  const loadDraft = useCallback((): T | null => {
    return draftManager.load<T>(formId)
  }, [formId])

  const saveDraft = useCallback(
    (data: T) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        draftManager.save(formId, data, maxAgeMs)
        setHasDraft(true)
      }, saveDebounceMs)
    },
    [formId, maxAgeMs, saveDebounceMs]
  )

  const discardDraft = useCallback(() => {
    clearTimeout(saveTimer.current)
    draftManager.discard(formId)
    setHasDraft(false)
  }, [formId])

  useEffect(() => {
    return () => clearTimeout(saveTimer.current)
  }, [])

  return { hasDraft, loadDraft, saveDraft, discardDraft }
}
