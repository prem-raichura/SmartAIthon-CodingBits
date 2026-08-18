import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { animate } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn, formatNumber, formatPercent } from '../../lib/utils'

export type StatCardColor = 'blue' | 'cyan' | 'red' | 'orange' | 'yellow' | 'green' | 'purple'

export interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  /** Percentage change from previous period — positive = up, negative = down */
  trend?: number
  trendLabel?: string
  color?: StatCardColor
  /** If true, shows value as a percentage string */
  isPercent?: boolean
  /** Override the formatted value display entirely */
  displayValue?: string
  suffix?: string
  className?: string
  children?: ReactNode
}

const colorMap: Record<StatCardColor, { icon: string; glow: string; bg: string }> = {
  blue:   { icon: 'text-brand-600 dark:text-brand-400',   glow: 'shadow-brand-600/20',   bg: 'bg-brand-50 dark:bg-brand-950' },
  cyan:   { icon: 'text-brand-cyan dark:text-brand-cyan',  glow: 'shadow-brand-cyan/20',  bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  red:    { icon: 'text-critical-600 dark:text-critical-400', glow: 'shadow-critical-600/20', bg: 'bg-critical-50 dark:bg-critical-950/30' },
  orange: { icon: 'text-high-600 dark:text-high-400',     glow: 'shadow-high-600/20',    bg: 'bg-high-50 dark:bg-high-950/20' },
  yellow: { icon: 'text-medium-600 dark:text-medium-400', glow: 'shadow-medium-600/20',  bg: 'bg-medium-50 dark:bg-medium-950/20' },
  green:  { icon: 'text-low-600 dark:text-low-400',       glow: 'shadow-low-600/20',     bg: 'bg-low-50 dark:bg-low-950/30' },
  purple: { icon: 'text-purple-600 dark:text-purple-400', glow: 'shadow-purple-600/20',  bg: 'bg-purple-50 dark:bg-purple-950/30' },
}

function AnimatedValue({ to, isPercent, displayValue, suffix }: {
  to: number
  isPercent?: boolean
  displayValue?: string
  suffix?: string
}) {
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (displayValue) {
      setDisplay(displayValue)
      return
    }
    const controls = animate(0, to, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        const rounded = Math.round(v)
        setDisplay(isPercent ? formatPercent(rounded, 0) : formatNumber(rounded))
      },
    })
    return controls.stop
  }, [to, isPercent, displayValue])

  return (
    <span>
      {display}
      {suffix && !displayValue && (
        <span className="text-base font-normal text-gray-400 ml-1">{suffix}</span>
      )}
    </span>
  )
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'blue',
  isPercent = false,
  displayValue,
  suffix,
  className,
  children,
}: StatCardProps) {
  const colors = colorMap[color]

  const trendPositive = trend !== undefined && trend > 0
  const trendNegative = trend !== undefined && trend < 0
  const trendNeutral = trend !== undefined && trend === 0

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-surface-dark-card',
        'shadow-sm p-5 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>

          <p className={cn('mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100')}>
            <AnimatedValue
              to={value}
              isPercent={isPercent}
              displayValue={displayValue}
              suffix={suffix}
            />
          </p>

          {/* Trend */}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1.5">
              {trendPositive && (
                <>
                  <TrendingUp size={13} className="text-low-500" />
                  <span className="text-xs font-medium text-low-600 dark:text-low-400">
                    +{formatPercent(Math.abs(trend))}
                  </span>
                </>
              )}
              {trendNegative && (
                <>
                  <TrendingDown size={13} className="text-critical-500" />
                  <span className="text-xs font-medium text-critical-600 dark:text-critical-400">
                    -{formatPercent(Math.abs(trend))}
                  </span>
                </>
              )}
              {trendNeutral && (
                <>
                  <Minus size={13} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">0%</span>
                </>
              )}
              {trendLabel && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        <div className={cn('flex-shrink-0 rounded-xl p-3 shadow-sm', colors.bg, colors.glow)}>
          <Icon size={20} className={colors.icon} />
        </div>
      </div>

      {children}
    </div>
  )
}
