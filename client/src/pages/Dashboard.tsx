import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, AlertTriangle, Activity, UserPlus,
  GitBranch, Share2, ChevronDown, ChevronUp, ArrowRight, Search,
} from 'lucide-react'
import {
  AreaChart, Area,
  ComposedChart, Bar, Line,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTip, Brush,
} from 'recharts'
import { StatCard } from '../components/ui/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskBadge } from '../components/ui/RiskBadge'
import { Badge } from '../components/ui/Badge'
import {
  useDashboardKPIs, useHotspots, useEDIExplanations,
  useTimeseries, useViolations, useVehicles,
} from '../hooks/useMockData'
import { cn, formatNumber } from '../lib/utils'
import type { EDIExplanation, Hotspot, TimeseriesData, ViolationType, VehicleType, MonthlyPoint } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER  = ['Nov-23', 'Dec-23', 'Jan-24', 'Feb-24', 'Mar-24', 'Apr-24']
const DOW_ORDER    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DONUT_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#ef4444', '#0ea5e9', '#a855f7', '#f43f5e',
]
const RADIAL_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#f97316', '#ef4444']

type Period = 'month' | 'week' | '2d' | '3d' | '4d'
const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Monthly' },
  { id: 'week',  label: 'Weekly'  },
  { id: '2d',    label: '2 Days'  },
  { id: '3d',    label: '3 Days'  },
  { id: '4d',    label: '4 Days'  },
]

const EDI_TABS = [
  { id: 'anomaly', label: 'Anomaly Alerts',  icon: TrendingUp },
  { id: 'impact',  label: 'Impact Forecast', icon: GitBranch  },
  { id: 'cascade', label: 'Cascade Risk',    icon: Share2     },
] as const
type EDITabId = typeof EDI_TABS[number]['id']

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >{children}</motion.div>
  )
}

function SlideUp({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >{children}</motion.div>
  )
}

function SectionCard({ title, subtitle, children, className, action }: {
  title: string; subtitle?: string; children: React.ReactNode
  className?: string; action?: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-gray-200 dark:border-gray-800',
      'bg-white/80 dark:bg-surface-dark-card/80 backdrop-blur-sm shadow-sm overflow-hidden',
      className,
    )}>
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD FILTER
// ─────────────────────────────────────────────────────────────────────────────

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl
                    bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
      {PERIODS.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)}
          className={cn(
            'relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150',
            value === id ? 'text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          {value === id && (
            <motion.div layoutId="period-pill"
              className="absolute inset-0 rounded-lg shadow-md"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERED TREND CHART
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_GRAD: Record<Period, [string, string]> = {
  month: ['#1e3a8a', '#06b6d4'],
  week:  ['#7c3aed', '#06b6d4'],
  '2d':  ['#059669', '#06b6d4'],
  '3d':  ['#d97706', '#f97316'],
  '4d':  ['#dc2626', '#f97316'],
}

function getFilteredData(ts: TimeseriesData, period: Period) {
  if (period === 'month') return {
    data: [...ts.monthly].sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month)),
    xKey: 'month',
  }
  if (period === 'week') return {
    data: [...ts.daily].sort((a, b) => DOW_ORDER.indexOf(a.day) - DOW_ORDER.indexOf(b.day)),
    xKey: 'day',
  }
  const n = period === '2d' ? 2 : period === '3d' ? 3 : 4
  return { data: ts.daily_trend.slice(-n), xKey: 'date' }
}

function FilteredTrendChart({ ts, period }: { ts: TimeseriesData; period: Period }) {
  const { data, xKey } = useMemo(() => getFilteredData(ts, period), [ts, period])
  const [c1, c2] = PERIOD_GRAD[period]
  const gId = `fg-${period}`, lId = `fl-${period}`

  return (
    <div className="px-4 pb-4 pt-2 h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data as unknown as MonthlyPoint[]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={c2} stopOpacity={0.45} />
              <stop offset="95%" stopColor={c2} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={lId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={xKey === 'date' ? (d: string) => d.slice(5) : undefined} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <RechartsTip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatNumber(payload[0].value as number)} tickets</p>
              </div>
            )
          }} />
          <Area key={period} type="monotone" dataKey="tickets"
            stroke={`url(#${lId})`} strokeWidth={2.5} fill={`url(#${gId})`}
            dot={{ fill: c2, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: c2, stroke: '#fff', strokeWidth: 2 }}
            animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDI: ANOMALY TAB — SVG ring gauges, click to navigate, all zones scrollable
// ─────────────────────────────────────────────────────────────────────────────

function AnomalyTab({ edis }: { edis: EDIExplanation[] }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-3">
      {edis.map((e, i) => {
        const z     = e.anomaly_alert.z_score
        const pct   = Math.min(Math.abs(z) / 3, 1)
        const color = z > 2 ? '#ef4444' : z > 1 ? '#f97316' : '#06b6d4'
        const isHigh = e.anomaly_alert.level === 'High'
        const r = 22, circ = 2 * Math.PI * r

        return (
          <motion.div key={e.hotspot_id}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.06, 0.4) }}
            onClick={() => navigate('/hotspots', { state: { hotspotId: e.hotspot_id } })}
            className={cn(
              'flex items-center gap-4 p-3.5 rounded-2xl border cursor-pointer',
              'transition-all duration-150 hover:scale-[1.01] hover:shadow-md',
              isHigh
                ? 'border-high-200 bg-high-50/50 dark:border-high-800/60 dark:bg-high-950/20'
                : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/30',
            )}
          >
            {/* SVG ring */}
            <div className="relative flex-shrink-0 w-14 h-14">
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(156,163,175,0.2)" strokeWidth="5" />
                <motion.circle cx="28" cy="28" r={r} fill="none"
                  stroke={color} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: circ * (1 - pct) }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 + Math.min(i * 0.05, 0.3) }}
                  style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black leading-none" style={{ color }}>{z.toFixed(1)}σ</span>
              </div>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 truncate">{e.hotspot_id}</span>
                <Badge variant={isHigh ? 'high' : 'default'}>{e.anomaly_alert.level}</Badge>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{e.anomaly_alert.message}</p>
            </div>
            {/* Navigate arrow */}
            <ArrowRight size={13} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </motion.div>
        )
      })}
      {edis.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-8">No zones match your search</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDI: IMPACT TAB — animated comparison bars, all zones
// ─────────────────────────────────────────────────────────────────────────────

function ImpactTab({ edis }: { edis: EDIExplanation[] }) {
  return (
    <div className="space-y-5">
      {edis.map((e, i) => {
        const enf  = e.impact_forecast.if_enforced.predicted_violations
        const noE  = e.impact_forecast.if_not_enforced.predicted_violations
        const maxV = Math.max(enf, noE)
        return (
          <motion.div key={e.hotspot_id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.06, 0.4) }}
            className="space-y-2 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{e.hotspot_id}</span>
              <span className="text-[10px] font-bold text-low-600 dark:text-low-400
                             bg-low-50 dark:bg-low-950/30 px-2 py-0.5 rounded-full
                             border border-low-100 dark:border-low-900/50">
                ↓{e.impact_forecast.if_enforced.reduction_pct}% with enforcement
              </span>
            </div>
            {/* Enforced bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-low-600 dark:text-low-400 w-[68px] flex-shrink-0">Enforced</span>
              <div className="flex-1 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2"
                  style={{ background: 'linear-gradient(90deg, #16a34a, #22c55e)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${(enf / maxV) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 + Math.min(i * 0.05, 0.3) }}
                >
                  <span className="text-white text-[10px] font-bold">{enf}</span>
                </motion.div>
              </div>
            </div>
            {/* No-action bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-critical-600 dark:text-critical-400 w-[68px] flex-shrink-0">No Action</span>
              <div className="flex-1 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2"
                  style={{ background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${(noE / maxV) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + Math.min(i * 0.05, 0.3) }}
                >
                  <span className="text-white text-[10px] font-bold">{noE}</span>
                </motion.div>
              </div>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-low-600 dark:text-low-400 font-medium">Blockage (enforced): {e.impact_forecast.if_enforced.blockage_pct}%</span>
              <span className="text-critical-600 dark:text-critical-400 font-medium">(no action): {e.impact_forecast.if_not_enforced.blockage_pct}%</span>
            </div>
          </motion.div>
        )
      })}
      {edis.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-8">No zones match your search</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDI: CASCADE TAB — SVG ripple network, all zones
// ─────────────────────────────────────────────────────────────────────────────

function CascadeRipple({ hotspotId, c, idx }: {
  hotspotId: string
  c: EDIExplanation['cascade_risk']
  idx: number
}) {
  const corrColor = c.correlation > 0.65 ? '#ef4444' : c.correlation > 0.5 ? '#f97316' : '#06b6d4'
  const corrPct   = Math.round(c.correlation * 100)
  const svgW = 170, svgH = 130
  const srcX = 36, srcY = 65
  const maxJunc = Math.min(c.affected_junctions, 5)

  const junctions = Array.from({ length: maxJunc }, (_, i) => {
    const span  = Math.PI * 0.85
    const angle = maxJunc > 1 ? (i / (maxJunc - 1)) * span - span / 2 : 0
    const dist  = 75 + (i % 2) * 12
    return { id: i + 1, x: srcX + dist * Math.cos(angle), y: srcY + dist * Math.sin(angle) }
  })

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/20 p-3.5 mb-3 last:mb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">{hotspotId}</span>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold"
          style={{ borderColor: corrColor, color: corrColor, background: `${corrColor}18` }}>
          {corrPct}% spatial corr.
        </div>
      </div>

      <div className="flex gap-3 items-start">
        {/* SVG Network */}
        <div className="flex-shrink-0">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-[155px] h-[115px]">
            <defs>
              <radialGradient id={`rg${idx}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </radialGradient>
            </defs>

            {/* Ripple rings from source */}
            {[18, 32, 48].map((targetR, ri) => (
              <motion.circle key={ri} cx={srcX} cy={srcY} r={14} fill="none"
                stroke="#1e3a8a" strokeWidth={1} strokeOpacity={0.6}
                initial={{ r: 14, opacity: 0.7 }}
                animate={{ r: targetR, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: ri * 0.75 + idx * 0.4, ease: 'easeOut' }}
              />
            ))}

            {/* Lines + particles */}
            {junctions.map((j, ji) => (
              <g key={j.id}>
                <line x1={srcX} y1={srcY} x2={j.x} y2={j.y}
                  stroke="rgba(6,182,212,0.28)" strokeWidth={1.5} strokeDasharray="5 3" />
                {/* Traveling particle */}
                <motion.circle r={2.5} fill="#06b6d4"
                  animate={{
                    cx: [srcX, j.x, j.x],
                    cy: [srcY, j.y, j.y],
                    opacity: [0.9, 0.9, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: ji * 0.45 + idx * 0.55, ease: 'linear', times: [0, 0.72, 1] }}
                />
                {/* Junction node */}
                <motion.circle cx={j.x} cy={j.y} r={10}
                  fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth={1.5}
                  animate={{ strokeOpacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: ji * 0.35 + idx * 0.6 }}
                />
                <text x={j.x} y={j.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize={6.5} fontWeight="800" fill="#06b6d4">J{j.id}</text>
              </g>
            ))}

            {/* Source */}
            <motion.circle cx={srcX} cy={srcY} r={14} fill={`url(#rg${idx})`}
              stroke="#0369a1" strokeWidth={2}
              animate={{ strokeOpacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.4 }}
            />
            <text x={srcX} y={srcY} textAnchor="middle" dominantBaseline="middle"
              fontSize={6.5} fontWeight="800" fill="white">SRC</text>
          </svg>
        </div>

        {/* Right-side stats */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Correlation bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">Spatial correlation</span>
              <span className="text-[10px] font-black" style={{ color: corrColor }}>{corrPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${corrColor}70, ${corrColor})` }}
                initial={{ width: 0 }}
                animate={{ width: `${c.correlation * 100}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 + idx * 0.08 }}
              />
            </div>
          </div>
          {/* Stat pills */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Prop. lag', value: `${c.lag_minutes}m` },
              { label: 'Junctions', value: c.affected_junctions },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2 text-center">
                <p className="text-sm font-black text-gray-800 dark:text-gray-200">{value}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* Risk gradient bar */}
          <div className="rounded-lg p-2 text-center"
            style={{ background: `linear-gradient(135deg, ${corrColor}18, ${corrColor}30)`, border: `1px solid ${corrColor}40` }}>
            <p className="text-[10px] font-bold" style={{ color: corrColor }}>
              {c.correlation > 0.65 ? '⚠ High cascade risk' : c.correlation > 0.5 ? '◈ Moderate spread risk' : '✓ Low propagation risk'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CascadeTab({ edis }: { edis: EDIExplanation[] }) {
  return (
    <div>
      {edis.map((e, i) => (
        <CascadeRipple key={e.hotspot_id} hotspotId={e.hotspot_id} c={e.cascade_risk} idx={i} />
      ))}
      {edis.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-8">No zones match your search</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDI PANEL — search + all zones + fixed height (aligns with alert feed)
// ─────────────────────────────────────────────────────────────────────────────

function EDIPanel({ edis }: { edis: EDIExplanation[] }) {
  const [activeTab, setActiveTab] = useState<EDITabId>('anomaly')
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () => [...edis].sort((a, b) => b.anomaly_alert.z_score - a.anomaly_alert.z_score),
    [edis],
  )
  const filtered = useMemo(
    () => query.trim() === ''
      ? sorted
      : sorted.filter(e => e.hotspot_id.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  )

  const content: Record<EDITabId, React.ReactNode> = {
    anomaly: <AnomalyTab edis={filtered} />,
    impact:  <ImpactTab  edis={filtered} />,
    cascade: <CascadeTab edis={filtered} />,
  }

  return (
    <SectionCard
      title="Enforcement Intelligence Engine"
      subtitle={`AI-driven anomaly analysis · ${edis.length} hotspot zones`}
      className="h-full flex flex-col"
    >
      {/* Search */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by cluster / zone ID…"
            className="w-full pl-8 pr-4 py-2 text-xs rounded-lg
                       border border-gray-200 dark:border-gray-700
                       bg-gray-50 dark:bg-gray-800/60
                       text-gray-700 dark:text-gray-300 placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 transition"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex border-b border-gray-100 dark:border-gray-800 px-1">
        {EDI_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors duration-150',
                active ? 'text-brand-700 dark:text-brand-cyan' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              <Icon size={13} />
              {label}
              {active && (
                <motion.div layoutId="edi-tab-bar"
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #1e3a8a, #06b6d4)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
        {filtered.length > 0 && (
          <span className="ml-auto self-center mr-3 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
            {filtered.length} zone{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {content[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT FEED — fixed height, scrollable
// ─────────────────────────────────────────────────────────────────────────────

function AlertFeed({ hotspots }: { hotspots: Hotspot[] }) {
  const navigate = useNavigate()
  const sorted = [...hotspots].sort((a, b) => b.congestion_score - a.congestion_score)

  return (
    <SectionCard title="Active Alerts" subtitle={`Top zones by congestion (${sorted.length} total)`}
      className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-800">
        {sorted.map((h, i) => (
          <motion.div key={h.id}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.35) }}
            className={cn(
              'flex items-start gap-3 px-5 py-3.5',
              'hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors duration-150',
              h.risk_level === 'Critical' && 'border-l-2 border-l-critical-500',
            )}
          >
            <div className="flex-shrink-0 mt-0.5"><RiskBadge level={h.risk_level} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-bold font-mono text-gray-900 dark:text-gray-100">{h.id}</span>
                <span className="text-xs font-semibold text-high-600 dark:text-high-400 flex-shrink-0">{h.congestion_score.toFixed(1)}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{h.dominant_junction}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{h.dominant_violation} · {h.dominant_station}</p>
            </div>
            <button
              onClick={() => navigate('/hotspots', { state: { hotspotId: h.id } })}
              className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-brand-cyan hover:text-brand-500 transition-colors mt-0.5"
            >
              View <ArrowRight size={10} />
            </button>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP 15 VIOLATIONS — gradient bars, scrollable
// ─────────────────────────────────────────────────────────────────────────────

const BAR_TIERS = [
  ['#dc2626', '#ef4444'], ['#ea580c', '#f97316'], ['#d97706', '#f59e0b'],
  ['#1e3a8a', '#0369a1'], ['#1e3a8a', '#06b6d4'], ['#0369a1', '#06b6d4'],
  ['#7c3aed', '#8b5cf6'], ['#6d28d9', '#a78bfa'], ['#7c3aed', '#c4b5fd'],
  ['#065f46', '#10b981'], ['#047857', '#34d399'], ['#059669', '#6ee7b7'],
  ['#4338ca', '#818cf8'], ['#3730a3', '#a5b4fc'], ['#4f46e5', '#c7d2fe'],
]

function ViolationsChart({ violations }: { violations: ViolationType[] }) {
  const top15  = violations.slice(0, 15)
  const maxCnt = top15[0]?.count ?? 1

  return (
    <div className="space-y-2.5">
      {top15.map((v, i) => {
        const pct = (v.count / maxCnt) * 100
        const [c1, c2] = BAR_TIERS[i] ?? ['#1e3a8a', '#06b6d4']
        return (
          <motion.div key={v.name}
            initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3"
          >
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-5 text-right flex-shrink-0 font-bold">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate pr-2">
                  {v.name.length > 38 ? v.name.slice(0, 38) + '…' : v.name}
                </span>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex-shrink-0 tabular-nums">{formatNumber(v.count)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                  initial={{ width: '0%' }} whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE DONUT
// ─────────────────────────────────────────────────────────────────────────────

function PieTip({ active, payload, total }: {
  active?: boolean; payload?: Array<{ name: string; value: number; payload: VehicleType }>; total: number
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 text-xs">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1 capitalize">{d.payload.name}</p>
      <p className="text-gray-600 dark:text-gray-300">Count: <span className="font-bold">{formatNumber(d.value)}</span></p>
      <p className="text-gray-500">Share: <span className="font-semibold">{pct}%</span></p>
    </div>
  )
}

function VehicleDonut({ vehicles }: { vehicles: VehicleType[] }) {
  const total   = useMemo(() => vehicles.reduce((s, v) => s + v.count, 0), [vehicles])
  const topFour = useMemo(() => [...vehicles].sort((a, b) => b.count - a.count).slice(0, 4), [vehicles])

  return (
    <div className="px-5 py-4 flex flex-col h-full">
      {/* Donut */}
      <div className="relative flex-shrink-0">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={vehicles} cx="50%" cy="50%" innerRadius={58} outerRadius={88}
              dataKey="count" startAngle={90} endAngle={-270} paddingAngle={2}
              animationBegin={0} animationDuration={900}>
              {vehicles.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <RechartsTip content={<PieTip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-400 leading-none">Total</span>
          <span className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-tight">{formatNumber(total)}</span>
          <span className="text-[10px] text-gray-400 leading-none">violations</span>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-3 space-y-2 flex-1 overflow-y-auto min-h-0">
        {topFour.map((v) => {
          const idx = vehicles.indexOf(v)
          return (
            <div key={v.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
              <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate capitalize flex-1">{v.name}</span>
              <span className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-300">
                {((v.count / total) * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">+{vehicles.length - 4} more types</span>
          <span className="text-[10px] font-semibold text-gray-500">{vehicles.length} categories</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY TREND — ComposedChart: gradient bars + trend line overlay
// ─────────────────────────────────────────────────────────────────────────────

function DailyTrendChart({ ts }: { ts: TimeseriesData }) {
  const data = useMemo(
    () => ts.daily_trend.map(d => ({ ...d, label: d.date.slice(5) })),
    [ts],
  )

  // The brush range is held here so Recharts does not discard the selection on
  // every parent re-render (it is uncontrolled otherwise).
  const [range, setRange] = useState<{ startIndex: number; endIndex: number }>(
    { startIndex: 0, endIndex: Math.max(data.length - 1, 0) },
  )

  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(data.length - 1, 0) })
  }, [data.length])

  return (
    <div className="px-4 pb-4 pt-2 h-[300px] [&_.recharts-brush-traveller]:cursor-ew-resize">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 22, left: 4 }}>
          <defs>
            <linearGradient id="barGradD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={4} />
          <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <RechartsTip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs">
                <p className="text-gray-500 mb-0.5">{label}</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(payload[0].value as number)} tickets</p>
              </div>
            )
          }} />
          <Bar dataKey="tickets" fill="url(#barGradD)" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={900} />
          <Line type="monotone" dataKey="tickets" stroke="#f97316" strokeWidth={1.5} dot={false} activeDot={false} />
          <Brush
            dataKey="label"
            height={24}
            stroke="rgba(148,163,184,0.4)"
            fill="rgba(148,163,184,0.05)"
            travellerWidth={10}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
            onChange={(r) => {
              if (typeof r?.startIndex === 'number' && typeof r?.endIndex === 'number') {
                setRange({ startIndex: r.startIndex, endIndex: r.endIndex })
              }
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY-OF-WEEK — RadialBarChart (concentric arcs, one per day)
// ─────────────────────────────────────────────────────────────────────────────

function DayOfWeekRadial({ ts }: { ts: TimeseriesData }) {
  const data = useMemo(() =>
    DOW_ORDER.map((day, i) => {
      const d = ts.daily.find(x => x.day === day)
      return { name: day, tickets: d?.tickets ?? 0, fill: RADIAL_COLORS[i] }
    }),
    [ts],
  )

  return (
    <div className="h-[300px] flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="52%"
            innerRadius="14%" outerRadius="82%"
            data={data}
            startAngle={90} endAngle={-270}
            barCategoryGap="6%"
          >
            <RadialBar
              dataKey="tickets"
              background={{ fill: 'rgba(156,163,175,0.08)' }}
              cornerRadius={5}
              animationDuration={1000}
              label={false}
            />
            <RechartsTip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = (payload[0].payload as { name: string; tickets: number })
              return (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs">
                  <p className="font-bold text-gray-900 dark:text-gray-100 mb-0.5">{row.name}</p>
                  <p className="text-gray-500">{formatNumber(row.tickets)} tickets</p>
                </div>
              )
            }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      {/* Day legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center px-4 pb-3">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOURLY DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  if (h === 0)  return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function HourlyChart({ ts }: { ts: TimeseriesData }) {
  const data = useMemo(() => ts.hourly.map(h => ({ ...h, label: formatHour(h.hour) })), [ts])
  return (
    <div className="px-4 pb-4 pt-2 h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.38} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" />
          <XAxis dataKey="label" interval={3} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <RechartsTip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs">
                <p className="text-gray-500 mb-0.5">{label}</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(payload[0].value as number)} tickets</p>
              </div>
            )
          }} cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="tickets" stroke="#8b5cf6" strokeWidth={2.5}
            fill="url(#hourGrad)" dot={false}
            activeDot={{ r: 5, fill: '#8b5cf6', stroke: 'white', strokeWidth: 2 }}
            animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTSPOTS TABLE
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_COLS = ['#', 'Hotspot ID', 'Junction', 'Station', 'Risk', 'Pred 24h', 'Z-Score', 'Anomaly', 'Action']

function HotspotsTable({ hotspots }: { hotspots: Hotspot[] }) {
  const navigate  = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const sorted  = [...hotspots].sort((a, b) => b.congestion_score - a.congestion_score)
  const visible = expanded ? sorted : sorted.slice(0, 5)

  return (
    <SectionCard title="Top Critical Hotspots" subtitle="Ranked by congestion score"
      action={<span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{hotspots.length} zones</span>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {TABLE_COLS.map((col) => (
                <th key={col} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visible.map((h, i) => (
                <motion.tr key={h.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.035 }}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors duration-100"
                >
                  <td className="px-4 py-3 font-mono text-gray-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-800 dark:text-gray-200">{h.id}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[180px]">
                    <span className="block truncate">{h.dominant_junction}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{h.dominant_station}</td>
                  <td className="px-4 py-3"><RiskBadge level={h.risk_level} /></td>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{h.predicted_24h}</td>
                  <td className="px-4 py-3 font-mono">
                    <span className={h.z_score > 2 ? 'text-critical-600 dark:text-critical-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                      {h.z_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge variant={h.anomaly === 'High' ? 'high' : 'default'}>{h.anomaly}</Badge></td>
                  <td className="px-4 py-3">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/hotspots', { state: { hotspotId: h.id } })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold
                                 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40
                                 border border-brand-200 dark:border-brand-800
                                 hover:bg-brand-100 dark:hover:bg-brand-950/60 transition-colors duration-150"
                    >
                      View <ArrowRight size={9} />
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      {sorted.length > 5 && (
        <button onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium
                     text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300
                     border-t border-gray-100 dark:border-gray-800 transition-colors duration-150"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show less' : `Show ${sorted.length - 5} more`}
        </button>
      )}
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEADER + KPI ROW
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <FadeUp className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight"
          style={{ background: 'linear-gradient(90deg, #1e3a8a, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >Command Center</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time parking enforcement intelligence</p>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                     border border-low-200 dark:border-low-800 bg-low-50 dark:bg-low-950/30 text-low-700 dark:text-low-400">
        <span className="w-1.5 h-1.5 rounded-full bg-low-500 animate-pulse" />
        Live
      </div>
    </FadeUp>
  )
}

function KPIRow({ total, critical_zones, avg_congestion_score, pending_approvals }: {
  total: number; critical_zones: number; avg_congestion_score: number; pending_approvals: number
}) {
  return (
    <FadeUp delay={0.08} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard title="Total Violations Analyzed" value={total} icon={TrendingUp}   color="blue"   trend={8.2} trendLabel="vs prev. period" />
      <StatCard title="Critical Zones"             value={critical_zones}            icon={AlertTriangle} color="red" trend={-1} trendLabel="from last scan" />
      <StatCard title="Avg Congestion Score"       value={avg_congestion_score ?? 0} icon={Activity} color="orange" displayValue={(avg_congestion_score ?? 0).toFixed(1)} />
      <StatCard title="Pending Approvals"          value={pending_approvals}         icon={UserPlus} color="cyan" />
    </FadeUp>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useEffect(() => { document.title = 'Command Center — ParkVUE' }, [])

  const [period, setPeriod] = useState<Period>('month')

  const { data: kpis,       loading: kpiLoad  } = useDashboardKPIs()
  const { data: hotspots,   loading: hotLoad  } = useHotspots()
  const { data: edis,       loading: ediLoad  } = useEDIExplanations()
  const { data: timeseries, loading: tsLoad   } = useTimeseries()
  const { data: violations, loading: vLoad    } = useViolations()
  const { data: vehicles,   loading: vhLoad   } = useVehicles()

  const analyticsLoading = tsLoad || vLoad || vhLoad

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-6">

      <PageHeader />

      {/* KPI row */}
      {kpiLoad || !kpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-28" />)}
        </div>
      ) : (
        <KPIRow total={kpis.total_violations} critical_zones={kpis.critical_zones}
          avg_congestion_score={kpis.avg_congestion_score} pending_approvals={kpis.pending_approvals} />
      )}

      {/* Period filter + trend */}
      <FadeUp delay={0.12}>
        {tsLoad || !timeseries ? <Skeleton height="h-[300px]" /> : (
          <SectionCard
            title="Violation Trend Analysis"
            subtitle="Toggle the filter to explore monthly, weekly or day-wise patterns"
            action={<PeriodFilter value={period} onChange={setPeriod} />}
          >
            <FilteredTrendChart ts={timeseries} period={period} />
          </SectionCard>
        )}
      </FadeUp>

      {/* EDI Panel + Alert Feed — both fixed 580 px height, internally scrollable */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <FadeUp delay={0.15} className="lg:col-span-7">
          <div className="h-[580px]">
            {ediLoad || !edis
              ? <Skeleton height="h-full" />
              : <EDIPanel edis={edis} />
            }
          </div>
        </FadeUp>
        <FadeUp delay={0.22} className="lg:col-span-5">
          <div className="h-[580px]">
            {hotLoad || !hotspots
              ? <Skeleton height="h-full" />
              : <AlertFeed hotspots={hotspots} />
            }
          </div>
        </FadeUp>
      </div>

      {/* Section divider */}
      <SlideUp delay={0.04}>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3">Operational Analytics</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
        </div>
      </SlideUp>

      {/* Top Violations + Vehicle Distribution — equal 500 px height */}
      {analyticsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="h-[500px]" /><Skeleton height="h-[500px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SlideUp delay={0.05}>
            <div className="h-[500px]">
              <SectionCard title="Top 15 Violation Types" subtitle="Ranked by case count — Wrong & No Parking dominate"
                className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
                  <ViolationsChart violations={violations!} />
                </div>
              </SectionCard>
            </div>
          </SlideUp>
          <SlideUp delay={0.1}>
            <div className="h-[500px]">
              <SectionCard title="Vehicle Type Distribution" subtitle={`Total vehicle categories: ${vehicles!.length}`}
                className="h-full flex flex-col">
                <VehicleDonut vehicles={vehicles!} />
              </SectionCard>
            </div>
          </SlideUp>
        </div>
      )}

      {/* Daily Violation Trend — ComposedChart */}
      {tsLoad || !timeseries ? <Skeleton height="h-[360px]" /> : (
        <SlideUp delay={0.06}>
          <SectionCard title="Daily Violation Trend — Last 30 Days"
            subtitle="Bars = daily count · Orange line = trend overlay · Drag brush to zoom">
            <DailyTrendChart ts={timeseries} />
          </SectionCard>
        </SlideUp>
      )}

      {/* Day-of-Week Radial + Hourly Area */}
      {tsLoad || !timeseries ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="h-[360px]" /><Skeleton height="h-[360px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SlideUp delay={0.04}>
            <SectionCard title="Day-of-Week Pattern"
              subtitle="Concentric arcs — each ring = one day, arc length = ticket volume">
              <DayOfWeekRadial ts={timeseries} />
            </SectionCard>
          </SlideUp>
          <SlideUp delay={0.08}>
            <SectionCard title="Hourly Distribution" subtitle="When violations are filed throughout the day">
              <HourlyChart ts={timeseries} />
            </SectionCard>
          </SlideUp>
        </div>
      )}

      {/* Hotspots table */}
      <SlideUp delay={0.04}>
        {hotLoad || !hotspots ? <Skeleton height="h-64" /> : <HotspotsTable hotspots={hotspots} />}
      </SlideUp>

    </div>
  )
}
