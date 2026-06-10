'use client'

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster 
      position="top-right"
      toastOptions={{
        className: 'font-sans text-sm shadow-md border border-[--border-default]',
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--ink-primary)',
        },
        success: {
          iconTheme: {
            primary: 'var(--status-approved)',
            secondary: 'white',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--status-rejected)',
            secondary: 'white',
          },
        },
      }}
    />
  )
}
