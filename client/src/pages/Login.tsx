import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// HEX LOGO  — camera-aperture enforcement badge
// ─────────────────────────────────────────────────────────────────────────────

function HexLogo({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="ParkVUE"
      className="object-contain select-none"
      draggable={false}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC BACKGROUND — illegal parking → congestion → hotspot scene
// ─────────────────────────────────────────────────────────────────────────────

function TrafficMapFull() {
  return (
    <div className="absolute inset-0 overflow-hidden">

      {/* ── Road infrastructure SVG (viewBox 500×600, fills panel exactly) ── */}
      <svg viewBox="0 0 500 600" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Vertical roads */}
        <rect x="60"  y="0" width="28" height="600" fill="rgba(30,58,138,0.10)" />
        <rect x="408" y="0" width="28" height="600" fill="rgba(30,58,138,0.10)" />
        <line x1="60"  y1="0" x2="60"  y2="600" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="88"  y1="0" x2="88"  y2="600" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="408" y1="0" x2="408" y2="600" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="436" y1="0" x2="436" y2="600" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="74"  y1="0" x2="74"  y2="600" stroke="rgba(255,255,255,0.52)" strokeWidth="1" strokeDasharray="12,10"/>
        <line x1="422" y1="0" x2="422" y2="600" stroke="rgba(255,255,255,0.52)" strokeWidth="1" strokeDasharray="12,10"/>

        {/* Main horizontal road — MG Road (congested) */}
        <rect x="0" y="220" width="500" height="50" fill="rgba(30,58,138,0.11)" />
        <line x1="0" y1="220" x2="500" y2="220" stroke="rgba(30,58,138,0.28)" strokeWidth="2"/>
        <line x1="0" y1="270" x2="500" y2="270" stroke="rgba(30,58,138,0.28)" strokeWidth="2"/>
        <line x1="0" y1="245" x2="500" y2="245" stroke="rgba(255,255,255,0.60)" strokeWidth="1.2" strokeDasharray="14,10"/>

        {/* Secondary horizontal road — Outer Ring Road */}
        <rect x="0" y="455" width="500" height="40" fill="rgba(30,58,138,0.09)" />
        <line x1="0" y1="455" x2="500" y2="455" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="0" y1="495" x2="500" y2="495" stroke="rgba(30,58,138,0.22)" strokeWidth="1.5"/>
        <line x1="0" y1="475" x2="500" y2="475" stroke="rgba(255,255,255,0.48)" strokeWidth="1" strokeDasharray="10,9"/>

        {/* Intersection highlights */}
        <rect x="60"  y="220" width="28" height="50" fill="rgba(6,182,212,0.09)" />
        <rect x="408" y="220" width="28" height="50" fill="rgba(6,182,212,0.09)" />
        <rect x="60"  y="455" width="28" height="40" fill="rgba(6,182,212,0.07)" />
        <rect x="408" y="455" width="28" height="40" fill="rgba(6,182,212,0.07)" />

        {/* ── ILLEGALLY PARKED VEHICLE — blocks upper lane of MG Road ── */}
        <rect x="190" y="222" width="54" height="21" fill="rgba(239,68,68,0.80)" stroke="rgba(220,38,38,1)" strokeWidth="1.5" rx="3.5"/>
        <rect x="200" y="226" width="14" height="7" fill="rgba(254,226,226,0.68)" rx="1.5"/>
        <rect x="221" y="226" width="14" height="7" fill="rgba(254,226,226,0.68)" rx="1.5"/>
        <circle cx="200" cy="243" r="4" fill="rgba(80,0,0,0.55)" stroke="rgba(239,68,68,0.80)" strokeWidth="1"/>
        <circle cx="236" cy="243" r="4" fill="rgba(80,0,0,0.55)" stroke="rgba(239,68,68,0.80)" strokeWidth="1"/>
        {/* Warning triangles flanking the parked car */}
        <path d="M 178 237 L 183 228 L 188 237 Z" fill="#fbbf24" stroke="rgba(180,83,9,0.55)" strokeWidth="0.8"/>
        <path d="M 252 237 L 257 228 L 262 237 Z" fill="#fbbf24" stroke="rgba(180,83,9,0.55)" strokeWidth="0.8"/>
        {/* "ILLEGALLY PARKED" banner */}
        <rect x="179" y="207" width="82" height="12" fill="rgba(220,38,38,0.93)" rx="2.5"/>
        <text x="220" y="216.5" fontSize="6.8" fill="white" fontWeight="800" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="0.04em">ILLEGALLY PARKED</text>

        {/* Congestion zone annotation */}
        <text x="220" y="288" fontSize="7" fill="rgba(239,68,68,0.68)" fontWeight="700" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="0.06em">▼ CONGESTION ZONE</text>

        {/* Road name labels */}
        <text x="4" y="215" fontSize="7.5" fill="rgba(30,58,138,0.50)" fontFamily="system-ui,sans-serif" fontWeight="600">MG Road</text>
        <text x="4" y="450" fontSize="7.5" fill="rgba(30,58,138,0.50)" fontFamily="system-ui,sans-serif" fontWeight="600">Outer Ring Road</text>
        <text x="62" y="14" fontSize="7" fill="rgba(30,58,138,0.45)" fontFamily="system-ui,sans-serif">Hosur Rd</text>
        <text x="410" y="14" fontSize="7" fill="rgba(30,58,138,0.45)" fontFamily="system-ui,sans-serif">Brigade Rd</text>

        {/* Minor hotspot markers at intersections */}
        <circle cx="74"  cy="232" r="5.5" fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.52)" strokeWidth="1"/>
        <circle cx="74"  cy="232" r="2.2" fill="rgba(249,115,22,0.78)"/>
        <circle cx="422" cy="475" r="4.5" fill="rgba(249,115,22,0.14)" stroke="rgba(249,115,22,0.42)" strokeWidth="0.8"/>
        <circle cx="422" cy="475" r="1.8" fill="rgba(249,115,22,0.65)"/>
      </svg>

      {/* ── Pulsing hotspot rings centered on the parked/blocked zone ── */}
      {/* Parked car at SVG x=217/500=43%, y=232/600=39% */}
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ top: '39%', left: '43%', width: 130, height: 130, marginTop: -65, marginLeft: -65,
          background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.32)' }}
        animate={{ scale: [1, 1.38, 1], opacity: [0.65, 0.15, 0.65] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ top: '39%', left: '43%', width: 76, height: 76, marginTop: -38, marginLeft: -38,
          background: 'rgba(239,68,68,0.14)', border: '1.5px solid rgba(239,68,68,0.50)' }}
        animate={{ scale: [1, 1.28, 1], opacity: [0.75, 0.25, 0.75] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ top: '39%', left: '43%', width: 28, height: 28, marginTop: -14, marginLeft: -14,
          background: 'rgba(239,68,68,0.68)' }}
        animate={{ opacity: [1, 0.40, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} />

      {/* ── CONGESTED VEHICLES — upper lane, piling up before parked car ── */}
      {/* easeOut = rush in then decelerate to near-stop — simulates traffic queue */}
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 0    }}><div style={{ width: 15, height: 8, background: '#f59e0b', borderRadius: 3, boxShadow: '0 0 7px rgba(245,158,11,0.92)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 1.8  }}><div style={{ width: 13, height: 8, background: '#f97316', borderRadius: 3, boxShadow: '0 0 6px rgba(249,115,22,0.88)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 3.6  }}><div style={{ width: 16, height: 8, background: '#fbbf24', borderRadius: 3, boxShadow: '0 0 6px rgba(251,191,36,0.88)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 5.4  }}><div style={{ width: 14, height: 8, background: '#ef4444', borderRadius: 3, boxShadow: '0 0 7px rgba(239,68,68,0.88)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 7.2  }}><div style={{ width: 15, height: 8, background: '#f59e0b', borderRadius: 3, boxShadow: '0 0 6px rgba(245,158,11,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 9.0  }}><div style={{ width: 13, height: 8, background: '#f97316', borderRadius: 3, boxShadow: '0 0 6px rgba(249,115,22,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 10.8 }}><div style={{ width: 16, height: 8, background: '#fbbf24', borderRadius: 3, boxShadow: '0 0 6px rgba(251,191,36,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 12.6 }}><div style={{ width: 14, height: 8, background: '#ef4444', borderRadius: 3, boxShadow: '0 0 6px rgba(239,68,68,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 14.4 }}><div style={{ width: 15, height: 8, background: '#f59e0b', borderRadius: 3, boxShadow: '0 0 6px rgba(245,158,11,0.78)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['-5%', '37%'] }} transition={{ duration: 18, ease: 'easeOut', repeat: Infinity, repeatDelay: 1, delay: 16.2 }}><div style={{ width: 13, height: 8, background: '#f97316', borderRadius: 3, boxShadow: '0 0 6px rgba(249,115,22,0.78)' }} /></motion.div>

      {/* ── FREE FLOW after blocked zone — upper lane, right of parked car ── */}
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['51%', '108%'] }} transition={{ duration: 6, ease: 'linear', repeat: Infinity, delay: 0   }}><div style={{ width: 14, height: 8, background: '#06b6d4', borderRadius: 3, boxShadow: '0 0 7px rgba(6,182,212,0.90)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['51%', '108%'] }} transition={{ duration: 6, ease: 'linear', repeat: Infinity, delay: 2.5 }}><div style={{ width: 16, height: 8, background: '#0ea5e9', borderRadius: 3, boxShadow: '0 0 6px rgba(14,165,233,0.88)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '37%' }} animate={{ left: ['51%', '108%'] }} transition={{ duration: 6, ease: 'linear', repeat: Infinity, delay: 4.8 }}><div style={{ width: 13, height: 8, background: '#38bdf8', borderRadius: 3, boxShadow: '0 0 6px rgba(56,189,248,0.88)' }} /></motion.div>

      {/* ── LOWER LANE — opposite direction, fully unaffected ── */}
      <motion.div className="absolute" style={{ top: '42%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 9,  ease: 'linear', repeat: Infinity, delay: 0   }}><div style={{ width: 14, height: 8, background: '#3b82f6', borderRadius: 3, boxShadow: '0 0 6px rgba(59,130,246,0.85)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '42%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 9,  ease: 'linear', repeat: Infinity, delay: 3   }}><div style={{ width: 16, height: 8, background: '#2563eb', borderRadius: 3, boxShadow: '0 0 5px rgba(37,99,235,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '42%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 9,  ease: 'linear', repeat: Infinity, delay: 6   }}><div style={{ width: 13, height: 8, background: '#1d4ed8', borderRadius: 3, boxShadow: '0 0 5px rgba(29,78,216,0.80)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '43%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 11, ease: 'linear', repeat: Infinity, delay: 1.5 }}><div style={{ width: 18, height: 8, background: '#6366f1', borderRadius: 3, boxShadow: '0 0 5px rgba(99,102,241,0.78)' }} /></motion.div>

      {/* ── SECONDARY ROAD (~77%) — both directions, normal flow ── */}
      <motion.div className="absolute" style={{ top: '77%' }} animate={{ left: ['-5%', '108%'] }} transition={{ duration: 8,  ease: 'linear', repeat: Infinity, delay: 0   }}><div style={{ width: 14, height: 7, background: '#06b6d4', borderRadius: 3, boxShadow: '0 0 5px rgba(6,182,212,0.82)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '77%' }} animate={{ left: ['-5%', '108%'] }} transition={{ duration: 8,  ease: 'linear', repeat: Infinity, delay: 3.5 }}><div style={{ width: 16, height: 7, background: '#0ea5e9', borderRadius: 3, boxShadow: '0 0 5px rgba(14,165,233,0.78)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '77%' }} animate={{ left: ['-5%', '108%'] }} transition={{ duration: 8,  ease: 'linear', repeat: Infinity, delay: 6.5 }}><div style={{ width: 13, height: 7, background: '#38bdf8', borderRadius: 3, boxShadow: '0 0 5px rgba(56,189,248,0.78)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '80%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 10, ease: 'linear', repeat: Infinity, delay: 0   }}><div style={{ width: 14, height: 7, background: '#3b82f6', borderRadius: 3, boxShadow: '0 0 5px rgba(59,130,246,0.80)' }} /></motion.div>
      <motion.div className="absolute" style={{ top: '80%' }} animate={{ left: ['108%', '-5%'] }} transition={{ duration: 10, ease: 'linear', repeat: Infinity, delay: 4.5 }}><div style={{ width: 16, height: 7, background: '#2563eb', borderRadius: 3, boxShadow: '0 0 4px rgba(37,99,235,0.78)' }} /></motion.div>

      {/* ── VERTICAL ROAD 1 (left ~13-16%) ── */}
      <motion.div className="absolute" style={{ left: '13%' }} animate={{ top: ['-5%', '108%'] }} transition={{ duration: 11, ease: 'linear', repeat: Infinity, delay: 2   }}><div style={{ width: 7, height: 14, background: '#06b6d4', borderRadius: 3, boxShadow: '0 0 5px rgba(6,182,212,0.80)' }} /></motion.div>
      <motion.div className="absolute" style={{ left: '13%' }} animate={{ top: ['-5%', '108%'] }} transition={{ duration: 11, ease: 'linear', repeat: Infinity, delay: 8   }}><div style={{ width: 7, height: 13, background: '#38bdf8', borderRadius: 3, boxShadow: '0 0 4px rgba(56,189,248,0.75)' }} /></motion.div>
      <motion.div className="absolute" style={{ left: '16%' }} animate={{ top: ['108%', '-5%'] }} transition={{ duration: 13, ease: 'linear', repeat: Infinity, delay: 4   }}><div style={{ width: 7, height: 14, background: '#3b82f6', borderRadius: 3, boxShadow: '0 0 4px rgba(59,130,246,0.78)' }} /></motion.div>

      {/* ── VERTICAL ROAD 2 (right ~82-85%) ── */}
      <motion.div className="absolute" style={{ left: '82%' }} animate={{ top: ['-5%', '108%'] }} transition={{ duration: 12, ease: 'linear', repeat: Infinity, delay: 0   }}><div style={{ width: 7, height: 14, background: '#0ea5e9', borderRadius: 3, boxShadow: '0 0 5px rgba(14,165,233,0.80)' }} /></motion.div>
      <motion.div className="absolute" style={{ left: '82%' }} animate={{ top: ['-5%', '108%'] }} transition={{ duration: 12, ease: 'linear', repeat: Infinity, delay: 6.5 }}><div style={{ width: 7, height: 13, background: '#06b6d4', borderRadius: 3, boxShadow: '0 0 4px rgba(6,182,212,0.78)' }} /></motion.div>
      <motion.div className="absolute" style={{ left: '85%' }} animate={{ top: ['108%', '-5%'] }} transition={{ duration: 14, ease: 'linear', repeat: Infinity, delay: 3   }}><div style={{ width: 7, height: 14, background: '#2563eb', borderRadius: 3, boxShadow: '0 0 4px rgba(37,99,235,0.78)' }} /></motion.div>

      {/* Scan sweep */}
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.06), transparent)', width: '35%' }}
        animate={{ left: ['-35%', '135%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear', repeatDelay: 3 }} />

      {/* Live indicator */}
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, zIndex: 10 }}>
        <motion.div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.1, repeat: Infinity }} />
        <span style={{ fontSize: 8, fontWeight: 700, color: '#166534', letterSpacing: '0.08em' }}>LIVE</span>
      </div>
    </div>
  )
}

function LeftPanel() {
  const panelBg = 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 35%, #eff6ff 70%, #f0f9ff 100%)'

  return (
    <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="hidden lg:block relative w-1/2 overflow-hidden"
      style={{ background: panelBg }}>

      {/* Accent bar — top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-30"
        style={{ background: 'linear-gradient(90deg, #1e3a8a, #06b6d4, #1e3a8a)' }} />

      {/* ── BACKGROUND: full-panel animated traffic scene ── */}
      <TrafficMapFull />

      {/* ── Soft center glow so brand text stays readable ── */}
      <div className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse 72% 44% at 50% 48%, rgba(239,246,255,0.82) 0%, rgba(219,234,254,0.32) 58%, transparent 82%)' }} />

      {/* ── FOREGROUND: brand in lower half — illegal parking scene visible above ── */}
      <div className="absolute z-20 select-none"
        style={{ top: '50%', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <motion.div
          animate={{
            filter: [
              'drop-shadow(0 0 10px rgba(6,182,212,0.55))',
              'drop-shadow(0 0 28px rgba(6,182,212,0.95))',
              'drop-shadow(0 0 10px rgba(6,182,212,0.55))',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ marginBottom: 18 }}>
          <HexLogo size={76} />
        </motion.div>

        <h1 style={{
          fontSize: 52, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1, margin: 0,
          background: 'linear-gradient(90deg, #1e3a8a 0%, #0891b2 50%, #1d4ed8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 2px 16px rgba(6,182,212,0.38))',
          marginBottom: 12,
        }}>
          ParkVUE
        </h1>

        <p style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: '#0e7490', margin: 0,
          textShadow: '0 1px 8px rgba(239,246,255,0.95)',
        }}>
          Keep Cities Moving
        </p>
      </div>

    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE TOP BANNER
// ─────────────────────────────────────────────────────────────────────────────

function MobileBanner() {
  return (
    <div className="lg:hidden flex items-center justify-center h-20 flex-shrink-0 transition-all duration-300"
      style={{ background: 'linear-gradient(135deg, #dbeafe, #e0f2fe)' }}>
      <div className="flex items-center gap-3">
        <HexLogo size={30} />
        <div>
          <p className="font-bold text-base leading-none transition-colors duration-300 text-gray-900">
            ParkVUE
          </p>
          <p className="text-[10px] leading-none mt-0.5 transition-colors duration-300 text-gray-600">
            Keep Cities Moving          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM FIELD
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  left: React.ReactNode
  right?: React.ReactNode
  autoComplete?: string
}

function Field({ id, label, type, value, onChange, placeholder, left, right, autoComplete }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
      </label>
      <div className={cn(
        'relative flex items-center rounded-xl border transition-all duration-200',
        'bg-gray-50',
        'border-gray-200',
        'focus-within:border-brand-cyan focus-within:shadow-[0_0_0_3px_rgba(6,182,212,0.12)]',
      )}>
        <span className="absolute left-3.5 flex-shrink-0 text-gray-400 pointer-events-none">
          {left}
        </span>
        <input id={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoComplete={autoComplete}
          className={cn(
            'w-full bg-transparent py-3 pl-10 text-sm outline-none',
            right ? 'pr-10' : 'pr-4',
            'text-gray-900',
            'placeholder:text-gray-400',
          )} />
        {right && <span className="absolute right-3.5 flex-shrink-0">{right}</span>}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// LOGIN FORM PANEL
// ─────────────────────────────────────────────────────────────────────────────

function LoginForm() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(
      'flex flex-1 lg:w-1/2 items-center justify-center overflow-y-auto',
      'px-4 py-8 sm:px-8',
      'bg-gray-50',
    )}>
      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[400px]">

        {/* Card */}
        <div className={cn(
          'rounded-2xl p-8 sm:p-10',
          'bg-white/80',
          'backdrop-blur-xl',
          'border border-gray-200/80',
          'shadow-xl shadow-black/5',
        )}>
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Sign in to ParkVUE
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Access the admin command center
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field id="username" label="Username" type="text"
              value={username} onChange={setUsername}
              placeholder="admin" autoComplete="username"
              left={<Mail size={15} />} />

            <Field id="password" label="Password" type={showPwd ? 'text' : 'password'}
              value={password} onChange={setPassword}
              placeholder="Enter your password" autoComplete="current-password"
              left={<Lock size={15} />}
              right={
                <button type="button" onClick={() => setShowPwd((s) => !s)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              } />

            <motion.button type="submit" disabled={loading}
              whileHover={loading ? {} : { scale: 1.02, boxShadow: '0 0 20px rgba(6,182,212,0.3)' }}
              whileTap={loading ? {} : { scale: 0.98 }}
              className={cn(
                'mt-2 w-full py-3 rounded-xl font-semibold text-sm text-white',
                'flex items-center justify-center gap-2',
                'transition-opacity duration-150',
                loading ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer',
              )}
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Signing in…
                  </motion.span>
                ) : (
                  <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    Sign In <ArrowRight size={15} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.45 }}
          className="mt-5 text-center">
          <Link to="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400
                       hover:text-gray-600 transition-colors duration-150">
            <ArrowLeft size={12} />
            Back to home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  useEffect(() => { document.title = 'Sign In — ParkVUE' }, [])
  return (
    <div className="relative flex h-screen overflow-hidden flex-col lg:flex-row">
      <LeftPanel />
      <MobileBanner />
      <LoginForm />
    </div>
  )
}
