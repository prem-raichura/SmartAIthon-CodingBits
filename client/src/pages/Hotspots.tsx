import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import { latLngToCell, cellToBoundary } from 'h3-js'
import {
  X, Users, ZoomIn, ZoomOut, RotateCcw,
  ChevronRight, Activity, TrendingUp,
  CheckCircle, MapPin, Filter, Clock, Building2, ChevronLeft, Loader2, CalendarDays,
} from 'lucide-react'
import { useHotspots, useEDIExplanations } from '../hooks/useMockData'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskBadge } from '../components/ui/RiskBadge'
import { Dialog } from '../components/ui/Dialog'
import { cn, formatNumber, getRiskBg } from '../lib/utils'
import { getNearestStations, getStationOfficers, assignOfficer } from '../lib/api'
import type { NearestStation, StationOfficer } from '../lib/api'
import type { Hotspot, RiskLevel, EDIExplanation, DayPart } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLR_CENTER: [number, number] = [12.97, 77.59]
const BLR_ZOOM = 12
const H3_RES = 7                           // resolution 7 → ~1.2 km edge, clearly visible at zoom 12

const RISK_COLOR: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
}

const RISK_FILTERS: Array<'All' | RiskLevel> = ['All', 'Critical', 'High', 'Medium', 'Low']

// ─── Types ────────────────────────────────────────────────────────────────────

interface HexDatum { hotspot: Hotspot; boundary: [number, number][]; cell: string }

// Day-wise forecast view: next-day (24h) vs day-after (48h)
type DayView = 24 | 48

// ─── H3 hex builder — dedup by cell, keep highest hotspot_score ───────────────

function buildHexData(hotspots: Hotspot[]): HexDatum[] {
  const cells = new Map<string, { hotspot: Hotspot; cell: string }>()
  for (const h of hotspots) {
    try {
      const cell = latLngToCell(h.lat, h.lon, H3_RES)
      const cur = cells.get(cell)
      if (!cur || h.hotspot_score > cur.hotspot.hotspot_score) cells.set(cell, { hotspot: h, cell })
    } catch { /* skip bad coords */ }
  }
  const out: HexDatum[] = []
  for (const { hotspot, cell } of cells.values()) {
    try {
      out.push({ hotspot, cell, boundary: cellToBoundary(cell) as [number, number][] })
    } catch { /* skip */ }
  }
  return out
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2800)
    return () => clearTimeout(id)
  }, [onDone])
  return (
    <motion.div
      initial={{ y: 24, opacity: 0, scale: 0.95 }}
      animate={{ y: 0,  opacity: 1, scale: 1    }}
      exit={  { y: -16, opacity: 0, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5
                 px-5 py-3 rounded-2xl bg-gray-950 text-white text-sm font-medium shadow-2xl
                 border border-white/10"
    >
      <CheckCircle size={15} className="text-low-400 flex-shrink-0" />
      {message}
    </motion.div>
  )
}

// ─── Map controller — exposes map instance via callback ──────────────────────

function MapController({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onReady(map) }, [])
  return null
}

// ─── Single hexagon polygon — memoised to prevent Leaflet DOM churn ──────────

const HexPolygon = memo(function HexPolygon({ datum, selected, onSelect, pulseTick }: {
  datum:     HexDatum
  selected:  boolean
  onSelect:  (h: Hotspot) => void
  pulseTick: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const { hotspot, boundary } = datum
  const color      = RISK_COLOR[hotspot.risk_level]
  const isCritical = hotspot.risk_level === 'Critical'

  const fillOpacity = selected
    ? 0.85
    : hovered
      ? 0.72
      : isCritical
        ? (pulseTick ? 0.60 : 0.40)
        : 0.45

  const pathOptions = useMemo(() => ({
    color,
    fillColor:   color,
    fillOpacity,
    weight:      selected ? 3 : hovered ? 2 : 1.5,
    opacity:     0.95,
  }), [color, fillOpacity, selected, hovered])

  const eventHandlers = useMemo(() => ({
    click:     () => onSelect(hotspot),
    mouseover: () => setHovered(true),
    mouseout:  () => setHovered(false),
  }), [hotspot, onSelect])

  return (
    <Polygon
      positions={boundary}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    />
  )
})

// ─── Map layer (hexagons + markers) ──────────────────────────────────────────

function MapLayer({ hexData, selected, onSelect, pulseTick }: {
  hexData:   HexDatum[]
  selected:  Hotspot | null
  onSelect:  (h: Hotspot) => void
  pulseTick: boolean
}) {
  return (
    <>
      {hexData.map((d) => (
        <HexPolygon
          key={d.hotspot.id}
          datum={d}
          selected={selected?.id === d.hotspot.id}
          onSelect={onSelect}
          // Only Critical hexes pulse. Passing the live tick to every polygon
          // defeated the memo and re-styled all ~35 of them twice a second.
          pulseTick={d.hotspot.risk_level === 'Critical' ? pulseTick : false}
        />
      ))}
    </>
  )
}

// ─── Map overlay controls ────────────────────────────────────────────────────

function MapControls({
  mapRef, visibleCount, totalCount, totalPred, dayView, forecastDate, avgCongestion,
}: {
  mapRef:        React.MutableRefObject<L.Map | null>
  visibleCount:  number
  totalCount:    number
  totalPred:     number
  dayView:       DayView
  forecastDate?: string
  avgCongestion: number
}) {
  return (
    <>
      {/* Stats pills — top */}
      <div className="absolute top-3 left-3 right-3 z-[900] flex flex-wrap gap-2 pointer-events-none">
        {[
          { icon: MapPin,     color: '#06b6d4', label: `${visibleCount} / ${totalCount} hotspots`     },
          { icon: TrendingUp, color: '#ef4444', label: `${totalPred} predicted · Day ${dayView === 24 ? '1' : '2'}${forecastDate ? ` (${forecastDate})` : ''}` },
          { icon: Activity,   color: '#f97316', label: `Avg congestion ${avgCongestion.toFixed(1)}`   },
        ].map(({ icon: Icon, color, label }) => (
          <div
            key={label}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full
                       bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm shadow-md
                       border border-gray-200/80 dark:border-gray-700/60"
          >
            <Icon size={11} style={{ color }} className="flex-shrink-0" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Zoom + layer controls — right side */}
      <div className="absolute top-16 right-3 z-[900] flex flex-col gap-1">
        {[
          { icon: ZoomIn,    tip: 'Zoom in',    fn: () => mapRef.current?.zoomIn()                      },
          { icon: ZoomOut,   tip: 'Zoom out',   fn: () => mapRef.current?.zoomOut()                     },
          { icon: RotateCcw, tip: 'Reset view', fn: () => mapRef.current?.setView(BLR_CENTER, BLR_ZOOM) },
        ].map(({ icon: Icon, tip, fn }) => (
          <button
            key={tip}
            onClick={fn}
            title={tip}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm shadow-md
                       border border-gray-200/80 dark:border-gray-700/60
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white
                       transition-colors duration-150"
          >
            <Icon size={14} />
          </button>
        ))}

      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-5 left-3 z-[900]">
        <div className="rounded-2xl bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm shadow-md
                        border border-gray-200/80 dark:border-gray-700/60 px-3 py-2.5 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Risk Level
          </p>
          {(['Critical', 'High', 'Medium', 'Low'] as RiskLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded flex-shrink-0 shadow-sm"
                style={{ background: RISK_COLOR[level], opacity: 0.9 }}
              />
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Hotspot list card ───────────────────────────────────────────────────────

// The panel swaps to HotspotDetail as soon as a hotspot is selected, so the
// list is only ever rendered with nothing selected — hence no selected state.
function HotspotCard({ hotspot, onClick }: {
  hotspot:  Hotspot
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 text-left',
        'border-b border-gray-100 dark:border-gray-800/70',
        'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-150',
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <RiskBadge level={hotspot.risk_level} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-bold font-mono text-gray-900 dark:text-gray-100">
            {hotspot.id}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 tabular-nums flex-shrink-0">
            {formatNumber(hotspot.ticket_count)}
          </span>
        </div>
        <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate font-medium">
          {hotspot.dominant_junction}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-gray-400">
            Score <span className="font-bold text-gray-600 dark:text-gray-300">{hotspot.hotspot_score.toFixed(0)}</span>
          </span>
          <span className="text-[10px] text-gray-400">
            Pred <span className="font-bold text-orange-500">{hotspot.predicted_24h}</span>
          </span>
        </div>
      </div>
      <ChevronRight size={13} className="flex-shrink-0 mt-1.5 text-gray-300 dark:text-gray-600" />
    </button>
  )
}

// ─── Z-score gauge ────────────────────────────────────────────────────────────

function ZGauge({ z }: { z: number }) {
  const pct   = Math.min(Math.abs(z) / 3.5, 1) * 100
  const color = z > 2.5 ? '#ef4444' : z > 1.5 ? '#f97316' : z > 0 ? '#eab308' : '#9ca3af'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-xs font-mono font-bold tabular-nums w-14 text-right"
            style={{ color }}>
        {z > 0 ? '+' : ''}{z.toFixed(2)}σ
      </span>
    </div>
  )
}

// ─── SHAP driver bar ─────────────────────────────────────────────────────────

function ShapBar({ feature, shap, impact }: { feature: string; shap: number; impact: string }) {
  const pct      = Math.min(shap / 0.6, 1) * 100
  const positive = impact.includes('+')
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 truncate max-w-[70%]">
          {feature}
        </span>
        <span className={cn('text-[10px] font-bold tabular-nums',
          positive ? 'text-critical-500' : 'text-low-500')}>
          {positive ? '+' : '−'}{(shap * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: positive ? '#ef4444' : '#22c55e' }}
        />
      </div>
    </div>
  )
}

// ─── Hotspot detail panel ─────────────────────────────────────────────────────

const DAYPART_META: Array<{ key: keyof DayPart; label: string; color: string }> = [
  { key: 'morning', label: 'Morning', color: '#f59e0b' },
  { key: 'noon',    label: 'Noon',    color: '#06b6d4' },
  { key: 'evening', label: 'Evening', color: '#f97316' },
  { key: 'night',   label: 'Night',   color: '#6366f1' },
]

function HotspotDetail({ hotspot, edi, dayView, onClose, onAssign }: {
  hotspot:  Hotspot
  edi?:     EDIExplanation
  dayView:  DayView
  onClose:  () => void
  onAssign: () => void
}) {
  const daypart = dayView === 24 ? hotspot.daypart_24h : hotspot.daypart_48h
  const forecastDate = dayView === 24 ? hotspot.forecast_date_24h : hotspot.forecast_date_48h
  const maxPart = daypart ? Math.max(1, ...DAYPART_META.map((m) => daypart[m.key])) : 1
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-100 dark:border-gray-800
                      bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/60 dark:to-gray-900/10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black font-mono text-gray-900 dark:text-gray-100">
                {hotspot.id}
              </span>
              <RiskBadge level={hotspot.risk_level} />
            </div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
              {hotspot.dominant_junction}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {hotspot.dominant_station} Police Station
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400
                       hover:text-gray-700 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 min-h-0">

        {/* KPI grid: risk_score, congestion_score, blockage_rate, confidence */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Risk Score',    value: hotspot.hotspot_score.toFixed(1) },
            { label: 'Congestion',    value: hotspot.congestion_score.toFixed(1) },
            { label: 'Blockage Rate', value: `${hotspot.blockage_pct}%` },
            { label: 'Confidence',    value: Math.max(0.5, Math.min(0.99, (100 - hotspot.z_score * 4) / 100)).toFixed(2) },
          ].map(({ label, value }) => (
            <div key={label}
              className="rounded-xl border border-gray-100 dark:border-gray-700/70 p-3
                         bg-gray-50/60 dark:bg-gray-900/30">
              <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Predictions: pred_24h, pred_48h — selected day highlighted */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Violation Forecast
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Next 24 h (Day 1)', value: hotspot.predicted_24h, color: '#f97316', date: hotspot.forecast_date_24h, on: dayView === 24 },
              { label: 'Next 48 h (Day 2)', value: hotspot.predicted_48h, color: '#ef4444', date: hotspot.forecast_date_48h, on: dayView === 48 },
            ].map(({ label, value, color, date, on }) => (
              <div key={label}
                className={cn('rounded-xl border p-3 text-center transition-shadow',
                  on ? 'border-transparent ring-2 shadow-md' : 'border-gray-100 dark:border-gray-700/70 bg-gray-50/60 dark:bg-gray-900/30')}
                style={on ? { boxShadow: `0 0 0 2px ${color}33`, background: `${color}0d` } : undefined}>
                <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                {date && <p className="text-[9px] text-gray-400 font-mono mt-0.5">{date}</p>}
                <div className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(value / 150, 1) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak hours + day-part split for the selected day */}
        {(hotspot.peak_hours || daypart) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Peak Hours · Day {dayView === 24 ? '1' : '2'}
              </p>
              {forecastDate && (
                <span className="text-[9px] font-mono text-gray-400 flex items-center gap-1">
                  <CalendarDays size={10} /> {forecastDate}
                </span>
              )}
            </div>
            {hotspot.peak_hours && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/20
                              border border-orange-100 dark:border-orange-900/40">
                <Clock size={14} className="text-orange-500 flex-shrink-0" />
                <span className="text-sm font-bold text-orange-700 dark:text-orange-300">{hotspot.peak_hours.label}</span>
                <span className="text-[10px] text-orange-500/70 ml-auto">
                  {Math.round(hotspot.peak_hours.share * 100)}% of activity
                </span>
              </div>
            )}
            {daypart && (
              <div className="space-y-1.5">
                {DAYPART_META.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(daypart[key] / maxPart) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-gray-600 dark:text-gray-300 w-6 text-right">
                      {daypart[key]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Explainability: anomaly z-score + top SHAP-like drivers */}
        {edi && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
              Model Explainability
            </p>
            <div className="mb-2.5">
              <p className="text-[10px] text-gray-400 mb-1">Anomaly (z-score vs normal)</p>
              <ZGauge z={hotspot.z_score} />
            </div>
            {edi.shap_drivers?.length > 0 && (
              <div className="space-y-2">
                {edi.shap_drivers.slice(0, 4).map((d) => (
                  <ShapBar key={d.feature} feature={d.feature} shap={d.shap} impact={d.impact} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patterns: dominant_violation, dominant_vehicle */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Dominant Patterns
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-semibold', getRiskBg('High'))}>
              {hotspot.dominant_violation}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold
                             bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {hotspot.dominant_vehicle}
            </span>
          </div>
        </div>
      </div>

      {/* Assign CTA */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950/60">
        <motion.button
          onClick={onAssign}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     font-semibold text-sm text-white shadow-md
                     hover:shadow-lg transition-shadow duration-200"
          style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0369a1 50%, #06b6d4 100%)' }}
        >
          <Users size={15} />
          Assign Officers to this Zone
        </motion.button>
      </div>
    </div>
  )
}

// ─── Station officer row (in assign dialog) ──────────────────────────────────

function StationOfficerRow({ officer, assigned, busy, onAssign }: {
  officer:  StationOfficer
  assigned: boolean
  busy:     boolean
  onAssign: (id: string) => void
}) {
  const initials = officer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const free = officer.status === 'available'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{officer.name}</span>
          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{officer.badge_id}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
            free ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
                 : 'text-gray-500 bg-gray-100 dark:bg-gray-800')}>
            {officer.status}
          </span>
          <span className="text-[10px] text-gray-400">{officer.total_tickets} reports</span>
        </div>
      </div>
      <button
        disabled={assigned || busy || !free}
        onClick={() => onAssign(officer.id)}
        className={cn('flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150',
          assigned
            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 cursor-default'
            : !free
              ? 'text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
              : 'text-white bg-gradient-to-r from-blue-700 to-cyan-600 hover:opacity-90')}
      >
        {assigned ? 'Assigned ✓' : busy ? <Loader2 size={13} className="animate-spin" /> : 'Assign'}
      </button>
    </div>
  )
}

// ─── Assign officers dialog: nearest stations → available officers → assign ───

const HOUR_OPTIONS = [4, 8, 12, 24]

function AssignDialog({ open, hotspot, onClose, onToast }: {
  open:     boolean
  hotspot:  Hotspot | null
  onClose:  () => void
  onToast:  (msg: string) => void
}) {
  const [stations,    setStations]    = useState<NearestStation[]>([])
  const [loadingSt,   setLoadingSt]   = useState(false)
  const [stationErr,  setStationErr]  = useState<string | null>(null)
  const [activeSt,    setActiveSt]    = useState<NearestStation | null>(null)
  const [officers,    setOfficers]    = useState<StationOfficer[]>([])
  const [loadingOff,  setLoadingOff]  = useState(false)
  const [hours,       setHours]       = useState(8)
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [busyId,      setBusyId]      = useState<string | null>(null)

  // Load the 2 nearest stations whenever the dialog opens for a hotspot.
  useEffect(() => {
    if (!open || !hotspot) return
    setAssignedIds(new Set()); setActiveSt(null); setOfficers([]); setStationErr(null)
    setLoadingSt(true)
    getNearestStations(hotspot.lat, hotspot.lon, 2)
      .then((s) => { setStations(s); if (s[0]) setActiveSt(s[0]) })
      .catch((e) => setStationErr(e instanceof Error ? e.message : 'Failed to load stations'))
      .finally(() => setLoadingSt(false))
  }, [open, hotspot])

  // Load available officers for the selected station.
  useEffect(() => {
    if (!activeSt) return
    setLoadingOff(true)
    getStationOfficers(activeSt.id, 'available')
      .then(setOfficers)
      .catch(() => setOfficers([]))
      .finally(() => setLoadingOff(false))
  }, [activeSt])

  const handleAssign = useCallback(async (officerId: string) => {
    if (!hotspot) return
    const h3 = hotspot.h3_id ?? latLngToCell(hotspot.lat, hotspot.lon, 9)
    const time_limit = new Date(Date.now() + hours * 3600_000).toISOString()
    setBusyId(officerId)
    try {
      await assignOfficer({ user_id: officerId, h3_index: h3, time_limit })
      setAssignedIds((prev) => new Set([...prev, officerId]))
      onToast('Officer deployed — notified on their app')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Assignment failed')
    } finally {
      setBusyId(null)
    }
  }, [hotspot, hours, onToast])

  if (!hotspot) return null

  return (
    <Dialog open={open} onClose={onClose} width="max-w-2xl"
      title={`Assign Officers — ${hotspot.dominant_junction.slice(0, 40)}${hotspot.dominant_junction.length > 40 ? '…' : ''}`}>

      {/* Patrol duration picker */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60
                      border border-gray-100 dark:border-gray-800">
        <Clock size={14} className="text-gray-400" />
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-1">Patrol duration</label>
        <div className="flex items-center gap-1">
          {HOUR_OPTIONS.map((h) => (
            <button key={h} onClick={() => setHours(h)}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                hours === h ? 'text-white bg-gradient-to-r from-blue-700 to-cyan-600'
                            : 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600')}>
              {h}h
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left: 2 nearest stations */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Nearest Stations
          </p>
          {loadingSt ? (
            <div className="py-8 text-center text-sm text-gray-400"><Loader2 size={16} className="animate-spin inline" /></div>
          ) : stationErr ? (
            <div className="py-6 text-center text-xs text-critical-500">{stationErr}</div>
          ) : stations.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">No stations seeded yet.</div>
          ) : (
            <div className="space-y-2">
              {stations.map((s) => (
                <button key={s.id} onClick={() => setActiveSt(s)}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors',
                    activeSt?.id === s.id
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50')}>
                  <Building2 size={15} className="text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.distance_km} km away</p>
                  </div>
                  <ChevronRight size={13} className="text-gray-300 dark:text-gray-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: available officers at selected station */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            {activeSt && <ChevronLeft size={11} className="sm:hidden" />}
            Available Officers{activeSt ? ` · ${activeSt.name}` : ''}
          </p>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 min-h-[140px] max-h-72 overflow-y-auto">
            {!activeSt ? (
              <div className="py-12 text-center text-xs text-gray-400">Select a station</div>
            ) : loadingOff ? (
              <div className="py-12 text-center text-gray-400"><Loader2 size={16} className="animate-spin inline" /></div>
            ) : officers.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No available officers at this station.</div>
            ) : (
              officers.map((o) => (
                <StationOfficerRow key={o.id} officer={o}
                  assigned={assignedIds.has(o.id)} busy={busyId === o.id} onAssign={handleAssign} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">
          {assignedIds.size > 0 ? `${assignedIds.size} officer${assignedIds.size !== 1 ? 's' : ''} deployed to this zone` : 'Pick an officer to deploy'}
        </span>
        <button onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}>
          Done
        </button>
      </div>
    </Dialog>
  )
}

// ─── Side panel (list ↔ detail) ───────────────────────────────────────────────

function SidePanel({ hotspots, selected, edis, dayView, onSelect, onClose, onAssign, filter }: {
  hotspots: Hotspot[]
  selected: Hotspot | null
  edis:     EDIExplanation[]
  dayView:  DayView
  onSelect: (h: Hotspot) => void
  onClose:  () => void
  onAssign: () => void
  filter:   'All' | RiskLevel
}) {
  const visible = filter === 'All' ? hotspots : hotspots.filter((h) => h.risk_level === filter)
  const edi     = selected ? edis.find((e) => e.hotspot_id === selected.id) : undefined

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 min-h-0">
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0  }}
            exit={  { opacity: 0, x: 16  }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full min-h-0"
          >
            <HotspotDetail hotspot={selected} edi={edi} dayView={dayView} onClose={onClose} onAssign={onAssign} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0   }}
            exit={  { opacity: 0, x: -16  }}
            transition={{ duration: 0.18  }}
            className="flex flex-col h-full min-h-0"
          >
            {/* List header */}
            <div className="flex-shrink-0 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800
                            bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/60 dark:to-gray-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {visible.length} Hotspots
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Click a zone on the map or select below
                  </p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold">
                  {filter}
                </span>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
              {visible.map((h) => (
                <HotspotCard
                  key={h.id}
                  hotspot={h}
                  onClick={() => onSelect(h)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Hotspots() {
  useEffect(() => { document.title = 'Hotspot Detection — ParkVUE' }, [])

  const locState = useLocation().state as { hotspotId?: string } | null

  const { data: hotspots, loading: hotLoad } = useHotspots()
  const { data: edis,     loading: ediLoad } = useEDIExplanations()

  const [filter,     setFilter]     = useState<'All' | RiskLevel>('All')
  const [dayView,    setDayView]    = useState<DayView>(24)
  const [selected,   setSelected]   = useState<Hotspot | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)
  const [pulseTick,  setPulseTick]  = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  // Critical hexagon pulse
  useEffect(() => {
    const id = setInterval(() => setPulseTick((t) => !t), 1200)
    return () => clearInterval(id)
  }, [])

  // Navigate-from-dashboard pre-selection
  useEffect(() => {
    if (!locState?.hotspotId || !hotspots) return
    const h = hotspots.find((x) => x.id === locState.hotspotId)
    if (h) {
      setSelected(h)
      // Pan without changing zoom so all hexagons remain visible
      mapRef.current?.panTo([h.lat, h.lon], { animate: true, duration: 0.6 })
    }
  }, [locState?.hotspotId, hotspots])

  const handleMapReady = useCallback((m: L.Map) => { mapRef.current = m }, [])

  // Drop the reference on unmount — MapControls otherwise holds a handle to a
  // destroyed Leaflet map after navigating away and back.
  useEffect(() => () => { mapRef.current = null }, [])

  const handleSelect = useCallback((h: Hotspot) => {
    setSelected(h)
    // Pan to hotspot — keep current zoom so other hexagons stay on screen
    mapRef.current?.panTo([h.lat, h.lon], { animate: true, duration: 0.5 })
  }, [])

  const handleClose  = useCallback(() => setSelected(null), [])
  const handleToast  = useCallback((msg: string) => setToast(msg), [])
  const handleDone   = useCallback(() => setToast(null), [])

  const filtered = useMemo(
    () => (hotspots ?? []).filter((h) => filter === 'All' || h.risk_level === filter),
    [hotspots, filter],
  )
  const hexData       = useMemo(() => buildHexData(filtered), [filtered])
  const totalPred     = useMemo(
    () => filtered.reduce((s, h) => s + (dayView === 24 ? h.predicted_24h : h.predicted_48h), 0),
    [filtered, dayView],
  )
  const forecastDate  = useMemo(
    () => (dayView === 24 ? filtered[0]?.forecast_date_24h : filtered[0]?.forecast_date_48h),
    [filtered, dayView],
  )
  const avgCongestion = useMemo(
    () => filtered.length ? filtered.reduce((s, h) => s + h.congestion_score, 0) / filtered.length : 0,
    [filtered],
  )

  const isLoading = hotLoad || ediLoad

  return (
    /**
     * Outer wrapper:
     * - Negative margins escape AppShell's p-4/p-6 padding so the map runs edge-to-edge.
     * - On desktop (lg+) we pin the height to viewport-minus-topbar (h-16 = 64 px)
     *   so the whole page fits without scrolling.
     * - On mobile the height is unconstrained and the AppShell's scrollable <main>
     *   handles overflow naturally.
     */
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 flex flex-col
                    lg:h-[calc(100vh-64px)] lg:overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between
                      gap-3 px-4 md:px-6 py-3.5
                      bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm
                      border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1
            className="text-xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(90deg,#1e3a8a,#0369a1,#06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Hotspot Detection
          </h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
            Spatio-temporal violation clusters
          </p>
        </div>

        {/* Day toggle + filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Day-wise forecast toggle */}
          <div className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
            {([24, 48] as DayView[]).map((d) => (
              <button
                key={d}
                onClick={() => setDayView(d)}
                className={cn(
                  'px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1',
                  dayView === d
                    ? 'bg-white dark:bg-gray-950 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400',
                )}
              >
                <CalendarDays size={11} /> Day {d === 24 ? '1' : '2'}
              </button>
            ))}
          </div>
          <Filter size={12} className="text-gray-400 flex-shrink-0" />
          {RISK_FILTERS.map((f) => {
            const active = filter === f
            return (
              <motion.button
                key={f}
                onClick={() => { setFilter(f); setSelected(null) }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.1 }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150',
                  active
                    ? 'text-white shadow-sm'
                    : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600',
                )}
                style={active
                  ? { background: f === 'All' ? 'linear-gradient(135deg,#1e3a8a,#06b6d4)' : RISK_COLOR[f as RiskLevel] }
                  : undefined}
              >
                {f}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── Body: map + panel ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><Skeleton height="h-full" /></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

          {/* MAP AREA */}
          <div className="relative h-[52vh] lg:h-auto flex-1 min-h-0">
            <MapContainer
              center={BLR_CENTER}
              zoom={BLR_ZOOM}
              zoomControl={false}
              attributionControl={false}
              className="absolute inset-0 w-full h-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapController onReady={handleMapReady} />
              <MapLayer
                hexData={hexData}
                selected={selected}
                onSelect={handleSelect}
                pulseTick={pulseTick}
              />
            </MapContainer>

            {/* Overlays — rendered on top of MapContainer via absolute positioning */}
            <MapControls
              mapRef={mapRef}
              visibleCount={filtered.length}
              totalCount={hotspots?.length ?? 0}
              totalPred={totalPred}
              dayView={dayView}
              forecastDate={forecastDate}
              avgCongestion={avgCongestion}
            />
          </div>

          {/* SIDE PANEL */}
          <div className={cn(
            'flex-shrink-0 w-full lg:w-[360px] xl:w-[400px]',
            'border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800',
            'h-[48vh] lg:h-auto overflow-hidden',
            'flex flex-col min-h-0',
          )}>
            {hotspots && edis ? (
              <SidePanel
                hotspots={hotspots}
                selected={selected}
                edis={edis}
                dayView={dayView}
                onSelect={handleSelect}
                onClose={handleClose}
                onAssign={() => setDialogOpen(true)}
                filter={filter}
              />
            ) : (
              <div className="p-4 space-y-3 flex-1">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ASSIGN DIALOG */}
      <AssignDialog
        open={dialogOpen}
        hotspot={selected}
        onClose={() => setDialogOpen(false)}
        onToast={handleToast}
      />

      {/* TOAST */}
      <AnimatePresence>
        {toast && <Toast key="t" message={toast} onDone={handleDone} />}
      </AnimatePresence>
    </div>
  )
}
