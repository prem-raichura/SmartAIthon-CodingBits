import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  BarChart, Bar,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTip,
} from 'recharts'
import { Activity, AlertTriangle, Car, Share2, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useHotspots } from '../hooks/useMockData'
import { StatCard } from '../components/ui/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskBadge } from '../components/ui/RiskBadge'
import { cn, formatNumber, haversineKm } from '../lib/utils'
import type { ReactNode } from 'react'
import type { Hotspot, RiskLevel } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
}

const INSIGHTS = [
  {
    icon:  Info,
    color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300',
    text:  'Top 5 junctions account for 38% of total congestion impact across the city.',
  },
  {
    icon:  AlertTriangle,
    color: 'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/50 text-orange-700 dark:text-orange-300',
    text:  'Main road violations cause 2.3× more carriageway blockage than residential parking.',
  },
  {
    icon:  Activity,
    color: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-300',
    text:  'Peak hour blockage averages 42% on Sunday evenings — highest of the week.',
  },
  {
    icon:  Car,
    color: 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/50 text-purple-700 dark:text-purple-300',
    text:  'Wrong parking on arterial roads is the #1 congestion driver in all Critical zones.',
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarDatum {
  id:               string
  junction:         string
  full_junction:    string
  congestion_score: number
  blockage_pct:     number
  risk_level:       RiskLevel
  predicted_24h:    number
}

interface ScatterPoint {
  x:          number
  y:          number
  risk_level: RiskLevel
  id:         string
  junction:   string
  blockage:   number
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-6%' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Chart tooltips ───────────────────────────────────────────────────────────

function BarTip({ active, payload }: {
  active?:  boolean
  payload?: Array<{ payload: BarDatum }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs max-w-[220px]">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-0.5">{d.id}</p>
      <p className="text-gray-500 dark:text-gray-400 mb-2 text-[10px] leading-tight">{d.full_junction}</p>
      <div className="space-y-0.5 text-gray-600 dark:text-gray-300">
        <p>Congestion: <span className="font-bold">{d.congestion_score.toFixed(1)}</span></p>
        <p>Blockage: <span className="font-bold">{d.blockage_pct}%</span></p>
        <p>Pred 24h: <span className="font-bold">{d.predicted_24h} violations</span></p>
        <p>Risk:{' '}
          <span className="font-bold" style={{ color: RISK_COLOR[d.risk_level] }}>
            {d.risk_level}
          </span>
        </p>
      </div>
    </div>
  )
}

function ScatterTip({ active, payload }: {
  active?:  boolean
  payload?: Array<{ payload: ScatterPoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 shadow-xl
                    border border-gray-200 dark:border-gray-700 text-xs max-w-[220px]">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-0.5">{d.id}</p>
      <p className="text-gray-500 dark:text-gray-400 mb-2 text-[10px] truncate">{d.junction}</p>
      <div className="space-y-0.5 text-gray-600 dark:text-gray-300">
        <p>Tickets: <span className="font-bold">{formatNumber(d.x)}</span></p>
        <p>Congestion: <span className="font-bold">{d.y.toFixed(1)}</span></p>
        <p>Blockage: <span className="font-bold">{d.blockage}%</span></p>
        <p>Risk:{' '}
          <span className="font-bold" style={{ color: RISK_COLOR[d.risk_level] }}>
            {d.risk_level}
          </span>
        </p>
      </div>
    </div>
  )
}

// ─── Top 15 Junctions bar chart ───────────────────────────────────────────────

function TopJunctionsChart({ hotspots }: { hotspots: Hotspot[] }) {
  const data: BarDatum[] = useMemo(
    () =>
      [...hotspots]
        .sort((a, b) => b.congestion_score - a.congestion_score)
        .slice(0, 15)
        .map((h) => ({
          id:               h.id,
          junction:         h.dominant_junction.length > 22
            ? h.dominant_junction.slice(0, 22) + '…'
            : h.dominant_junction,
          full_junction:    h.dominant_junction,
          congestion_score: h.congestion_score,
          blockage_pct:     h.blockage_pct,
          risk_level:       h.risk_level,
          predicted_24h:    h.predicted_24h,
        })),
    [hotspots],
  )

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 28, bottom: 20, left: 8 }}
        barCategoryGap="22%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(156,163,175,0.18)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          label={{
            value: 'Congestion Score (0–100)',
            position: 'insideBottomRight',
            offset: -4,
            fontSize: 10,
            fill: '#9ca3af',
          }}
        />
        <YAxis
          type="category"
          dataKey="junction"
          width={150}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
        />
        <RechartsTip content={<BarTip />} cursor={{ fill: 'rgba(156,163,175,0.07)' }} />
        <Bar
          dataKey="congestion_score"
          radius={[0, 4, 4, 0]}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={RISK_COLOR[entry.risk_level]} fillOpacity={0.87} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Scatter plot: Volume vs Impact ──────────────────────────────────────────

export function ScatterSection({ hotspots }: { hotspots: Hotspot[] }) {
  const points: ScatterPoint[] = useMemo(
    () =>
      hotspots.map((h) => ({
        x:          h.ticket_count,
        y:          h.congestion_score,
        risk_level: h.risk_level,
        id:         h.id,
        junction:   h.dominant_junction,
        blockage:   h.blockage_pct,
      })),
    [hotspots],
  )

  const medianX = useMemo(() => {
    const s = [...hotspots].sort((a, b) => a.ticket_count - b.ticket_count)
    return s[Math.floor(s.length / 2)]?.ticket_count ?? 0
  }, [hotspots])

  const medianY = useMemo(() => {
    const s = [...hotspots].sort((a, b) => a.congestion_score - b.congestion_score)
    return s[Math.floor(s.length / 2)]?.congestion_score ?? 50
  }, [hotspots])

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 20, bottom: 36, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
            <XAxis
              dataKey="x"
              type="number"
              name="Tickets"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatNumber(v as number)}
              label={{
                value: 'Total Tickets',
                position: 'insideBottomRight',
                offset: -8,
                fontSize: 10,
                fill: '#9ca3af',
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name="Congestion"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Congestion Score',
                angle: -90,
                position: 'insideTopLeft',
                offset: 12,
                fontSize: 10,
                fill: '#9ca3af',
              }}
            />
            <ReferenceLine x={medianX} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={0.6} />
            <ReferenceLine y={medianY} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={0.6} />
            <RechartsTip content={<ScatterTip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={points}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              shape={(props: any) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint }
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={RISK_COLOR[payload.risk_level]}
                    fillOpacity={0.83}
                    stroke="white"
                    strokeWidth={1.5}
                    style={{ cursor: 'pointer' }}
                  />
                )
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant labels */}
        <span className="absolute top-[9%] right-[4%] pointer-events-none text-[9px] font-bold
                         px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          High Volume · High Impact
        </span>
        <span className="absolute top-[9%] left-[14%] pointer-events-none text-[9px] font-bold
                         px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40
                         text-orange-600 dark:text-orange-400
                         border border-orange-200 dark:border-orange-900/60">
          Underenforced High-Impact
        </span>
        <span className="absolute top-[58%] right-[4%] pointer-events-none text-[9px] font-bold
                         px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          Over-enforced
        </span>
        <span className="absolute top-[58%] left-[14%] pointer-events-none text-[9px] font-bold
                         px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          Low Priority
        </span>
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-4 flex-wrap mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        {(['Critical', 'High', 'Medium', 'Low'] as RiskLevel[]).map((lv) => (
          <div key={lv} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: RISK_COLOR[lv] }} />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{lv}</span>
          </div>
        ))}
        <span className="text-[10px] text-gray-400 ml-auto hidden sm:block">
          Dashed = medians (tickets: {formatNumber(medianX)}, congestion: {medianY.toFixed(1)})
        </span>
      </div>
    </div>
  )
}

// ─── Blockage table with pagination ──────────────────────────────────────────

function BlockageTable({ hotspots }: { hotspots: Hotspot[] }) {
  const [page, setPage] = useState(0)
  const PER_PAGE = 10

  const sorted = useMemo(
    () => [...hotspots].sort((a, b) => b.blockage_pct - a.blockage_pct),
    [hotspots],
  )

  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const rows       = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[580px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {[
                { label: 'Junction',   align: 'left'  },
                { label: 'Station',    align: 'left'  },
                { label: 'Risk',       align: 'left'  },
                { label: 'Cong.',      align: 'right' },
                { label: 'Blockage %', align: 'left'  },
                { label: 'Pred 24 h',  align: 'right' },
              ].map(({ label, align }) => (
                <th
                  key={label}
                  className={cn(
                    'py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500',
                    align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <motion.tr
                key={h.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: i * 0.025 }}
                className={cn(
                  'border-b border-gray-100 dark:border-gray-800/60 transition-colors duration-100',
                  'hover:bg-gray-50 dark:hover:bg-gray-800/30',
                  i % 2 === 1 && 'bg-gray-50/40 dark:bg-gray-900/20',
                )}
              >
                <td className="py-2.5 px-3">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[160px]">
                    {h.dominant_junction}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">{h.id}</p>
                </td>
                <td className="py-2.5 px-3">
                  <span className="block truncate max-w-[110px] text-gray-500 dark:text-gray-400">
                    {h.dominant_station}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <RiskBadge level={h.risk_level} showIcon={false} />
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {h.congestion_score.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${h.blockage_pct}%` }}
                        transition={{ duration: 0.45, delay: i * 0.02, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: RISK_COLOR[h.risk_level] }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums w-8 text-right text-gray-700 dark:text-gray-300">
                      {h.blockage_pct}%
                    </span>
                  </div>
                </td>
                <td
                  className="py-2.5 px-3 text-right font-bold tabular-nums"
                  style={{
                    color: h.predicted_24h > 80
                      ? '#ef4444'
                      : h.predicted_24h > 50
                      ? '#f97316'
                      : '#6b7280',
                  }}
                >
                  {h.predicted_24h}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, sorted.length)} of {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                       disabled:opacity-35 disabled:cursor-not-allowed
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={cn(
                'w-7 h-7 rounded-lg text-xs font-bold transition-colors duration-150',
                i !== page && 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
              style={
                i === page
                  ? { background: 'linear-gradient(135deg,#1e3a8a,#06b6d4)', color: 'white' }
                  : undefined
              }
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                       disabled:opacity-35 disabled:cursor-not-allowed
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cascade network SVG ──────────────────────────────────────────────────────

export function CascadeNetwork({ hotspots }: { hotspots: Hotspot[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView  = useInView(wrapRef, { once: true, margin: '-8%' })

  const SVG_W = 760
  const SVG_H = 300
  const PAD   = 58

  const { nodes, edges } = useMemo(() => {
    const top10 = [...hotspots]
      .sort((a, b) => b.ticket_count - a.ticket_count)
      .slice(0, 10)

    const lats    = top10.map((h) => h.lat)
    const lons    = top10.map((h) => h.lon)
    const minLat  = Math.min(...lats)
    const maxLat  = Math.max(...lats)
    const minLon  = Math.min(...lons)
    const maxLon  = Math.max(...lons)
    const latSpan = (maxLat - minLat) || 0.1
    const lonSpan = (maxLon - minLon) || 0.1
    const maxTkts = Math.max(...top10.map((h) => h.ticket_count))

    const nodes = top10.map((h) => ({
      hotspot: h,
      x:       PAD + ((h.lon - minLon) / lonSpan) * (SVG_W - PAD * 2),
      y:       SVG_H - PAD - ((h.lat - minLat) / latSpan) * (SVG_H - PAD * 2),
      r:       10 + (h.ticket_count / maxTkts) * 14,
    }))

    const seen  = new Set<string>()
    const edges: { x1: number; y1: number; x2: number; y2: number; w: number }[] = []

    for (const n of nodes) {
      const nearest = nodes
        .filter((m) => m.hotspot.id !== n.hotspot.id)
        .map((m) => ({
          m,
          dist: haversineKm(n.hotspot.lat, n.hotspot.lon, m.hotspot.lat, m.hotspot.lon),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2)

      for (const { m, dist } of nearest) {
        const key = [n.hotspot.id, m.hotspot.id].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          const corr = Math.max(0.25, 1 - dist / 6)
          edges.push({ x1: n.x, y1: n.y, x2: m.x, y2: m.y, w: 0.8 + corr * 2.8 })
        }
      }
    }

    return { nodes, edges }
  }, [hotspots])

  return (
    <div ref={wrapRef}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto"
        aria-label="Violation cascade network"
      >
        <defs>
          <marker id="arr" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="#06b6d4" opacity="0.55" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => (
          <motion.path
            key={`e-${i}`}
            d={`M ${e.x1},${e.y1} L ${e.x2},${e.y2}`}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={e.w}
            markerEnd="url(#arr)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 0.44 } : {}}
            transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: 'easeOut' }}
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => (
          <motion.g
            key={n.hotspot.id}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
          >
            {n.hotspot.risk_level === 'Critical' && (
              <circle
                cx={n.x} cy={n.y} r={n.r + 5}
                fill="none"
                stroke={RISK_COLOR.Critical}
                strokeWidth={1}
                opacity={0.28}
              />
            )}
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill={RISK_COLOR[n.hotspot.risk_level]}
              fillOpacity={0.88}
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={n.x} y={n.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fontWeight="700"
              fill="white"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {n.hotspot.id.replace('HOT-', '')}
            </text>
          </motion.g>
        ))}
      </svg>

      <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-950/25
                      border border-blue-100 dark:border-blue-900/50 px-4 py-3">
        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
          When a hotspot is uncontrolled, neighbours spike within{' '}
          <strong>15–35 minutes</strong>. Node size = ticket volume. Arrows show cascade
          direction. Average inter-zone correlation: <strong>0.65</strong>.
        </p>
      </div>
    </div>
  )
}

// ─── Key insights panel ───────────────────────────────────────────────────────

export function InsightsPanel() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {INSIGHTS.map(({ icon: Icon, color, text }, i) => (
        <FadeUp key={i} delay={i * 0.08}>
          <div className={cn('flex items-start gap-3 p-4 rounded-2xl border', color)}>
            <Icon size={16} className="flex-shrink-0 mt-0.5 opacity-80" />
            <p className="text-[12px] font-medium leading-relaxed">{text}</p>
          </div>
        </FadeUp>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Congestion() {
  useEffect(() => { document.title = 'Congestion Impact — ParkVUE' }, [])

  const { data: hotspots, loading } = useHotspots()

  const kpis = useMemo(() => {
    if (!hotspots) return null
    const avgBlockage      = hotspots.length
      ? hotspots.reduce((s, h) => s + h.blockage_pct, 0) / hotspots.length
      : 0
    const criticalCount    = hotspots.filter((h) => h.risk_level === 'Critical').length
    const vehiclesAffected = hotspots.reduce((s, h) => s + h.ticket_count * 50, 0)
    return { avgBlockage, criticalCount, vehiclesAffected }
  }, [hotspots])

  const KPI_CARDS: Array<{
    title:    string
    value:    number
    display?: string
    icon:     LucideIcon
    color:    'red' | 'orange' | 'purple'
    suffix?:  string
  }> = kpis
    ? [
        {
          title:  'Avg Carriageway Blockage',
          value:  Math.round(kpis.avgBlockage),
          suffix: '%',
          icon:   Activity,
          color:  'red',
        },
        {
          title: 'Critical Junctions',
          value: kpis.criticalCount,
          icon:  AlertTriangle,
          color: 'red',
        },
        {
          title:   'Est. Vehicles Affected',
          value:   kpis.vehiclesAffected,
          display: formatNumber(kpis.vehiclesAffected),
          icon:    Car,
          color:   'orange',
        },
        {
          title: 'Cascade Junctions',
          value: 8,
          icon:  Share2,
          color: 'purple',
        },
      ]
    : []

  return (
    <div className="space-y-6 pb-6">

      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-black tracking-tight"
          style={{
            background:              'linear-gradient(90deg,#1e3a8a,#0369a1,#06b6d4)',
            WebkitBackgroundClip:    'text',
            WebkitTextFillColor:     'transparent',
            backgroundClip:          'text',
          }}
        >
          Congestion Impact Analysis
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Quantified traffic flow disruption from illegal parking
        </p>
      </div>

      {/* KPI row */}
      {loading || !kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-28" />)}
        </div>
      ) : (
        <FadeUp>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CARDS.map(({ title, value, display, icon, color, suffix }) => (
              <StatCard
                key={title}
                title={title}
                value={value}
                displayValue={display}
                icon={icon}
                color={color}
                suffix={suffix}
              />
            ))}
          </div>
        </FadeUp>
      )}

      {/* Top 15 junctions bar chart */}
      {loading || !hotspots ? (
        <Skeleton height="h-[500px]" />
      ) : (
        <FadeUp delay={0.05}>
          <SectionCard
            title="Top 15 Junctions by Congestion Score"
            subtitle="Higher score = greater traffic disruption from illegal parking"
          >
            <TopJunctionsChart hotspots={hotspots} />
          </SectionCard>
        </FadeUp>
      )}

      {/* Blockage table */}
      {loading || !hotspots ? (
        <Skeleton height="h-[500px]" />
      ) : (
        <FadeUp delay={0.07}>
          <SectionCard
            title="Carriageway Blockage by Zone"
            subtitle="All zones ranked by blockage %. Progress bars show relative impact."
          >
            <BlockageTable hotspots={hotspots} />
          </SectionCard>
        </FadeUp>
      )}

    </div>
  )
}
