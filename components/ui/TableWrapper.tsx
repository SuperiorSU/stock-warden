'use client'

import { forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TableWrapperProps {
  children: React.ReactNode
  className?: string
  stackOnMobile?: boolean
}

export const TableWrapper = forwardRef<HTMLDivElement, TableWrapperProps>(
  ({ children, className, stackOnMobile = false }, forwardedRef) => {
    const innerRef = useRef<HTMLDivElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLDivElement>) ?? innerRef

    useEffect(() => {
      const el = ref.current
      if (!el) return

      const checkScroll = () => {
        el.classList.toggle('is-scrollable', el.scrollWidth > el.clientWidth)
      }

      checkScroll()
      const ro = new ResizeObserver(checkScroll)
      ro.observe(el)
      return () => ro.disconnect()
    }, [ref])

    return (
      <div
        ref={ref}
        className={cn(
          'w-full overflow-x-auto',
          stackOnMobile && 'stack-table',
          className
        )}
      >
        {children}
      </div>
    )
  }
)
TableWrapper.displayName = 'TableWrapper'
