import { useState, useMemo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Award, ChevronLeft, ChevronRight,
  Check, X, Activity, TrendingUp, Info, Eye,
  MapPin, AlertTriangle, Clock, UserMinus, ShieldAlert, Loader2,
} from 'lucide-react'
import { useOfficers, usePendingOfficers } from '../hooks/useMockData'
import type { Officer, OfficerStatus, PendingOfficer } from '../types'
import { Dialog } from '../components/ui/Dialog'
import { StatCard } from '../components/ui/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/utils'
import { request } from '../lib/api'
import {
  getUnassignRequests, approveUnassign, rejectUnassign,
  getGeofenceBreaches, getAssignments, cancelAssignment,
  type UnassignRequest, type GeofenceBreach,
} from '../lib/api'
import { ENDPOINTS, IS_LIVE } from '../config/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OfficerStatus, { dot: string; label: string; badge: string; avatarBg: string }> = {
  active: {
    dot: 'bg-green-500',
    label: 'Active',
    badge: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800',
    avatarBg: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  on_patrol: {
    dot: 'bg-amber-500',
    label: 'On Patrol',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    avatarBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  available: {
    dot: 'bg-cyan-500',
    label: 'Available',
    badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    avatarBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  },
  off_duty: {
    dot: 'bg-gray-400',
    label: 'Off Duty',
    badge: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    avatarBg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
}

const TABS = [
  { id: 'active', label: 'Active Officers' },
  { id: 'pending', label: 'Pending Approvals' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'requests', label: 'Unassign Requests' },
  { id: 'alerts', label: 'Geofence Alerts' },
] as const

type TabId = typeof TABS[number]['id']
const PER_PAGE = 12

// Shape of an assignment row from GET /assignments
interface AssignmentRow {
  id: string
  status: string
  time_limit: string | null
  created_at: string
  user?: { name?: string }
  user_id: string
  cell: { h3_index: string; risk_level: string; latitude: number | null; longitude: number | null }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function effBarColor(score: number): string {
  if (score >= 50) return 'bg-low-500'
  if (score >= 30) return 'bg-medium-500'
  return 'bg-critical-500'
}

function getInitials(badgeId: string): string {
  const n = badgeId.replace('BTP-', '').replace(/^0+/, '') || '?'
  return n.slice(0, 2).padEnd(2, '0')
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

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

function EmptyState({ icon: Icon, title, sub }: {
  icon: (props: { size?: number; className?: string }) => ReactNode
  title: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Icon size={26} className="text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

// ─── Officer Card ─────────────────────────────────────────────────────────────

function OfficerCard({ officer, delay, onViewProfile }: {
  officer: Officer
  delay: number
  onViewProfile: (o: Officer) => void
}) {
  const cfg = STATUS_CONFIG[officer.status]
  const initials = getInitials(officer.badge_id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-surface-dark-card',
        'p-4 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200',
      )}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none', cfg.avatarBg)}>
            {initials}
          </div>
          <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-dark-card', cfg.dot)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{officer.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{officer.badge_id}</p>
        </div>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', cfg.badge)}>
          {cfg.label}
        </span>
      </div>

      {/* Station */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="text-gray-400 dark:text-gray-600 mr-1">Station</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{officer.station}</span>
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 py-2">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{officer.total_tickets.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tickets</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 py-2">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{(officer.approval_rate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Approval</p>
        </div>
      </div>

      {/* Effectiveness */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 dark:text-gray-400">Effectiveness</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{officer.effectiveness_score.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${officer.effectiveness_score}%` }}
            transition={{ duration: 0.6, delay: delay + 0.2, ease: 'easeOut' }}
            className={cn('h-full rounded-full', effBarColor(officer.effectiveness_score))}
          />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onViewProfile(officer)}
        className={cn(
          'mt-auto flex items-center justify-center gap-1.5 text-xs font-medium',
          'rounded-xl py-1.5 border',
          'text-brand-600 dark:text-brand-400',
          'border-brand-200 dark:border-brand-800',
          'bg-brand-50 dark:bg-brand-950/30',
          'hover:bg-brand-100 dark:hover:bg-brand-900/40',
          'transition-colors duration-150',
        )}
      >
        <Eye size={12} />
        View Profile
      </button>
    </motion.div>
  )
}

// ─── Pending Card ─────────────────────────────────────────────────────────────

function PendingCard({ officer, delay, onApprove, onReject, onViewDetails }: {
  officer: PendingOfficer
  delay: number
  onApprove: (o: PendingOfficer) => void
  onReject: (o: PendingOfficer) => void
  onViewDetails: (o: PendingOfficer) => void
}) {
  const avatarLabel = officer.name.split(' ').pop()?.slice(0, 2) ?? '??'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-surface-dark-card',
        'p-4 flex flex-col gap-3',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{avatarLabel}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{officer.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{officer.badge_id}</p>
          </div>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 whitespace-nowrap flex-shrink-0">
          Pending
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <p className="text-gray-400 dark:text-gray-500">Station</p>
          <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{officer.requested_station}</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500">Applied</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{officer.applied_on}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onApprove(officer)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors duration-150"
        >
          <Check size={12} />
          Approve
        </button>
        <button
          onClick={() => onReject(officer)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-xl bg-critical-50 dark:bg-critical-950/30 text-critical-700 dark:text-critical-400 border border-critical-200 dark:border-critical-800 hover:bg-critical-100 dark:hover:bg-critical-900/40 transition-colors duration-150"
        >
          <X size={12} />
          Reject
        </button>
        <button
          onClick={() => onViewDetails(officer)}
          className="flex items-center justify-center px-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
          title="View details"
        >
          <Info size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SELECT_CLS = cn(
  'px-3 py-2 text-sm rounded-xl',
  'bg-white dark:bg-surface-dark-card',
  'border border-gray-200 dark:border-gray-800',
  'text-gray-700 dark:text-gray-300',
  'outline-none focus:ring-2 focus:ring-brand-cyan/40',
)

export default function OfficerManagement() {
  const [searchParams] = useSearchParams()
  const { data: officers, loading: officersLoading, refetch: refetchOfficers } = useOfficers()
  const { data: pendingData, loading: pendingLoading, refetch: refetchPending } = usePendingOfficers()

  // Local mutable pending list (approve / reject). Synced to latest server data
  // on every (re)fetch so approvals/rejections elsewhere are reflected.
  const [pendingList, setPendingList] = useState<PendingOfficer[] | null>(null)
  useEffect(() => {
    if (pendingData) setPendingList(pendingData)
  }, [pendingData])

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>('active')

  // Active officers filters — seeded from ?q= so the topbar search lands here.
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [stationFilter, setStationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [search, stationFilter, statusFilter])

  // Re-apply the query string when the topbar navigates here again.
  const queryParam = searchParams.get('q') ?? ''
  useEffect(() => {
    if (queryParam) setSearch(queryParam)
  }, [queryParam])

  // Dialogs
  const [profileOfficer, setProfileOfficer] = useState<Officer | null>(null)
  const [pendingDetail, setPendingDetail] = useState<PendingOfficer | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingOfficer | null>(null)

  // Live lifecycle data (assigned / unassign-requests / geofence alerts)
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null)
  const [unassignReqs, setUnassignReqs] = useState<UnassignRequest[] | null>(null)
  const [breaches, setBreaches] = useState<GeofenceBreach[] | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  useEffect(() => { document.title = 'Officer Management — ParkVUE' }, [])

  // Fetch tab-specific data whenever the inner tab changes. The first mount is
  // skipped for active/pending (their hooks already fetch on mount) so we don't
  // double-fetch; re-entering a tab always pulls fresh data (e.g. a newly
  // approved officer shows up in Active without a manual page refresh).
  const firstTabRun = useRef(true)
  useEffect(() => {
    if (!firstTabRun.current) {
      if (activeTab === 'active') refetchOfficers()
      if (activeTab === 'pending') refetchPending()
    }
    firstTabRun.current = false

    if (!IS_LIVE) return
    if (activeTab === 'assigned') {
      setAssignments(null)
      getAssignments('active').then((r) => setAssignments(r as AssignmentRow[])).catch(() => setAssignments([]))
    }
    if (activeTab === 'requests') {
      setUnassignReqs(null)
      getUnassignRequests('pending').then(setUnassignReqs).catch(() => setUnassignReqs([]))
    }
    if (activeTab === 'alerts') {
      setBreaches(null)
      getGeofenceBreaches().then(setBreaches).catch(() => setBreaches([]))
    }
    // refetch fns are stable (useCallback); only re-run on tab change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const stations = useMemo(() => {
    if (!officers) return []
    return [...new Set(officers.map(o => o.station))].sort()
  }, [officers])

  const filteredOfficers = useMemo(() => {
    if (!officers) return []
    const q = search.toLowerCase()
    return officers.filter(o => {
      const matchSearch = !q || o.name.toLowerCase().includes(q) || o.badge_id.toLowerCase().includes(q)
      const matchStation = stationFilter === 'all' || o.station === stationFilter
      const matchStatus = statusFilter === 'all' || o.status === statusFilter
      return matchSearch && matchStation && matchStatus
    })
  }, [officers, search, stationFilter, statusFilter])

  const totalPages = Math.ceil(filteredOfficers.length / PER_PAGE)
  const pageData = filteredOfficers.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const totalActive = officers?.filter(o => o.status !== 'off_duty').length ?? 0
  const onPatrol = officers?.filter(o => o.status === 'on_patrol').length ?? 0
  const availableCount = officers?.filter(o => o.status === 'available').length ?? 0
  const avgEff = officers?.length
    ? officers.reduce((s, o) => s + o.effectiveness_score, 0) / officers.length
    : 0

  const pendingCount = pendingList?.length ?? 0

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleApprove(o: PendingOfficer) {
    setPendingList(prev => prev?.filter(p => p.id !== o.id) ?? [])
    try {
      if (IS_LIVE) {
        const res = await request<{ username?: string; email_sent?: boolean; temp_password?: string }>(
          `${ENDPOINTS.approveOfficer}/${o.id}`, { method: 'POST', body: {} },
        )
        if (res.email_sent === false && res.temp_password) {
          // Mail down/unconfigured — show credentials so admin can relay them manually.
          toast.warning(`${o.name} approved, but email failed. Username: ${res.username} · Temp password: ${res.temp_password}`, { duration: 15000 })
        } else {
          toast.success(`${o.name} approved — login credentials emailed`)
        }
      } else {
        toast.success(`${o.name} approved — login credentials emailed`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed')
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    const { id, name } = rejectTarget
    setPendingList(prev => prev?.filter(p => p.id !== id) ?? [])
    setRejectTarget(null)
    try {
      if (IS_LIVE) await request(`${ENDPOINTS.rejectOfficer}/${id}`, { method: 'POST', body: {} })
      toast.error(`${name} application rejected`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed')
    }
  }

  async function handleUnassignApprove(id: string) {
    setActionBusy(id)
    try { await approveUnassign(id); setUnassignReqs(p => p?.filter(r => r.id !== id) ?? []); toast.success('Unassign approved — officer freed') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionBusy(null) }
  }

  async function handleUnassignReject(id: string) {
    setActionBusy(id)
    try { await rejectUnassign(id); setUnassignReqs(p => p?.filter(r => r.id !== id) ?? []); toast('Request rejected') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionBusy(null) }
  }

  async function handleCancelAssignment(id: string) {
    setActionBusy(id)
    try { await cancelAssignment(id); setAssignments(p => p?.filter(a => a.id !== id) ?? []); toast.success('Assignment cancelled') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionBusy(null) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">

      {/* Page header */}
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-brand-cyan bg-clip-text text-transparent">
          Officer Management
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage officer assignments, approvals, and performance across all police stations
        </p>
      </FadeUp>

      {/* Tab bar */}
      <FadeUp delay={0.05} className="mb-6">
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 w-fit flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-white dark:bg-surface-dark-card text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {tab.label}
              {tab.id === 'pending' && !pendingLoading && pendingCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </FadeUp>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >

          {/* ── TAB 1: Active Officers ── */}
          {activeTab === 'active' && (
            <div className="space-y-5">

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {officersLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-28" />)
                ) : (
                  <>
                    <StatCard title="Total Active" value={totalActive} icon={Activity} color="blue" />
                    <StatCard title="On Patrol" value={onPatrol} icon={TrendingUp} color="orange" />
                    <StatCard title="Available" value={availableCount} icon={Check} color="green" />
                    <StatCard
                      title="Avg Effectiveness"
                      value={0}
                      displayValue={`${avgEff.toFixed(1)}%`}
                      icon={Award}
                      color="purple"
                    />
                  </>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name or badge ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-8 pr-3 py-2 text-sm rounded-xl',
                      'bg-white dark:bg-surface-dark-card',
                      'border border-gray-200 dark:border-gray-800',
                      'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600',
                      'outline-none focus:ring-2 focus:ring-brand-cyan/40',
                    )}
                  />
                </div>
                <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className={SELECT_CLS}>
                  <option value="all">All Stations</option>
                  {stations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={SELECT_CLS}>
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="on_patrol">On Patrol</option>
                  <option value="available">Available</option>
                  <option value="off_duty">Off Duty</option>
                </select>
              </div>

              {/* Results label */}
              {!officersLoading && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {pageData.length} of {filteredOfficers.length} officer{filteredOfficers.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Grid */}
              {officersLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} height="h-52" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pageData.map((officer, idx) => (
                      <OfficerCard
                        key={officer.id}
                        officer={officer}
                        delay={idx * 0.04}
                        onViewProfile={setProfileOfficer}
                      />
                    ))}
                    {pageData.length === 0 && (
                      <div className="col-span-3 flex flex-col items-center py-20 text-gray-400 dark:text-gray-600">
                        <Search size={36} className="mb-3 opacity-40" />
                        <p className="text-sm">No officers match your filters.</p>
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400 min-w-24 text-center">
                        Page {page + 1} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TAB 2: Pending Approvals ── */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingLoading
                  ? 'Loading applications…'
                  : `${pendingCount} application${pendingCount !== 1 ? 's' : ''} awaiting review`}
              </p>

              {pendingLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="h-52" />)}
                </div>
              ) : pendingCount === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center mb-4">
                    <Check size={32} className="text-green-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">All caught up!</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No pending officer registration requests.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {(pendingList ?? []).map((officer, idx) => (
                      <PendingCard
                        key={officer.id}
                        officer={officer}
                        delay={idx * 0.04}
                        onApprove={handleApprove}
                        onReject={setRejectTarget}
                        onViewDetails={setPendingDetail}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: Assigned officers ── */}
          {activeTab === 'assigned' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {assignments == null ? 'Loading…' : `${assignments.length} active assignment${assignments.length !== 1 ? 's' : ''}`}
              </p>
              {assignments == null ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
              ) : assignments.length === 0 ? (
                <EmptyState icon={MapPin} title="No active assignments" sub="Assign officers from the Hotspots map." />
              ) : (
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card">
                      <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                        <MapPin size={15} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.user?.name ?? 'Officer'}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
                          Zone {a.cell.h3_index} · {a.cell.risk_level}
                          {a.time_limit && ` · until ${new Date(a.time_limit).toLocaleString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelAssignment(a.id)}
                        disabled={actionBusy === a.id}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-critical-700 dark:text-critical-400 bg-critical-50 dark:bg-critical-950/30 border border-critical-200 dark:border-critical-800 hover:bg-critical-100 disabled:opacity-50 transition-colors"
                      >
                        {actionBusy === a.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <><UserMinus size={12} /> Unassign</>
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: Unassign / can't-reach requests ── */}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {unassignReqs == null ? 'Loading…' : `${unassignReqs.length} pending request${unassignReqs.length !== 1 ? 's' : ''}`}
              </p>
              {unassignReqs == null ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-20" />)}</div>
              ) : unassignReqs.length === 0 ? (
                <EmptyState icon={Check} title="No pending requests" sub="Officers' can't-reach requests appear here." />
              ) : (
                <div className="space-y-2">
                  {unassignReqs.map((r) => (
                    <div key={r.id} className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                          <Clock size={15} className="text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.officer.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">Zone {r.assignment.cell.h3_index}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 italic">“{r.reason}”</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleUnassignApprove(r.id)} disabled={actionBusy === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 disabled:opacity-50 transition-colors">
                          {actionBusy === r.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <><Check size={12} /> Approve &amp; unassign</>
                          }
                        </button>
                        <button onClick={() => handleUnassignReject(r.id)} disabled={actionBusy === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-xl bg-critical-50 dark:bg-critical-950/30 text-critical-700 dark:text-critical-400 border border-critical-200 dark:border-critical-800 hover:bg-critical-100 disabled:opacity-50 transition-colors">
                          {actionBusy === r.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <><X size={12} /> Reject</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: Geofence alerts ── */}
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {breaches == null ? 'Loading…' : `${breaches.length} out-of-zone event${breaches.length !== 1 ? 's' : ''}`}
              </p>
              {breaches == null ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
              ) : breaches.length === 0 ? (
                <EmptyState icon={ShieldAlert} title="No geofence breaches" sub="Officers leaving their zone are flagged here." />
              ) : (
                <div className="space-y-2">
                  {breaches.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-critical-200 dark:border-critical-900/50 bg-critical-50/50 dark:bg-critical-950/20">
                      <div className="w-9 h-9 rounded-full bg-critical-100 dark:bg-critical-900/40 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={15} className="text-critical-600 dark:text-critical-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{b.officer_name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
                          Zone {b.zone ?? '—'} · {b.distance_m != null ? `${b.distance_m} m out` : 'out of range'}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(b.at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Officer Profile Dialog ── */}
      <Dialog open={!!profileOfficer} onClose={() => setProfileOfficer(null)} title="Officer Profile" width="max-w-sm">
        {profileOfficer && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold',
                STATUS_CONFIG[profileOfficer.status].avatarBg,
              )}>
                {getInitials(profileOfficer.badge_id)}
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{profileOfficer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profileOfficer.badge_id}</p>
              </div>
              <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full border', STATUS_CONFIG[profileOfficer.status].badge)}>
                {STATUS_CONFIG[profileOfficer.status].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{profileOfficer.total_tickets.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Tickets</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{(profileOfficer.approval_rate * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approval Rate</p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 dark:text-gray-400">Effectiveness Score</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{profileOfficer.effectiveness_score.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', effBarColor(profileOfficer.effectiveness_score))}
                  style={{ width: `${profileOfficer.effectiveness_score}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ['Station', profileOfficer.station],
                ['Last Location', profileOfficer.last_lat != null && profileOfficer.last_lon != null
                  ? `${profileOfficer.last_lat.toFixed(4)}, ${profileOfficer.last_lon.toFixed(4)}`
                  : 'No location yet'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Pending Detail Dialog ── */}
      <Dialog open={!!pendingDetail} onClose={() => setPendingDetail(null)} title="Application Details" width="max-w-sm">
        {pendingDetail && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-col items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-xl font-bold text-amber-700 dark:text-amber-300">
                {pendingDetail.name.split(' ').pop()?.slice(0, 2) ?? '??'}
              </div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{pendingDetail.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{pendingDetail.badge_id}</p>
            </div>
            {([
              ['Requested Station', pendingDetail.requested_station],
              ['Phone', pendingDetail.phone],
              ['Email', pendingDetail.email],
              ['Applied On', pendingDetail.applied_on],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-right text-xs">{value}</span>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* ── Reject Confirm Dialog ── */}
      <Dialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Application"
        description={rejectTarget ? `Are you sure you want to reject ${rejectTarget.name}'s registration? This action cannot be undone.` : undefined}
        width="max-w-sm"
      >
        {rejectTarget && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setRejectTarget(null)}
              className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectConfirm}
              className="flex-1 py-2 text-sm font-medium rounded-xl bg-critical-600 text-white hover:bg-critical-700 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </Dialog>

    </div>
  )
}
