import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-r from-brand-900 to-brand-cyan text-white',
    'hover:opacity-90 hover:shadow-lg hover:shadow-brand-cyan/20',
    'disabled:opacity-50 disabled:shadow-none',
  ].join(' '),
  secondary: [
    'bg-gray-100 text-gray-800 border border-gray-200',
    'dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
    'hover:bg-gray-200 dark:hover:bg-gray-700',
    'disabled:opacity-50',
  ].join(' '),
  ghost: [
    'bg-transparent text-gray-600 dark:text-gray-400',
    'hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100',
    'disabled:opacity-50',
  ].join(' '),
  danger: [
    'bg-critical-600 text-white',
    'hover:bg-critical-700 hover:shadow-lg hover:shadow-critical-600/20',
    'disabled:opacity-50 disabled:shadow-none',
  ].join(' '),
  icon: [
    'bg-transparent text-gray-500 dark:text-gray-400',
    'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    'disabled:opacity-50',
  ].join(' '),
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2.5',
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 w-7 p-0',
  md: 'h-9 w-9 p-0',
  lg: 'h-11 w-11 p-0',
}

const spinnerSize: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 16 }

const MotionButton = motion.create('button')

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      children,
      className,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isIcon = variant === 'icon'

    return (
      <MotionButton
        ref={ref}
        type={type}
        disabled={disabled || loading}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.1 }}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 focus-visible:ring-offset-1',
          'transition-all duration-150 select-none',
          'disabled:cursor-not-allowed',
          variantStyles[variant],
          isIcon ? iconSizeStyles[size] : sizeStyles[size],
          className,
        )}
        {...(rest as Record<string, unknown>)}
      >
        {loading ? (
          <Loader2 size={spinnerSize[size]} className="animate-spin" />
        ) : (
          children
        )}
      </MotionButton>
    )
  },
)

Button.displayName = 'Button'

export { Button }
