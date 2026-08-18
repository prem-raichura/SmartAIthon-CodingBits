import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ClipboardList, Camera, MapPin, AlertTriangle, CheckCircle2,
  Search, User, Clock, Car, RefreshCw, ImageOff, ExternalLink, FileText,
} from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { Dialog } from '../components/ui/Dialog'
import { cn } from '../lib/utils'
import { getFieldReports, getFieldReportStats } from '../lib/api'
import type { FieldReport, FieldReportStats } from '../lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_FILTERS = ['all', 'none', 'low', 'medium', 'high'] as const
type SeverityFilter = (typeof SEVERITY_FILTERS)[number]

const SEVERITY_STYLE: Record<string, string> = {
  high:   'bg-critical-50 text-critical-700 border-critical-200',
  medium: 'bg-high-50 text-high-700 border-high-200',
  low:    'bg-medium-50 text-medium-700 border-medium-200',
  none:   'bg-gray-100 text-gray-600 border-gray-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function FadeUp({ children, delay = 0, className }: {
  children: ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-6%' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >{children}</motion.div>
  )
}

function SeverityChip({ value }: { value: string | null }) {
  const key = value ?? 'none'
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize',
      SEVERITY_STYLE[key] ?? SEVERITY_STYLE.none,
    )}>
      {key}
    </span>
  )
}

/** Thumbnail that degrades to a placeholder instead of a broken-image icon —
 *  older reports may hold a LAN URL that is unreachable from this browser. */
function PhotoThumb({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])

  if (!url || failed) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg bg-gray-100 text-gray-400 border border-gray-200',
        className,
      )}>
        <ImageOff size={16} />
        <span className="text-[9px] font-semibold">{url ? 'unreachable' : 'no photo'}</span>
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover rounded-lg border border-gray-200 bg-gray-100', className)}
    />
  )
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText size={36} className="mb-3 opacity-30 text-gray-400" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-400 max-w-sm">{sub}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FieldReports() {
  useEffect(() => { document.title = 'Field Reports — ParkVUE' }, [])

  const [reports, setReports] = useState<FieldReport[] | null>(null)
  const [stats, setStats] = useState<FieldReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<FieldReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        getFieldReports({ severity }),
        getFieldReportStats().catch(() => null),
      ])
      setReports(Array.isArray(list) ? list : [])
      if (s) setStats(s)
    } catch (e: unknown) {
      setReports([])
      setError(e instanceof Error ? e.message : 'Could not load field reports.')
    } finally {
      setLoading(false)
    }
  }, [severity])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    if (!reports) return []
    const q = search.trim().toLowerCase()
    if (!q) return reports
    return reports.filter((r) =>
      r.officer.name.toLowerCase().includes(q) ||
      r.officer.station.toLowerCase().includes(q) ||
      r.officer.badge_id.toLowerCase().includes(q) ||
      r.zone.label.toLowerCase().includes(q) ||
      (r.zone.location ?? '').toLowerCase().includes(q),
    )
  }, [reports, search])

  return (
    <div className="pb-6">

      {/* Page header */}
      <FadeUp className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-brand-cyan bg-clip-text text-transparent">
            Field Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ground-truth validations submitted by officers from their assigned zones
          </p>
        </div>
        <button
          onClick={() => { void load() }}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors',
            'border-gray-200 text-gray-600 bg-white hover:bg-gray-50',
            loading && 'opacity-60',
          )}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </FadeUp>

      {/* Stat cards */}
      <FadeUp delay={0.04} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-28" />)
        ) : (
          <>
            <StatCard title="Total Reports" value={stats?.total ?? 0} icon={ClipboardList} color="blue" />
            <StatCard title="Congestion Confirmed" value={stats?.with_congestion ?? 0} icon={AlertTriangle} color="orange" />
            <StatCard title="With Photo Evidence" value={stats?.with_photo ?? 0} icon={Camera} color="cyan" />
            <StatCard title="High Severity" value={stats?.by_severity?.high ?? 0} icon={CheckCircle2} color="red" />
          </>
        )}
      </FadeUp>

      {/* Filters */}
      <FadeUp delay={0.08} className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search officer, badge, station or zone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-brand-cyan/40"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 w-fit">
          {SEVERITY_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200',
                severity === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </FadeUp>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-critical-200 bg-critical-50 px-4 py-3">
          <AlertTriangle size={16} className="text-critical-600 flex-shrink-0" />
          <p className="text-sm text-critical-700 flex-1">{error}</p>
          <button onClick={() => { void load() }} className="text-sm font-bold text-critical-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Report list */}
      <FadeUp delay={0.12}>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-24" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={reports?.length ? 'No reports match your filters' : 'No field reports yet'}
              sub={
                reports?.length
                  ? 'Try a different severity or clear the search box.'
                  : 'Reports appear here once officers submit validations from the mobile app for their assigned zones.'
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {visible.map((r) => (
                <button
                  key={r.validation_id}
                  onClick={() => setDetail(r)}
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <PhotoThumb url={r.photo_url} alt={`Report by ${r.officer.name}`} className="w-20 h-20 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-900">{r.officer.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{r.officer.badge_id}</span>
                      <SeverityChip value={r.congestion_severity} />
                      {r.has_congestion && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-high-700">
                          <AlertTriangle size={11} /> congestion observed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 mb-1.5">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {r.zone.label}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User size={11} /> {r.officer.station}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {formatWhen(r.submitted_at)}
                      </span>
                      {r.dominant_vehicle_type && (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Car size={11} /> {r.dominant_vehicle_type}
                          {r.vehicle_count_approx != null && ` · ~${r.vehicle_count_approx}`}
                        </span>
                      )}
                    </div>

                    {(r.opinion || r.notes) && (
                      <p className="text-xs text-gray-600 line-clamp-2">{r.opinion || r.notes}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </FadeUp>

      {/* Detail dialog */}
      <AnimatePresence>
        {detail && (
          <Dialog
            open={!!detail}
            onClose={() => setDetail(null)}
            title="Field report"
            description={`${detail.officer.name} · ${formatWhen(detail.submitted_at)}`}
            width="max-w-2xl"
          >
            <div className="space-y-4">
              <PhotoThumb
                url={detail.photo_url}
                alt={`Report by ${detail.officer.name}`}
                className="w-full h-64"
              />

              <div className="grid grid-cols-2 gap-3">
                <Detail label="Officer" value={`${detail.officer.name} (${detail.officer.badge_id})`} />
                <Detail label="Station" value={detail.officer.station} />
                <Detail label="Zone" value={detail.zone.label} />
                <Detail label="Zone risk" value={detail.zone.risk_level} />
                <Detail label="Congestion" value={detail.has_congestion ? 'Observed' : 'None'} />
                <Detail label="Severity" value={detail.congestion_severity ?? 'none'} />
                <Detail label="Dominant vehicle" value={detail.dominant_vehicle_type ?? '—'} />
                <Detail
                  label="Approx. vehicle count"
                  value={detail.vehicle_count_approx != null ? String(detail.vehicle_count_approx) : '—'}
                />
              </div>

              {detail.opinion && <Block label="Officer opinion" value={detail.opinion} />}
              {detail.notes && <Block label="Notes" value={detail.notes} />}

              {detail.latitude != null && detail.longitude != null && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-mono text-xs text-gray-600">
                    {detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${detail.latitude}&mlon=${detail.longitude}#map=17/${detail.latitude}/${detail.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
                  >
                    Open map <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {detail.photo_url && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(detail.photo_url!)
                      .then(() => toast.success('Photo URL copied'))
                      .catch(() => toast.error('Could not copy'))
                  }}
                  className="w-full py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Copy photo URL
                </button>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800 capitalize truncate">{value}</p>
    </div>
  )
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}
