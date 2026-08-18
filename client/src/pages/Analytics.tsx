import { useRef, useState, useMemo, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTip,
  Brush,
} from 'recharts'
import { Calendar, Info, AlertTriangle, TrendingUp, Activity, Brain, Clock, Zap, ShieldCheck } from 'lucide-react'
import {
  useTimeseries,
  useViolations,
  useVehicles,
  useHotspots,
  useEDIExplanations,
  useDashboardKPIs,
} from '../hooks/useMockData'
import { Skeleton } from '../components/ui/Skeleton'
import { cn, formatNumber } from '../lib/utils'
import type { ReactNode } from 'react'
import type { FunnelData, Station, ViolationType, VehicleType, TimeseriesData } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_CYAN = '#06b6d4'
const BRAND_BLUE = '#1e3a8a'

const DONUT_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#ef4444', '#0ea5e9', '#a855f7', '#f43f5e',
]

const DAY_COLOR: Record<string, string> = {
  Sun: '#ef4444', Sat: '#f97316',
  Mon: BRAND_CYAN, Tue: BRAND_CYAN, Wed: BRAND_CYAN, Thu: BRAND_CYAN, Fri: BRAND_CYAN,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function approvalColor(rate: number): string {
  if (rate < 0.33) return '#ef4444'
  if (rate < 0.40) return '#f97316'
  if (rate < 0.46) return '#eab308'
  return '#22c55e'
}

function formatHour(h: number): string {
  if (h === 0)  return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function SectionCard({ title, subtitle, children, className }: {
  title:     string
  subtitle?: string
  children:  ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-gray-200 dark:border-gray-800',
      'bg-white dark:bg-surface-dark-card overflow-hidden',
      className,
    )}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FadeUp({ children, delay = 0, className }: {
  children:   ReactNode
  delay?:     number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function GenericTip({ active, payload, label, xLabel, yLabel, yFmt }: {
  active?:  boolean
  payload?: Array<{ value: number }>
  label?:   string | number
  xLabel?:  string
  yLabel?:  string
  yFmt?:    (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">
        {xLabel ? `${xLabel}: ` : ''}{label}
      </p>
      <p className="text-gray-600 dark:text-gray-300">
        {yLabel ?? 'Tickets'}: <span className="font-bold">{yFmt ? yFmt(v) : formatNumber(v)}</span>
      </p>
    </div>
  )
}

function StationTip({ active, payload }: {
  active?:  boolean
  payload?: Array<{ payload: { name: string; approval_rate: number; total_tickets: number } }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs max-w-[200px]">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">{d.name}</p>
      <p className="text-gray-600 dark:text-gray-300">
        Approval: <span className="font-bold" style={{ color: approvalColor(d.approval_rate) }}>
          {(d.approval_rate * 100).toFixed(1)}%
        </span>
      </p>
      <p className="text-gray-500 mt-0.5">
        Total tickets: <span className="font-semibold">{formatNumber(d.total_tickets)}</span>
      </p>
    </div>
  )
}

function PieTip({ active, payload, total }: {
  active?:  boolean
  payload?: Array<{ name: string; value: number; payload: VehicleType }>
  total:    number
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1 capitalize">
        {d.payload.name}
      </p>
      <p className="text-gray-600 dark:text-gray-300">
        Count: <span className="font-bold">{formatNumber(d.value)}</span>
      </p>
      <p className="text-gray-500">Share: <span className="font-semibold">{pct}%</span></p>
    </div>
  )
}

// ─── Validation Funnel ────────────────────────────────────────────────────────

export function ValidationFunnel({ funnel }: { funnel: FunnelData }) {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-5%' })

  const stages = useMemo(() => [
    { label: 'Total Uploaded', count: funnel.total,                        color: BRAND_BLUE },
    { label: 'Reviewed',       count: funnel.reviewed,                     color: '#0369a1' },
    { label: 'Approved',       count: funnel.approved,                     color: '#22c55e' },
    { label: 'Sent to SCITA',  count: funnel.approved - funnel.processing, color: '#8b5cf6' },
  ], [funnel])

  return (
    <div ref={ref} className="space-y-2.5">
      {stages.map((stage, i) => {
        const pct  = stage.count / stages[0].count
        const drop = i > 0
          ? ((1 - stage.count / stages[i - 1].count) * 100).toFixed(1)
          : null

        return (
          <div key={stage.label}>
            {/* Drop indicator */}
            {drop && (
              <div className="flex justify-center my-1">
                <span className="text-[10px] font-bold text-red-400 dark:text-red-500
                                 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border
                                 border-red-100 dark:border-red-900/50">
                  ▼ -{drop}%
                </span>
              </div>
            )}

            {/* Stage row */}
            <div className="flex items-center gap-3">
              {/* Label */}
              <div className="w-[108px] flex-shrink-0 text-right">
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                  {stage.label}
                </span>
              </div>

              {/* Bar */}
              <div className="flex-1 h-11 relative">
                <div className="absolute inset-0 rounded-lg bg-gray-100 dark:bg-gray-800" />
                <motion.div
                  className="absolute inset-y-0 rounded-lg flex items-center justify-end pr-3"
                  style={{ background: stage.color }}
                  initial={{ width: '0%', left: `${(1 - pct) * 50}%` }}
                  animate={
                    inView
                      ? { width: `${pct * 100}%`, left: `${(1 - pct) * 50}%` }
                      : {}
                  }
                  transition={{ duration: 0.7, delay: i * 0.12, ease: 'easeOut' }}
                >
                  <span className="text-white text-[11px] font-bold tabular-nums truncate">
                    {formatNumber(stage.count)}
                  </span>
                </motion.div>
              </div>

              {/* Percentage */}
              <div className="w-[42px] flex-shrink-0 text-left">
                <span className="text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">
                  {(pct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Stats footer */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800
                      grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Never Reviewed', value: funnel.never_reviewed, pct: funnel.never_reviewed / funnel.total, c: '#ef4444' },
          { label: 'Rejected',       value: funnel.rejected,       pct: funnel.rejected / funnel.total,       c: '#f97316' },
          { label: 'Processing',     value: funnel.processing,     pct: funnel.processing / funnel.total,     c: '#eab308' },
        ].map(({ label, value, pct: p, c }) => (
          <div key={label} className="rounded-xl p-2.5 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-black" style={{ color: c }}>{formatNumber(value)}</p>
            <p className="text-[10px] text-gray-500">{(p * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Station approval chart ───────────────────────────────────────────────────

export function StationChart({ stations }: { stations: Station[] }) {
  const top20 = useMemo(
    () =>
      [...stations]
        .sort((a, b) => b.total_tickets - a.total_tickets)
        .slice(0, 20)
        .map((s) => ({ ...s, pct: +(s.approval_rate * 100).toFixed(1) })),
    [stations],
  )

  const cityAvg = useMemo(
    () =>
      stations.length
        ? (stations.reduce((s, x) => s + x.approval_rate, 0) / stations.length) * 100
        : 0,
    [stations],
  )

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart
        layout="vertical"
        data={top20}
        margin={{ top: 4, right: 28, bottom: 16, left: 8 }}
        barCategoryGap="18%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
        <XAxis
          type="number"
          domain={[0, 60]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
        />
        <RechartsTip content={<StationTip />} cursor={{ fill: 'rgba(156,163,175,0.07)' }} />
        <ReferenceLine
          x={cityAvg}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: `City avg ${cityAvg.toFixed(1)}%`,
            position: 'insideTopRight',
            fontSize: 9,
            fill: '#94a3b8',
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} animationDuration={900}>
          {top20.map((entry, i) => (
            <Cell key={i} fill={approvalColor(entry.approval_rate)} fillOpacity={0.88} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Day-of-week bar chart ────────────────────────────────────────────────────

function DayOfWeekChart({ ts }: { ts: TimeseriesData }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={ts.daily}
        margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <RechartsTip
          content={<GenericTip xLabel="Day" yLabel="Tickets" />}
          cursor={{ fill: 'rgba(156,163,175,0.08)' }}
        />
        <Bar dataKey="tickets" radius={[4, 4, 0, 0]} animationDuration={800}>
          {ts.daily.map((entry, i) => (
            <Cell key={i} fill={DAY_COLOR[entry.day] ?? BRAND_CYAN} fillOpacity={0.9} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Hourly area chart ────────────────────────────────────────────────────────

function HourlyChart({ ts }: { ts: TimeseriesData }) {
  const data = useMemo(
    () => ts.hourly.map((h) => ({ ...h, label: formatHour(h.hour) })),
    [ts],
  )

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND_CYAN} stopOpacity={0.35} />
            <stop offset="95%" stopColor={BRAND_CYAN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.12)" />
        <XAxis
          dataKey="label"
          interval={3}
          tick={{ fontSize: 9, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <RechartsTip
          content={<GenericTip xLabel="Hour" yLabel="Tickets" />}
          cursor={{ stroke: BRAND_CYAN, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="tickets"
          stroke={BRAND_CYAN}
          strokeWidth={2}
          fill="url(#hourGrad)"
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Top violations bar chart ─────────────────────────────────────────────────

function ViolationsTip({ active, payload }: {
  active?:  boolean
  payload?: ReadonlyArray<{ payload: { full: string; count: number } }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs max-w-[240px]">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1 leading-tight">{d.full}</p>
      <p className="text-gray-600 dark:text-gray-300">
        Cases: <span className="font-bold">{formatNumber(d.count)}</span>
      </p>
    </div>
  )
}

function ViolationsChart({ violations }: { violations: ViolationType[] }) {
  const data = useMemo(
    () =>
      violations.slice(0, 15).map((v) => ({
        name: v.name.length > 30 ? v.name.slice(0, 30) + '…' : v.name,
        full: v.name,
        count: v.count,
      })),
    [violations],
  )

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        barCategoryGap="20%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={170}
          tick={{ fontSize: 9, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
        />
        <RechartsTip content={<ViolationsTip />} cursor={{ fill: 'rgba(156,163,175,0.07)' }} />
        <Bar
          dataKey="count"
          fill={BRAND_CYAN}
          fillOpacity={0.85}
          radius={[0, 4, 4, 0]}
          animationDuration={900}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Vehicle type donut ───────────────────────────────────────────────────────

function VehicleDonut({ vehicles }: { vehicles: VehicleType[] }) {
  const total = useMemo(
    () => vehicles.reduce((s, v) => s + v.count, 0),
    [vehicles],
  )

  const topFour = useMemo(
    () => [...vehicles].sort((a, b) => b.count - a.count).slice(0, 4),
    [vehicles],
  )

  return (
    <div>
      {/* Donut */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={vehicles}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              dataKey="count"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              animationBegin={0}
              animationDuration={900}
            >
              {vehicles.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTip
              content={
                <PieTip total={total} />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-400 leading-none">Categories</span>
          <span className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-tight">{vehicles.length}</span>
          <span className="text-[10px] text-gray-400 leading-none">vehicle types</span>
        </div>
      </div>

      {/* Top 4 legend */}
      <div className="mt-2 space-y-2">
        {topFour.map((v) => (
          <div key={v.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: DONUT_COLORS[vehicles.indexOf(v) % DONUT_COLORS.length] }}
            />
            <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate capitalize flex-1">
              {v.name}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-300">
              {((v.count / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Others row */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          +{vehicles.length - 4} more vehicle types
        </span>
        <span className="text-[10px] font-semibold text-gray-500">
          {formatNumber(total)} total
        </span>
      </div>
    </div>
  )
}

// ─── Daily trend with Brush ───────────────────────────────────────────────────

function DailyTrendChart({ ts }: { ts: TimeseriesData }) {
  // Controlled brush range — otherwise Recharts drops the selection on every
  // parent re-render.
  const [range, setRange] = useState<{ startIndex: number; endIndex: number }>(
    { startIndex: 0, endIndex: Math.max(ts.daily_trend.length - 1, 0) },
  )

  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(ts.daily_trend.length - 1, 0) })
  }, [ts.daily_trend.length])

  return (
    <ResponsiveContainer width="100%" height={260} className="[&_.recharts-brush-traveller]:cursor-ew-resize">
      <AreaChart
        data={ts.daily_trend}
        margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND_CYAN} stopOpacity={0.4} />
            <stop offset="95%" stopColor={BRAND_CYAN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.12)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval={4}
          tickFormatter={(d: string) => d.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
        />
        <RechartsTip
          content={<GenericTip xLabel="Date" yLabel="Tickets" />}
          cursor={{ stroke: BRAND_CYAN, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="tickets"
          stroke={BRAND_CYAN}
          strokeWidth={2.5}
          fill="url(#trendGrad)"
          dot={false}
          activeDot={{ r: 5, fill: BRAND_CYAN, stroke: 'white', strokeWidth: 2 }}
          animationDuration={1000}
        />
        <Brush
          dataKey="date"
          height={24}
          stroke="rgba(148,163,184,0.4)"
          fill="rgba(148,163,184,0.06)"
          travellerWidth={10}
          tickFormatter={(d: string) => d.slice(5)}
          startIndex={range.startIndex}
          endIndex={range.endIndex}
          onChange={(r) => {
            if (typeof r?.startIndex === 'number' && typeof r?.endIndex === 'number') {
              setRange({ startIndex: r.startIndex, endIndex: r.endIndex })
            }
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Insights panel ───────────────────────────────────────────────────────────

export function InsightsPanel({
  ts,
  violations,
  stations,
}: {
  ts:         TimeseriesData
  violations: ViolationType[]
  stations:   Station[]
}) {
  const insights = useMemo(() => {
    // Sunday vs Monday
    const sun    = ts.daily.find((d) => d.day === 'Sun')?.tickets ?? 0
    const mon    = ts.daily.find((d) => d.day === 'Mon')?.tickets ?? 0
    const sunPct = mon > 0 ? ((sun - mon) / mon * 100).toFixed(1) : '0'

    // December vs November spike
    const dec    = ts.monthly.find((m) => m.month.startsWith('Dec'))?.tickets ?? 0
    const nov    = ts.monthly.find((m) => m.month.startsWith('Nov'))?.tickets ?? 0
    const decPct = nov > 0 ? ((dec - nov) / nov * 100).toFixed(1) : '0'

    // Best approval rate station
    const best = [...stations].sort((a, b) => b.approval_rate - a.approval_rate)[0]

    // Top-2 violations share
    const totalV   = violations.reduce((s, v) => s + v.count, 0)
    const sorted   = [...violations].sort((a, b) => b.count - a.count)
    const top2Sum  = sorted.slice(0, 2).reduce((s, v) => s + v.count, 0)
    const top2Pct  = totalV > 0 ? (top2Sum / totalV * 100).toFixed(1) : '0'

    return [
      {
        icon:  Activity,
        color: 'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/50 text-orange-700 dark:text-orange-300',
        text:  `Sunday generates ${sunPct}% more violations than Monday — weekend surges need pre-emptive deployment.`,
      },
      {
        icon:  TrendingUp,
        color: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-300',
        text:  `December showed a ${decPct}% spike over November, driven by festival parking demand.`,
      },
      {
        icon:  Info,
        color: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-300',
        text:  `${best?.name ?? 'Top station'} leads with ${((best?.approval_rate ?? 0) * 100).toFixed(1)}% approval rate — benchmark for officer training.`,
      },
      {
        icon:  AlertTriangle,
        color: 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/50 text-purple-700 dark:text-purple-300',
        text:  `Wrong Parking + No Parking account for ${top2Pct}% of all violations — highly concentrated enforcement target.`,
      },
    ]
  }, [ts, violations, stations])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {insights.map(({ icon: Icon, color, text }, i) => (
        <FadeUp key={i} delay={i * 0.08}>
          <div className={cn('flex items-start gap-3 p-4 rounded-2xl border', color)}>
            <Icon size={15} className="flex-shrink-0 mt-0.5 opacity-80" />
            <p className="text-[12px] font-medium leading-relaxed">{text}</p>
          </div>
        </FadeUp>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Prediction + Model Explainability (the model is for prediction only) ─────

function PredictionExplainability() {
  const { data: hotspots, loading: hLoad } = useHotspots()
  const { data: edis,     loading: eLoad } = useEDIExplanations()
  const { data: kpis }                     = useDashboardKPIs()

  const top = useMemo(
    () => [...(hotspots ?? [])].sort((a, b) => b.predicted_24h - a.predicted_24h).slice(0, 8),
    [hotspots],
  )
  const pred24 = useMemo(() => (hotspots ?? []).reduce((s, h) => s + h.predicted_24h, 0), [hotspots])
  const pred48 = useMemo(() => (hotspots ?? []).reduce((s, h) => s + h.predicted_48h, 0), [hotspots])
  const psi = edis?.[0]?.model_confidence
  const lead = edis?.[0]

  if (hLoad || eLoad) return <Skeleton height="h-80" />
  if (!hotspots?.length) {
    return (
      <SectionCard title="Model Predictions & Explainability" subtitle="Upload a CSV to generate forecasts">
        <div className="px-5 py-12 text-center text-sm text-gray-400">No prediction run yet.</div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Prediction KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: 'Predicted · next 24h', value: formatNumber(pred24), color: '#f97316' },
          { icon: Zap,        label: 'Predicted · next 48h', value: formatNumber(pred48), color: '#ef4444' },
          { icon: AlertTriangle, label: 'Critical zones', value: String(kpis?.critical_zones ?? '—'), color: '#dc2626' },
          { icon: ShieldCheck, label: `Model confidence${psi ? ` · ${psi.level}` : ''}`, value: psi ? psi.psi_score.toFixed(3) : '—', color: '#06b6d4' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card p-4">
            <Icon size={16} style={{ color }} />
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2 tabular-nums">{value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top predicted hotspots */}
        <SectionCard title="Top Predicted Hotspots" subtitle="Highest forecast violations · next 24h">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {top.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-[11px] font-mono font-bold text-gray-400 w-16 flex-shrink-0">{h.id}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{h.dominant_junction}</p>
                  {h.peak_hours && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9} /> {h.peak_hours.label}</p>
                  )}
                </div>
                <span className="text-sm font-black tabular-nums text-orange-500 w-8 text-right">{h.predicted_24h}</span>
                <span className="text-xs font-bold tabular-nums text-critical-500 w-8 text-right">{h.predicted_48h}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Explainability for the lead hotspot */}
        <SectionCard title="Why this zone?" subtitle={lead ? `Explainability · ${lead.hotspot_id}` : 'Explainability'}>
          {lead ? (
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <Brain size={14} className="text-violet-500" />
                <span className="text-gray-600 dark:text-gray-300">{lead.anomaly_alert.message}</span>
              </div>
              {/* SHAP-like drivers */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Top drivers</p>
                {lead.shap_drivers.slice(0, 4).map((d) => {
                  const pos = d.impact.includes('+')
                  return (
                    <div key={d.feature}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-mono text-gray-500 truncate max-w-[70%]">{d.feature}</span>
                        <span className={cn('text-[10px] font-bold', pos ? 'text-critical-500' : 'text-low-500')}>
                          {pos ? '+' : '−'}{(d.shap * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(d.shap / 0.6, 1) * 100}%`, background: pos ? '#ef4444' : '#22c55e' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Impact forecast */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl bg-low-50 dark:bg-low-950/20 border border-low-100 dark:border-low-900/40 p-3 text-center">
                  <p className="text-lg font-black text-low-600 dark:text-low-400">{lead.impact_forecast.if_enforced.predicted_violations}</p>
                  <p className="text-[10px] text-gray-500">If enforced</p>
                </div>
                <div className="rounded-xl bg-critical-50 dark:bg-critical-950/20 border border-critical-100 dark:border-critical-900/40 p-3 text-center">
                  <p className="text-lg font-black text-critical-600 dark:text-critical-400">{lead.impact_forecast.if_not_enforced.predicted_violations}</p>
                  <p className="text-[10px] text-gray-500">If not enforced</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-sm text-gray-400">No explainability data.</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default function Analytics() {
  useEffect(() => { document.title = 'Operational Analytics — ParkVUE' }, [])

  const { data: ts,         loading: tsLoad } = useTimeseries()
  const { data: violations, loading: vLoad  } = useViolations()
  const { data: vehicles,   loading: vhLoad } = useVehicles()

  const loading = tsLoad || vLoad || vhLoad

  return (
    <div className="space-y-6 pb-6">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{
              background:           'linear-gradient(90deg,#1e3a8a,#0369a1,#06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            Operational Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Model predictions &amp; explainability · with historical enforcement context
          </p>
        </div>

        {/* Date range chip */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700
                        bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Nov 2023 – Apr 2024
          </span>
        </div>
      </div>

      {/* ── Model predictions + explainability (the model's sole purpose) ─── */}
      <PredictionExplainability />

      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Historical context</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* ── Row 1: Time-based patterns ───────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="h-[320px]" />
          <Skeleton height="h-[320px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeUp delay={0.05}>
            <SectionCard
              title="Day-of-Week Violation Pattern"
              subtitle="Weekends surge — red/orange = high-demand days"
            >
              <DayOfWeekChart ts={ts!} />
            </SectionCard>
          </FadeUp>

          <FadeUp delay={0.09}>
            <SectionCard
              title="Hourly Distribution"
              subtitle="When violations are filed throughout the day"
            >
              <HourlyChart ts={ts!} />
            </SectionCard>
          </FadeUp>
        </div>
      )}

      {/* ── Row 3: Violations + Vehicle distribution ──────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="h-[440px]" />
          <Skeleton height="h-[440px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeUp delay={0.06}>
            <SectionCard
              title="Top 15 Violation Types"
              subtitle="Ranked by case count — Wrong & No Parking dominate"
            >
              <ViolationsChart violations={violations!} />
            </SectionCard>
          </FadeUp>

          <FadeUp delay={0.1}>
            <SectionCard
              title="Vehicle Type Distribution"
              subtitle="Total Vehicle Categories: 12"
            >
              <VehicleDonut vehicles={vehicles!} />
            </SectionCard>
          </FadeUp>
        </div>
      )}

      {/* ── Row 4: Daily trend (full width) ──────────────────────── */}
      {loading ? (
        <Skeleton height="h-[320px]" />
      ) : (
        <FadeUp delay={0.06}>
          <SectionCard
            title="Daily Violation Trend — Last 30 Days"
            subtitle="Drag the brush below the chart to zoom into a date range"
          >
            <DailyTrendChart ts={ts!} />
          </SectionCard>
        </FadeUp>
      )}

    </div>
  )
}
