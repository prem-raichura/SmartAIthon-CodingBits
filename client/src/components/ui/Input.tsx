import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2 text-sm',
              'text-gray-900 placeholder:text-gray-400',
              'dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600',
              'outline-none transition-all duration-150',
              'focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan',
              error
                ? 'border-critical-400 dark:border-critical-600 focus:ring-critical-300/50'
                : 'border-gray-300 dark:border-gray-700',
              icon ? 'pl-9' : 'pl-3',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            {...rest}
          />
        </div>

        {error && (
          <p className="text-xs text-critical-600 dark:text-critical-400">{error}</p>
        )}

        {hint && !error && (
          <p className="text-xs text-gray-500 dark:text-gray-500">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
