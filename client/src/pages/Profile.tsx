import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  User, Mail, Phone, Shield, MapPin,
  Clock, CheckCircle2, Camera, Lock, Loader2, AtSign,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { getMe, updateProfile } from '../lib/api'

// ─── Form Field ───────────────────────────────────────────────────────────────

interface FieldProps {
  label:       string
  icon:        React.ReactNode
  value:       string
  onChange:    (v: string) => void
  type?:       string
  placeholder?: string
  readOnly?:   boolean
  hint?:       string
}

function Field({ label, icon, value, onChange, type = 'text', placeholder, readOnly = false, hint }: FieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {icon}
        {label}
        {readOnly && (
          <span className="ml-auto text-[10px] font-normal normal-case text-gray-400">
            read-only
          </span>
        )}
      </label>
      <div className={cn(
        'relative flex items-center rounded-xl border transition-all duration-200',
        readOnly
          ? 'bg-gray-50/80 border-gray-200/60'
          : 'bg-white border-gray-200',
        !readOnly && focused
          ? 'border-brand-cyan shadow-[0_0_0_3px_rgba(6,182,212,0.12)]'
          : '',
      )}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            'w-full bg-transparent py-3 px-4 text-sm outline-none rounded-xl',
            readOnly
              ? 'text-gray-500 cursor-default'
              : 'text-gray-900',
            'placeholder:text-gray-400',
          )}
        />
      </div>
      {hint && <p className="text-[11px] text-gray-400 pl-1">{hint}</p>}
    </div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6 bg-white border-gray-200 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-gradient-to-b from-brand-900 to-brand-cyan" />
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Fade-up wrapper ─────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, size = 96 }: { initials: string; size?: number }) {
  return (
    <div className="relative inline-block group" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-black tracking-wide select-none ring-4 ring-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)', fontSize: size * 0.3 }}
      >
        {initials}
      </div>
      <button
        type="button"
        onClick={() => toast.info('Avatar uploads are managed by your administrator')}
        className={cn(
          'absolute inset-0 rounded-full flex items-center justify-center',
          'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'text-white',
        )}
        aria-label="Change avatar"
      >
        <Camera size={Math.round(size * 0.22)} />
      </button>
      <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  useEffect(() => { document.title = 'My Profile — ParkVUE' }, [])

  const { user, updateUser } = useAuth()
  const fetchedRef = useRef(false)

  const [name,     setName]     = useState(user?.name     ?? '')
  const [email,    setEmail]    = useState(user?.email    ?? '')
  const [phone,    setPhone]    = useState(user?.number   ?? '')
  const [username, setUsername] = useState(user?.username ?? '')

  // Sync fields whenever user object is set or updated
  useEffect(() => {
    if (user) {
      setName(user.name        ?? '')
      setEmail(user.email      ?? '')
      setPhone(user.number     ?? '')
      setUsername(user.username ?? '')
    }
  }, [user])

  // Fallback: token exists but user wasn't in localStorage → fetch from API once
  useEffect(() => {
    if (!user && !fetchedRef.current) {
      fetchedRef.current = true
      getMe()
        .then((me) => updateUser(me))
        .catch(() => {})
    }
  }, [user, updateUser])

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }, [])

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'AD'

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const updated = await updateProfile({ name: name.trim(), email: email.trim(), number: phone.trim(), username: username.trim() })
      updateUser(updated)
      setSaved(true)
      toast.success('Profile updated', { description: 'Your changes have been saved.', icon: <CheckCircle2 size={16} /> })
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : 'Could not update profile.' })
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <Loader2 size={28} className="animate-spin text-brand-cyan" />
        <p className="text-sm text-gray-500">
          Loading your profile… If this does not finish, sign in again.
        </p>
      </div>
    )
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const dirty =
    name.trim()     !== (user.name     ?? '') ||
    email.trim()    !== (user.email    ?? '') ||
    phone.trim()    !== (user.number   ?? '') ||
    username.trim() !== (user.username ?? '')

  const saveButton = (
    <motion.button
      type="button"
      onClick={handleSave}
      disabled={saving || (!dirty && !saved)}
      whileHover={saving ? {} : { scale: 1.03, boxShadow: '0 0 20px rgba(6,182,212,0.3)' }}
      whileTap={saving ? {} : { scale: 0.97 }}
      className={cn(
        'flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white',
        'transition-all duration-200',
        saving || (!dirty && !saved) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      )}
      style={{ background: saved ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#1e3a8a,#06b6d4)' }}
    >
      {saving ? (
        <><Loader2 size={15} className="animate-spin" /> Saving…</>
      ) : saved ? (
        <><CheckCircle2 size={15} /> Saved!</>
      ) : (
        'Save Changes'
      )}
    </motion.button>
  )

  return (
    <div className="max-w-5xl mx-auto pb-12">

      {/* Page heading + primary save */}
      <FadeUp>
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your personal details and contact information.
            </p>
          </div>
          <div className="hidden sm:block">{saveButton}</div>
        </div>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT: identity card (sticky) ── */}
        <FadeUp delay={0.08}>
          <div className="lg:sticky lg:top-6">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Gradient cover */}
              <div className="h-24 relative" style={{ background: 'linear-gradient(120deg, #0c1f5e 0%, #1e3a8a 45%, #06b6d4 100%)' }}>
                <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
                  <defs>
                    <pattern id="pf-hex" width="34" height="30" patternUnits="userSpaceOnUse">
                      <polygon points="8,1 26,1 33,15 26,29 8,29 1,15" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#pf-hex)" />
                </svg>
              </div>

              {/* Avatar overlap + identity */}
              <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
                <Avatar initials={initials} size={88} />
                <h2 className="mt-3 text-lg font-bold text-gray-900 leading-tight">{user.name || '—'}</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <AtSign size={11} className="text-brand-cyan" />
                  {user.username || '—'}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                    <Shield size={11} />
                    {user.role === 'admin' ? 'Administrator' : 'Officer'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Meta list */}
                <div className="mt-5 w-full space-y-2.5 text-left">
                  {[
                    { icon: <MapPin size={13} />, label: 'Station', value: user.police_station || '—' },
                    { icon: <Mail size={13} />,   label: 'Email',   value: user.email || '—' },
                    { icon: <Clock size={13} />,  label: 'Joined',  value: memberSince },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                      <span className="text-brand-cyan flex-shrink-0">{row.icon}</span>
                      <span className="text-[11px] text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">{row.label}</span>
                      <span className="text-xs font-medium text-gray-700 truncate ml-auto text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* ── RIGHT: editable form ── */}
        <div className="lg:col-span-2 space-y-6">

          <FadeUp delay={0.14}>
            <Section title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Full Name"
                  icon={<User size={12} />}
                  value={name}
                  onChange={setName}
                  placeholder="Enter full name"
                />
                <Field
                  label="Username"
                  icon={<AtSign size={12} />}
                  value={username}
                  onChange={setUsername}
                  placeholder="username"
                  hint="Your login ID — letters, numbers, dot, underscore"
                />
                <Field
                  label="Email Address"
                  icon={<Mail size={12} />}
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="officer@police.gov.in"
                  hint="Used for login and notifications"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Phone Number"
                    icon={<Phone size={12} />}
                    value={phone}
                    onChange={setPhone}
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
            </Section>
          </FadeUp>

          <FadeUp delay={0.20}>
            <Section title="Account Information">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  label="Role"
                  icon={<Shield size={12} />}
                  value={user.role === 'admin' ? 'Administrator' : 'Officer'}
                  onChange={() => {}}
                  readOnly
                />
                <Field
                  label="Police Station"
                  icon={<MapPin size={12} />}
                  value={user.police_station ?? '—'}
                  onChange={() => {}}
                  readOnly
                />
                <Field
                  label="Account Status"
                  icon={<CheckCircle2 size={12} />}
                  value={user.is_active ? 'Active' : 'Inactive'}
                  onChange={() => {}}
                  readOnly
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
                <Lock size={13} />
                Password is managed by administration
              </div>
            </Section>
          </FadeUp>

          {/* Footer save (sticky on mobile, inline on desktop) */}
          <FadeUp delay={0.26}>
            <div className="flex items-center justify-end gap-3">
              {dirty && !saving && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
              {saveButton}
            </div>
          </FadeUp>
        </div>
      </div>
    </div>
  )
}
