import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'default'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children?: ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  critical: [
    'bg-critical-100 text-critical-700 border border-critical-200',
    'dark:bg-critical-900/30 dark:text-critical-400 dark:border-critical-800',
    'animate-pulse-glow',
  ].join(' '),
  high: [
    'bg-high-100 text-high-700 border border-high-200',
    'dark:bg-high-900/30 dark:text-high-400 dark:border-high-800',
  ].join(' '),
  medium: [
    'bg-medium-100 text-medium-700 border border-medium-200',
    'dark:bg-medium-900/30 dark:text-medium-400 dark:border-medium-800',
  ].join(' '),
  low: [
    'bg-low-100 text-low-700 border border-low-200',
    'dark:bg-low-900/30 dark:text-low-400 dark:border-low-800',
  ].join(' '),
  info: [
    'bg-blue-100 text-blue-700 border border-blue-200',
    'dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  ].join(' '),
  success: [
    'bg-low-100 text-low-700 border border-low-200',
    'dark:bg-low-900/30 dark:text-low-400 dark:border-low-800',
  ].join(' '),
  default: [
    'bg-gray-100 text-gray-600 border border-gray-200',
    'dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  ].join(' '),
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', children, className, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          'leading-none whitespace-nowrap',
          variantStyles[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </span>
    )
  },
)

Badge.displayName = 'Badge'

export { Badge }
