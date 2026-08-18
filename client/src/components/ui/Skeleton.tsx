import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Height in Tailwind units, e.g. 'h-4' (default) */
  height?: string
  /** Width in Tailwind units, e.g. 'w-full' (default) */
  width?: string
  /** Use 'circle' for avatar-style skeletons */
  variant?: 'rect' | 'circle' | 'text'
}

export function Skeleton({
  height = 'h-4',
  width = 'w-full',
  variant = 'rect',
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'bg-gray-200 dark:bg-gray-800',
        variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded' : 'rounded-lg',
        height,
        width,
        className,
      )}
      aria-hidden="true"
      {...rest}
    >
      {/* Shimmer sweep */}
      <div
        className={cn(
          'absolute inset-0 animate-shimmer',
          'bg-gradient-to-r from-transparent via-white/40 to-transparent',
          'dark:via-white/10',
        )}
      />
    </div>
  )
}

// Convenience: a block of multiple skeleton lines
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="h-4"
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
          variant="text"
        />
      ))}
    </div>
  )
}
