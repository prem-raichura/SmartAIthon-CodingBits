import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RiskLevel } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN')
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'Critical': return 'text-critical-600 dark:text-critical-400'
    case 'High':     return 'text-high-600 dark:text-high-400'
    case 'Medium':   return 'text-medium-600 dark:text-medium-400'
    case 'Low':      return 'text-low-600 dark:text-low-400'
  }
}

export function getRiskBg(level: RiskLevel): string {
  switch (level) {
    case 'Critical': return 'bg-critical-100 text-critical-700 dark:bg-critical-900/30 dark:text-critical-400'
    case 'High':     return 'bg-high-100 text-high-700 dark:bg-high-900/30 dark:text-high-400'
    case 'Medium':   return 'bg-medium-100 text-medium-700 dark:bg-medium-900/30 dark:text-medium-400'
    case 'Low':      return 'bg-low-100 text-low-700 dark:bg-low-900/30 dark:text-low-400'
  }
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
