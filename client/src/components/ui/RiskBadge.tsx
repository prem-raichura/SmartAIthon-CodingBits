import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import type { RiskLevel } from '../../types'
import { cn, getRiskBg } from '../../lib/utils'

export interface RiskBadgeProps {
  level: RiskLevel
  showIcon?: boolean
  className?: string
}

const iconMap: Record<RiskLevel, typeof AlertTriangle> = {
  Critical: AlertTriangle,
  High:     AlertCircle,
  Medium:   Info,
  Low:      CheckCircle,
}

const glowMap: Record<RiskLevel, string> = {
  Critical: 'animate-pulse-glow',
  High:     '',
  Medium:   '',
  Low:      '',
}

export function RiskBadge({ level, showIcon = true, className }: RiskBadgeProps) {
  const Icon = iconMap[level]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-none',
        'border',
        getRiskBg(level),
        glowMap[level],
        // border colors per level
        level === 'Critical' && 'border-critical-300 dark:border-critical-700',
        level === 'High'     && 'border-high-300 dark:border-high-700',
        level === 'Medium'   && 'border-medium-300 dark:border-medium-700',
        level === 'Low'      && 'border-low-300 dark:border-low-700',
        className,
      )}
    >
      {showIcon && <Icon size={11} className="flex-shrink-0" aria-hidden="true" />}
      {level}
    </span>
  )
}
