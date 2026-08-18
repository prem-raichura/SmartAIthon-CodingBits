import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

const sizeTrack = { sm: 'h-5 w-9', md: 'h-6 w-11' }
const sizeThumb = { sm: 'h-4 w-4', md: 'h-5 w-5' }
const thumbTranslate = { sm: 'translate-x-4', md: 'translate-x-5' }

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'group inline-flex items-start gap-3 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 focus-visible:ring-offset-1 rounded',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Track */}
      <span
        className={cn(
          'relative inline-flex flex-shrink-0 items-center rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          sizeTrack[size],
          checked
            ? 'bg-brand-cyan'
            : 'bg-gray-200 dark:bg-gray-700',
        )}
      >
        {/* Thumb */}
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-sm',
            'transform transition duration-200 ease-in-out',
            sizeThumb[size],
            checked ? thumbTranslate[size] : 'translate-x-0',
          )}
        />
      </span>

      {/* Label */}
      {(label || description) && (
        <span className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
