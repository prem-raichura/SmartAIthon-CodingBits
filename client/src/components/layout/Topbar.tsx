import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Search, Bell, ChevronDown, User, LogOut, Navigation, AlarmClock, Info, CheckCheck } from 'lucide-react'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import {
  getNotifications,
  markNotificationRead,
  type AdminNotification,
} from '../../lib/api'
import { IS_LIVE } from '../../config/api'

// ─── Notification Panel ───────────────────────────────────────────────────────

const TYPE_ICON: Record<string, typeof Navigation> = {
  assignment: Navigation,
  reminder: AlarmClock,
  system: Info,
}
const TYPE_COLOR: Record<string, string> = {
  assignment: '#0ea5e9',
  reminder: '#f59e0b',
  system: '#6b7280',
}

function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const fetchNotifs = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getNotifications()
      // Never trust the shape: a non-array here used to crash every
      // authenticated page at the items.filter() calls below.
      setItems(Array.isArray(data) ? data : [])
    } catch {
      // API may not be running in dev — ignore silently
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount + poll every 30s
  useEffect(() => {
    if (!IS_LIVE) return
    fetchNotifs()
    const t = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(t)
  }, [fetchNotifs])

  // Fetch fresh when panel opens
  useEffect(() => {
    if (open && IS_LIVE) fetchNotifs()
  }, [open, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleItem(n: AdminNotification) {
    setOpen(false)
    if (!n.is_read) {
      try {
        await markNotificationRead(n.notification_id)
        setItems((prev) =>
          prev.map((x) => x.notification_id === n.notification_id ? { ...x, is_read: true } : x)
        )
      } catch { /* ignore */ }
    }
    if (n.assignment_id) navigate('/officers')
  }

  async function markAllRead() {
    const unreadItems = items.filter((n) => !n.is_read)
    await Promise.allSettled(unreadItems.map((n) => markNotificationRead(n.notification_id)))
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative p-2 rounded-lg',
          'text-gray-500 hover:text-gray-700',
          'hover:bg-gray-100',
          'transition-colors duration-150',
          open && 'bg-gray-100 text-gray-700',
        )}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className={cn(
            'absolute top-1.5 right-1.5',
            'h-[15px] w-[15px] rounded-full',
            'bg-critical-500 text-white',
            'text-[9px] font-bold',
            'flex items-center justify-center leading-none',
          )}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute right-0 top-full mt-2 w-80 z-50',
              'rounded-xl border shadow-lg shadow-black/10',
              'bg-white border-gray-200',
              'overflow-hidden',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-900">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading…</div>
              ) : items.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">No notifications yet</p>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Info
                  const color = TYPE_COLOR[n.type] ?? '#6b7280'
                  return (
                    <button
                      key={n.notification_id}
                      onClick={() => handleItem(n)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left',
                        'border-b border-gray-50 last:border-0',
                        'hover:bg-gray-50 transition-colors duration-100',
                        !n.is_read && 'bg-blue-50/40',
                      )}
                    >
                      <span
                        className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: color + '18' }}
                      >
                        <Icon size={14} style={{ color }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-900 truncate flex-1">{n.title}</p>
                          {!n.is_read && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-4">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {timeAgo(n.sent_at)}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Profile dropdown ────────────────────────────────────────────────────────

function ProfileDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
    : 'AD'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const go = (path: string) => { setOpen(false); navigate(path) }

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-xl',
          'hover:bg-gray-100',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60',
          open && 'bg-gray-100',
        )}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <div className={cn(
          'h-7 w-7 rounded-full flex-shrink-0',
          'bg-gradient-to-br from-brand-900 to-brand-cyan',
          'flex items-center justify-center',
          'text-white text-[11px] font-bold tracking-wide',
        )}>
          {initials}
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-gray-800 leading-none">
            {user?.name ?? 'Admin'}
          </span>
          <span className="text-[10px] text-gray-400 leading-none mt-0.5">
            {user?.email ?? '—'}
          </span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="hidden sm:block"
        >
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute right-0 top-full mt-2 w-52 z-50',
              'rounded-xl border shadow-lg shadow-black/10',
              'bg-white border-gray-200',
              'overflow-hidden',
            )}
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-900">{user?.name ?? 'Admin Officer'}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                {user?.email ?? ''}
              </p>
            </div>

            <div className="py-1">
              {[
                { icon: User, label: 'My Profile', action: () => go('/profile') },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm',
                    'text-gray-600',
                    'hover:bg-gray-50',
                    'hover:text-gray-900',
                    'transition-colors duration-100',
                  )}
                >
                  <Icon size={14} className="flex-shrink-0 text-gray-400" />
                  {label}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => { setOpen(false); logout(); navigate('/login', { replace: true }) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm',
                  'text-critical-600',
                  'hover:bg-critical-50',
                  'transition-colors duration-100',
                )}
              >
                <LogOut size={14} className="flex-shrink-0" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Topbar ──────────────────────────────────────────────────────────────────

interface TopbarProps {
  onMenuToggle: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  // Enter hands the term to Officer Management, which already filters on name
  // and badge ID. Previously this input had no handler at all.
  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchTerm.trim()
    if (!q) return
    navigate(`/officers?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className={cn(
      'sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 px-4 md:px-6',
      'bg-white/90',
      'backdrop-blur-md',
      'border-b border-gray-200',
    )}>
      {/* Hamburger — always visible, beside search */}
      <button
        onClick={onMenuToggle}
        className={cn(
          'flex-shrink-0 p-2 rounded-lg',
          'text-gray-500 hover:text-gray-700',
          'hover:bg-gray-100',
          'transition-colors duration-150',
        )}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <form onSubmit={submitSearch} className="flex-1 max-w-xs md:max-w-sm">
        <motion.div
          transition={{ duration: 0.2 }}
          className={cn(
            'relative flex items-center gap-2 rounded-lg border px-3 py-2',
            'bg-gray-50',
            'transition-all duration-200',
            searchFocused
              ? 'border-brand-cyan shadow-[0_0_0_3px_rgba(6,182,212,0.12)]'
              : 'border-gray-200',
          )}
        >
          <Search size={15} className="flex-shrink-0 text-gray-400" />
          <input
            type="search"
            placeholder="Search hotspots, officers, zones…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'w-full bg-transparent text-sm outline-none',
              'text-gray-800',
              'placeholder:text-gray-400',
            )}
          />
        </motion.div>
      </form>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Notification bell */}
        <NotificationPanel />

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-1" />

        {/* Profile dropdown */}
        <ProfileDropdown />
      </div>
    </header>
  )
}
