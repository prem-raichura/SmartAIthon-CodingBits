import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
  hoverable?: boolean
  children?: ReactNode
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hoverable = false, children, className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-surface-dark-card',
          'shadow-sm transition-all duration-200',
          hoverable && [
            'cursor-pointer',
            'hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/10',
            'dark:hover:shadow-black/30',
          ],
          paddingStyles[padding],
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SlotProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

const CardHeader = forwardRef<HTMLDivElement, SlotProps>(
  ({ children, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 mb-4', className)}
      {...rest}
    >
      {children}
    </div>
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }>(
  ({ children, className, ...rest }, ref) => (
    <h3
      ref={ref}
      className={cn('text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', className)}
      {...rest}
    >
      {children}
    </h3>
  ),
)
CardTitle.displayName = 'CardTitle'

const CardContent = forwardRef<HTMLDivElement, SlotProps>(
  ({ children, className, ...rest }, ref) => (
    <div ref={ref} className={cn('', className)} {...rest}>
      {children}
    </div>
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, SlotProps>(
  ({ children, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardContent, CardFooter }
