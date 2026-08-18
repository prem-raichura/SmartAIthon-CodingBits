import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: TooltipPosition
  delay?: number
  className?: string
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
}

const arrowStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45',
  left: 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45',
  right: 'right-full top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45',
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  // Unmounting while hovered (e.g. the sidebar collapsing) otherwise leaves a
  // pending timer that fires setState on a dead component.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {visible && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap',
            'rounded-md px-2.5 py-1.5 text-xs font-medium',
            'bg-gray-900 text-gray-100 dark:bg-gray-700 dark:text-gray-100',
            'shadow-lg',
            'animate-fade-in-up',
            positionStyles[position],
            className,
          )}
        >
          {content}

          {/* Arrow */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute h-2 w-2 bg-gray-900 dark:bg-gray-700',
              arrowStyles[position],
            )}
          />
        </span>
      )}
    </span>
  )
}
