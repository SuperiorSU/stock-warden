'use client'

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface AsyncActionOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string | null
}

export function useAsyncAction<T = unknown>(
  action: () => Promise<T>,
  options: AsyncActionOptions<T> = {}
) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async () => {
    setIsPending(true)
    setError(null)
    try {
      const result = await action()
      if (options.successMessage) toast.success(options.successMessage)
      options.onSuccess?.(result)
      return result
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ??
        options.errorMessage ??
        'Something went wrong.'
      setError(msg)
      if (options.errorMessage !== null) toast.error(msg)
      options.onError?.(err as Error)
    } finally {
      setIsPending(false)
    }
  }, [action, options])

  return { execute, isPending, error, clearError: () => setError(null) }
}
