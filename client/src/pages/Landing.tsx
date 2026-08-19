import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useInView, animate } from 'framer-motion'
import {
  ChevronDown, ArrowRight,
  Car, MapPin, AlertTriangle, Activity, Navigation,
  FileText, Building2, Clock, Layers,
  Code2, MessageSquare, Briefcase,
  Bell, Camera, CheckCircle2, Shield, Smartphone,
  Download, X, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatNumber } from '../lib/utils'
import mobileAppImg from '../assets/mobile-app.jpeg'
import traffic1Img from '../assets/traffic1.png'
import traffic2Img from '../assets/traffic2.png'

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED PARTICLE CANVAS
// ─────────────────────────────────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width  = window.innerWidth  + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    interface Dot { x: number; y: number; vx: number; vy: number; r: number }
    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const COUNT = 70, LINK = 130
    const dotColor   = 'rgba(6,182,212,0.55)'
    const lineAlpha  = 0.28

    const dots: Dot[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W(), y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W(), H())
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > W()) d.vx *= -1
        if (d.y < 0 || d.y > H()) d.vy *= -1
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.fill()
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK) {
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(6,182,212,${(1 - dist / LINK) * lineAlpha})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />
}

// ─────────────────────────────────────────────────────────────────────────────
// HEXAGON GRID BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────

function HexGrid() {
  const stroke = 'rgba(6,182,212,0.18)'
  const fill   = 'rgba(6,182,212,0.07)'
  const bright = 'rgba(6,182,212,0.45)'

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lp-hex" x="0" y="0" width="58" height="50" patternUnits="userSpaceOnUse">
            <polygon points="14,2 44,2 57,25 44,48 14,48 1,25" fill="none" stroke={stroke} strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp-hex)" />
      </svg>
      {[
        { cx: '15%', cy: '25%', delay: 0   },
        { cx: '75%', cy: '18%', delay: 0.8 },
        { cx: '88%', cy: '55%', delay: 1.6 },
        { cx: '30%', cy: '72%', delay: 0.4 },
        { cx: '60%', cy: '40%', delay: 1.2 },
        { cx: '5%',  cy: '60%', delay: 2.0 },
      ].map(({ cx, cy, delay }, i) => (
        <div key={i} className="absolute animate-hexagon-pulse" style={{ left: cx, top: cy, animationDelay: `${delay}s` }}>
          <svg width="54" height="48" viewBox="0 0 54 48" fill="none">
            <polygon points="13,2 41,2 54,25 41,46 13,46 0,25" fill={fill} stroke={bright} strokeWidth="1" />
          </svg>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING LUCIDE ICONS
// ─────────────────────────────────────────────────────────────────────────────

const FLOATERS = [
  { Icon: Car,           x: '8%',  y: '28%', size: 22, duration: 7,  delay: 0   },
  { Icon: MapPin,        x: '82%', y: '18%', size: 18, duration: 9,  delay: 1.2 },
  { Icon: AlertTriangle, x: '72%', y: '62%', size: 20, duration: 6,  delay: 0.6 },
  { Icon: Activity,      x: '18%', y: '65%', size: 16, duration: 8,  delay: 2.0 },
  { Icon: Navigation,    x: '91%', y: '82%', size: 19, duration: 10, delay: 0.3 },
]

function FloatingIcons() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {FLOATERS.map(({ Icon, x, y, size, duration, delay }, i) => (
        <motion.div key={i} className="absolute" style={{ left: x, top: y }}
          animate={{ y: [0, -10, 0] }} transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}>
          <Icon size={size} className="text-brand-cyan opacity-[0.15]" />
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY SKYLINE
// ─────────────────────────────────────────────────────────────────────────────

function CityScape() {
  const bA = 0.14   // building fill alpha
  const gA = 0.08   // glass accent alpha

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none" aria-hidden="true">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="w-full">
        <rect x="0"    y="120" width="55"  height="40"  fill={`rgba(30,58,138,${bA})`} />
        <rect x="8"    y="95"  width="28"  height="65"  fill={`rgba(30,58,138,${bA + 0.04})`} />
        <rect x="22"   y="108" width="12"  height="52"  fill={`rgba(6,182,212,${gA})`} />
        <rect x="62"   y="80"  width="45"  height="80"  fill={`rgba(30,58,138,${bA + 0.02})`} />
        <rect x="72"   y="65"  width="18"  height="95"  fill={`rgba(30,58,138,${bA + 0.07})`} />
        <rect x="115"  y="90"  width="38"  height="70"  fill={`rgba(30,58,138,${bA})`} />
        <rect x="120"  y="72"  width="14"  height="88"  fill={`rgba(6,182,212,${gA - 0.02})`} />
        <rect x="160"  y="100" width="60"  height="60"  fill={`rgba(30,58,138,${bA - 0.02})`} />
        <rect x="175"  y="55"  width="22"  height="105" fill={`rgba(30,58,138,${bA + 0.10})`} />
        <rect x="182"  y="45"  width="8"   height="115" fill={`rgba(6,182,212,${gA + 0.02})`} />
        <rect x="230"  y="85"  width="50"  height="75"  fill={`rgba(30,58,138,${bA - 0.01})`} />
        <rect x="290"  y="75"  width="40"  height="85"  fill={`rgba(30,58,138,${bA + 0.02})`} />
        <rect x="295"  y="58"  width="16"  height="102" fill={`rgba(30,58,138,${bA + 0.10})`} />
        <rect x="380"  y="70"  width="42"  height="90"  fill={`rgba(30,58,138,${bA + 0.04})`} />
        <rect x="392"  y="48"  width="20"  height="112" fill={`rgba(30,58,138,${bA + 0.12})`} />
        <rect x="398"  y="36"  width="6"   height="124" fill={`rgba(6,182,212,${gA + 0.04})`} />
        <rect x="548"  y="50"  width="18"  height="110" fill={`rgba(30,58,138,${bA + 0.07})`} />
        <rect x="666"  y="55"  width="14"  height="105" fill={`rgba(6,182,212,${gA + 0.01})`} />
        <rect x="770"  y="60"  width="42"  height="100" fill={`rgba(30,58,138,${bA + 0.06})`} />
        <rect x="776"  y="42"  width="16"  height="118" fill={`rgba(30,58,138,${bA + 0.14})`} />
        <rect x="782"  y="30"  width="4"   height="130" fill={`rgba(6,182,212,${gA + 0.06})`} />
        <rect x="1010" y="52"  width="18"  height="108" fill={`rgba(30,58,138,${bA + 0.10})`} />
        <rect x="1016" y="38"  width="6"   height="122" fill={`rgba(6,182,212,${gA + 0.03})`} />
        <rect x="1180" y="48"  width="16"  height="112" fill={`rgba(30,58,138,${bA + 0.08})`} />
        <rect x="1365" y="52"  width="20"  height="108" fill={`rgba(30,58,138,${bA + 0.10})`} />
        <rect x="0"    y="155" width="1440" height="2"  fill="rgba(6,182,212,0.15)" />
        <rect x="0"    y="157" width="1440" height="3"  fill="rgba(30,58,138,0.25)" />
      </svg>
      <AnimatedVehicles />
    </div>
  )
}

function AnimatedVehicles() {
  const vehicles = [
    { delay: 0, y: -32, speed: 18, size: 12 },
    { delay: 5, y: -28, speed: 24, size: 10 },
    { delay: 11, y: -34, speed: 14, size: 11 },
    { delay: 3,  y: -30, speed: 20, size: 10 },
  ]
  return (
    <>
      {vehicles.map(({ delay, y, speed, size }, i) => (
        <motion.div key={i} className="absolute" style={{ bottom: Math.abs(y), left: 0 }}
          animate={{ x: ['-60px', '110vw'] }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay }}>
          <Car size={size} className="text-brand-cyan opacity-30" />
        </motion.div>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEX LOGO — camera-aperture enforcement badge
// ─────────────────────────────────────────────────────────────────────────────

function HexLogo({ size = 32 }: { size?: number }) {
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
// COUNT-UP
// ─────────────────────────────────────────────────────────────────────────────

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [display, setDisplay] = useState('0')
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, { duration: 2, ease: 'easeOut', onUpdate: (v) => setDisplay(formatNumber(Math.round(v))) })
    return controls.stop
  }, [inView, to])

  return <span ref={ref}>{display}{suffix}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-sm'
        : 'bg-transparent',
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.4 }}>
            <HexLogo size={30} />
          </motion.div>
          <span className={cn('font-bold text-lg tracking-tight transition-colors duration-200',
            scrolled ? 'text-gray-900' : 'text-gray-800')}>
            ParkVUE
          </span>
        </Link>

        {/* Right: login */}
        <div className="flex items-center gap-3">
          <motion.button onClick={() => navigate('/login')}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}>
            Login
          </motion.button>
        </div>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICER APK DOWNLOAD MODAL
// ─────────────────────────────────────────────────────────────────────────────

const APK_FILE_ID = '1R3sV99athsq63b8X3V__uW7IDbDjFASf'
// usercontent host + confirm=t skips the Drive virus-scan interstitial for large files
const APK_DOWNLOAD_URL = `https://drive.usercontent.google.com/download?id=${APK_FILE_ID}&export=download&confirm=t`

function ApkDownloadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = APK_DOWNLOAD_URL
    a.download = 'ParkVUE-Officer.apk'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Download started', { description: 'Check your browser downloads for the APK.' })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog" aria-modal="true" aria-labelledby="apk-modal-title"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient top bar */}
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#1e3a8a,#06b6d4,#3b82f6)' }} />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="px-7 pt-7 pb-6">
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}
              >
                <Smartphone size={26} className="text-white" />
              </div>

              <h3 id="apk-modal-title" className="text-xl font-bold text-gray-900 mb-1.5">
                ParkVUE Officer App
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Field companion for enforcement officers — live assignments, on-site
                capture, and instant violation reporting.
              </p>

              {/* Download row */}
              <button
                onClick={handleDownload}
                className="group w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-brand-500/60 hover:bg-brand-50/40 transition-all duration-200 text-left"
              >
                <div
                  className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #1e3a8a)' }}
                >
                  <Download size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">Download APK</div>
                  <div className="text-xs text-gray-500">Android · Direct install file</div>
                </div>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-gray-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all duration-200"
                />
              </button>

              {/* Note */}
              <div className="mt-5 flex items-start gap-2.5 text-[11px] leading-relaxed text-gray-500">
                <ShieldCheck size={14} className="shrink-0 mt-px text-brand-600" />
                <span>
                  Restricted to authorised enforcement officers. Android may ask you to
                  allow installs from unknown sources before opening the file.
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const navigate = useNavigate()
  const [apkModalOpen, setApkModalOpen] = useState(false)

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-slate-50">
      <ParticleCanvas />
      <HexGrid />
      <FloatingIcons />

      {/* Radial glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at center, rgba(30,58,138,0.08) 0%, transparent 70%)',
            'radial-gradient(ellipse at center, rgba(6,182,212,0.10) 0%, transparent 70%)',
            'radial-gradient(ellipse at center, rgba(30,58,138,0.08) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-8 border border-brand-500/25 bg-brand-50/80 text-brand-700">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
          Traffic Police — Command Intelligence Portal
        </motion.div>

        {/* Heading */}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="animate-gradient-shift font-black tracking-tight leading-none mb-6"
          style={{
            fontSize: 'clamp(3.5rem, 10vw, 7.5rem)',
            background: 'linear-gradient(90deg,#1e3a8a,#06b6d4,#3b82f6,#06b6d4,#1e3a8a)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
          ParkVUE
        </motion.h1>

        {/* Subheading */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-gray-600">
          AI-powered parking enforcement intelligence. Detect hotspots,
          predict congestion, optimize officer deployment.
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.button onClick={() => navigate('/login')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(6,182,212,0.35)' }} whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}>
            Get Started <ArrowRight size={16} />
          </motion.button>
          <motion.button onClick={() => setApkModalOpen(true)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border border-gray-300 text-gray-600 hover:border-brand-500/50 hover:text-brand-700 bg-white/60 hover:bg-white">
            <div className="flex flex-col items-start leading-tight">
              <span>Download Mobile App</span>
              <span className="text-[10px] font-medium tracking-wide" style={{ opacity: 0.55 }}>For Officers Only</span>
            </div>
          </motion.button>
        </motion.div>
      </div>

      <CityScape />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400"
        animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true">
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown size={16} />
      </motion.div>

      <ApkDownloadModal open={apkModalOpen} onClose={() => setApkModalOpen(false)} />
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { icon: FileText,  value: 298450, suffix: '+', label: 'Violations Analyzed',  sub: 'From Nov 2023 – Apr 2024' },
  { icon: Building2, value: 54,     suffix: '',  label: 'Police Stations',       sub: 'Connected across the city' },
  { icon: Layers,    value: 35,     suffix: '',  label: 'Active Hotspots',        sub: 'Continuously monitored' },
  { icon: Clock,     value: 0,      suffix: '',  label: '24/7 Intelligence',     sub: 'Real-time anomaly detection', display: '24/7' },
]

function StatsSection() {
  return (
    <section
      className="relative overflow-hidden py-24 px-4 sm:px-6"
      style={{ background: 'linear-gradient(180deg, #eef5ff 0%, #e4efff 50%, #eef5ff 100%)' }}
    >
      {/* ── Animated central radial glow ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        animate={{
          background: [
            'radial-gradient(ellipse at 50% 55%, rgba(30,58,138,0.07) 0%, transparent 62%)',
            'radial-gradient(ellipse at 50% 55%, rgba(6,182,212,0.09) 0%, transparent 62%)',
            'radial-gradient(ellipse at 50% 55%, rgba(30,58,138,0.07) 0%, transparent 62%)',
          ],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Corner accent glows ── */}
      <div className="absolute top-0 left-0 w-96 h-96 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(30,58,138,0.06) 0%, transparent 55%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(circle at 100% 100%, rgba(6,182,212,0.07) 0%, transparent 55%)' }} />

      {/* ── Horizontal scan line ── */}
      <motion.div
        className="absolute left-0 right-0 h-px pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.22) 40%, rgba(6,182,212,0.22) 60%, transparent 100%)',
        }}
        animate={{ top: ['5%', '95%', '5%'] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5 border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
          >
            <Activity size={12} />
            Impact By The Numbers
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            The enforcement backbone
          </h2>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map(({ icon: Icon, value, suffix, label, sub, display }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.11 }}
              whileHover={{ y: -6, scale: 1.03 }}
              className="relative rounded-2xl p-6 border overflow-hidden group cursor-default transition-all duration-300 border-blue-100/80 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-brand-cyan/50 shadow-md hover:shadow-xl hover:shadow-brand-cyan/10"
            >
              {/* Top accent line — reveals on hover */}
              <div
                className="absolute top-0 left-6 right-6 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }}
              />

              {/* Inner corner glow */}
              <div
                className="absolute top-0 right-0 w-28 h-28 rounded-bl-[50%] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'radial-gradient(circle at top right, rgba(6,182,212,0.13), transparent 70%)' }}
              />

              {/* Bottom corner glow */}
              <div
                className="absolute bottom-0 left-0 w-20 h-20 rounded-tr-[50%] opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                style={{ background: 'radial-gradient(circle at bottom left, rgba(30,58,138,0.12), transparent 70%)' }}
              />

              {/* Icon */}
              <motion.div
                className="mb-4 inline-flex p-2.5 rounded-xl"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.22)' }}
                whileHover={{ scale: 1.15, rotate: [0, -6, 6, 0] }}
                transition={{ duration: 0.35 }}
              >
                <Icon size={18} className="text-brand-cyan" />
              </motion.div>

              {/* Value */}
              <p
                className="text-3xl sm:text-4xl font-black tracking-tight mb-1"
                style={{
                  background: 'linear-gradient(90deg,#1e3a8a,#06b6d4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}
              >
                {display ? display : <CountUp to={value} suffix={suffix} />}
              </p>

              <p className="text-sm font-semibold mb-1 text-gray-900">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM SECTION
// ─────────────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    Icon: AlertTriangle,
    color: '#ef4444',
    title: 'Poor Visibility on Parking-Induced Congestion',
    desc: 'No heatmap connecting illegal parking zones to real-time congestion impact — officers fly blind every patrol shift.',
  },
  {
    Icon: Clock,
    color: '#f97316',
    title: 'Reactive, Patrol-Based Enforcement',
    desc: "Enforcement responds after congestion has already formed. There's no system to predict which zones will overflow in the next few hours.",
  },
  {
    Icon: MapPin,
    color: '#eab308',
    title: 'No Enforcement Prioritization',
    desc: 'With 54 stations and hundreds of junctions, officers cannot determine which spots demand immediate deployment.',
  },
  {
    Icon: Activity,
    color: '#a855f7',
    title: 'Manual, Disconnected Coordination',
    desc: 'Photo evidence, officer assignment, and zone validation all happen over calls and paper — no unified operational system.',
  },
]

function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-24 sm:py-32 px-4 sm:px-6"
      style={{ background: 'linear-gradient(180deg, #eef5ff 0%, #e4efff 50%, #eef5ff 100%)' }}
    >
      {/* Subtle problem-tone glows — no hexagons */}
      <div className="absolute top-0 left-0 w-[520px] h-[420px] pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(239,68,68,0.05) 0%, transparent 60%)' }} />
      <div className="absolute bottom-0 right-0 w-[460px] h-[420px] pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(249,115,22,0.04) 0%, transparent 60%)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.03) 0%, transparent 65%)' }} />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444' }}
          >
            <AlertTriangle size={12} />
            The Problem We're Solving
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900"
          >
            Illegal parking is silently{' '}
            <span style={{
              background: 'linear-gradient(90deg,#ef4444,#f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              strangling our roads
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 text-sm max-w-xl mx-auto leading-relaxed text-gray-500"
          >
            On-street illegal parking near commercial areas, metro stations, and events chokes
            carriageways and intersections — while enforcement remains reactive and uncoordinated.
          </motion.p>
        </motion.div>

        {/* Two-column body */}
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* LEFT: Problem list */}
          <div className="flex-1 space-y-0">
            {PROBLEMS.map(({ Icon, color, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -38 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.52, delay: 0.22 + i * 0.13, ease: 'easeOut' }}
                className={cn(
                  'flex items-start gap-4 py-5 group',
                  i < PROBLEMS.length - 1 && 'border-b border-gray-100',
                )}
              >
                <motion.div
                  className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}15`, border: `1px solid ${color}35` }}
                  whileHover={{ scale: 1.12, rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon size={19} style={{ color }} />
                </motion.div>
                <div>
                  <h3 className="text-sm font-bold mb-1.5 group-hover:text-[#ef4444] transition-colors duration-200 text-gray-900">
                    {title}
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* RIGHT: Photo stack */}
          <motion.div
            className="flex-shrink-0 relative w-full lg:w-[440px]"
            style={{ minHeight: 380 }}
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Back photo */}
            <motion.div
              className="absolute"
              style={{ top: 0, left: '8%', right: 0, zIndex: 1 }}
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ transform: 'rotate(-3.5deg)' }}>
                <img src={traffic2Img} alt="Traffic congestion" className="w-full object-cover" style={{ height: 220 }} />
                {/* Red tint overlay */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(249,115,22,0.08) 100%)' }} />
                {/* Dark vignette */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
              </div>
            </motion.div>

            {/* Front photo */}
            <motion.div
              className="relative"
              style={{ marginTop: 80, marginRight: '8%', zIndex: 2 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ transform: 'rotate(2.5deg)' }}>
                <img src={traffic1Img} alt="Illegal parking causing congestion" className="w-full object-cover" style={{ height: 240 }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 35%, rgba(239,68,68,0.14) 100%)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.55) 100%)' }} />
              </div>

              {/* LIVE CONGESTION badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.75 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.65 }}
                style={{
                  position: 'absolute', top: -18, left: -20, zIndex: 10,
                  background: 'rgba(239,68,68,0.95)',
                  borderRadius: 12, padding: '8px 13px',
                  boxShadow: '0 8px 28px rgba(239,68,68,0.45)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <motion.div
                    style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'white', margin: 0 }}>LIVE CONGESTION</p>
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'white', margin: '3px 0 0' }}>Live Feed</p>
              </motion.div>

              {/* Delay stat */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.8 }}
                style={{
                  position: 'absolute', bottom: -20, right: -16, zIndex: 10,
                  background: 'rgba(255,255,255,0.97)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 14, padding: '10px 16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                }}
              >
                <p style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Avg daily delay added
                </p>
                <p style={{
                  fontSize: 22, fontWeight: 900, margin: '3px 0 0',
                  background: 'linear-gradient(90deg,#ef4444,#f97316)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  +38 min
                </p>
              </motion.div>
            </motion.div>

            {/* Spacer so badges don't clip */}
            <div style={{ height: 44 }} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE APP SECTION
// ─────────────────────────────────────────────────────────────────────────────

const APP_FEATURES = [
  {
    Icon: Bell,
    title: 'Instant Assignment Alerts',
    desc: 'Admin assigns a patrol zone — officer receives an instant push notification with zone ID, risk level, and patrol window.',
    color: '#06b6d4',
  },
  {
    Icon: CheckCircle2,
    title: 'Accept & Complete Patrols',
    desc: 'Officers accept assignments, patrol the designated zone, and mark the task complete — all through a streamlined mobile interface.',
    color: '#22c55e',
  },
  {
    Icon: Camera,
    title: 'Geo-tagged Photo Validation',
    desc: 'Submit on-site proof by uploading photos with embedded GPS coordinates. Every image is timestamped and location-verified automatically.',
    color: '#f97316',
  },
  {
    Icon: MapPin,
    title: 'Live Location Verification',
    desc: "Officer's location is continuously traced during the patrol window, cryptographically confirming physical presence at the assigned zone.",
    color: '#a855f7',
  },
]

function NotificationBubble() {
  return (
    <motion.div
      style={{ position: 'absolute', top: -14, right: -72, zIndex: 30, width: 186 }}
      initial={{ opacity: 0, y: -10, scale: 0.82 }}
      animate={{
        opacity: [0, 1, 1, 1, 0],
        y: [-10, 0, 0, 0, -10],
        scale: [0.82, 1, 1, 1, 0.82],
      }}
      transition={{
        duration: 4.5, times: [0, 0.15, 0.6, 0.88, 1],
        repeat: Infinity, repeatDelay: 3.5, ease: 'easeOut',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, padding: '10px 12px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#1e3a8a,#06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={15} color="white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.4 }}>
            New Zone Assigned!
          </p>
          <p style={{ fontSize: 9, color: '#6b7280', margin: '2px 0 0' }}>
            Zone 1FFFF · CRITICAL
          </p>
        </div>
        <motion.div
          style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}
          animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0.7)', '0 0 0 5px rgba(239,68,68,0)', '0 0 0 0 rgba(239,68,68,0)'] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      </div>
    </motion.div>
  )
}

function LocationPingBadge() {
  return (
    <motion.div
      style={{ position: 'absolute', bottom: 36, left: -48, zIndex: 30 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 5, delay: 2.5, ease: 'easeInOut' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Ping rings */}
        <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
          {[0, 1, 2].map((n) => (
            <motion.div
              key={n}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid #22c55e',
              }}
              animate={{ scale: [1, 2.6], opacity: [0.7, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: n * 0.55, ease: 'easeOut' }}
            />
          ))}
          <div style={{
            position: 'absolute', inset: '28%',
            background: '#22c55e', borderRadius: '50%',
            boxShadow: '0 0 8px rgba(34,197,94,0.9)',
          }} />
        </div>
        {/* Label */}
        <div style={{
          background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10,
          padding: '5px 10px', whiteSpace: 'nowrap',
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', margin: 0 }}>● LIVE TRACKING</p>
          <p style={{ fontSize: 8, color: '#9ca3af', margin: '1px 0 0' }}>12.9716°N, 77.5946°E</p>
        </div>
      </div>
    </motion.div>
  )
}

function PhoneMockup() {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 90px 20px 60px' }}>
      {/* Background glow halo */}
      <motion.div
        style={{
          position: 'absolute', width: 300, height: 580, borderRadius: 52, pointerEvents: 'none',
          zIndex: 0,
        }}
        animate={{
          boxShadow: [
            '0 0 60px 8px rgba(6,182,212,0.08)',
            '0 0 100px 30px rgba(6,182,212,0.22)',
            '0 0 60px 8px rgba(6,182,212,0.08)',
          ],
        }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Phone floating */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', width: 252, height: 528, zIndex: 1 }}
      >
        {/* Phone body */}
        <div style={{
          width: '100%', height: '100%', borderRadius: 46, position: 'relative', overflow: 'visible',
          background: 'linear-gradient(160deg, #22293d 0%, #0d1120 100%)',
          boxShadow: [
            '0 0 0 1.5px rgba(255,255,255,0.11)',
            '0 0 0 3.5px rgba(6,182,212,0.07)',
            '12px 32px 72px rgba(0,0,0,0.65)',
            '-6px 0 24px rgba(0,0,0,0.45)',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
        }}>
          {/* Volume buttons — left */}
          {[{ top: 108, h: 28 }, { top: 148, h: 48 }, { top: 208, h: 48 }].map(({ top, h }, i) => (
            <div key={i} style={{ position: 'absolute', left: -4, top, width: 4, height: h, borderRadius: '3px 0 0 3px', background: '#2e3550' }} />
          ))}
          {/* Power — right */}
          <div style={{ position: 'absolute', right: -4, top: 148, width: 4, height: 66, borderRadius: '0 3px 3px 0', background: '#2e3550' }} />

          {/* Screen bezel */}
          <div style={{
            position: 'absolute', top: 14, left: 14, right: 14, bottom: 14,
            borderRadius: 34, overflow: 'hidden', background: '#f0f2f8',
          }}>
            <img
              src={mobileAppImg}
              alt="ParkVUE Officer App – Patrol Zones"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
            />
            {/* Subtle glass sheen */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(130deg, rgba(255,255,255,0.06) 0%, transparent 55%)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
            width: 108, height: 30, borderRadius: 20, background: '#080c18', zIndex: 6,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
          }} />

          {/* Subtle edge highlight (top-left arc) */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '46px 46px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Overlaid badges */}
        <NotificationBubble />
        <LocationPingBadge />
      </motion.div>
    </div>
  )
}

function MobileAppSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-24 sm:py-32 px-4 sm:px-6"
      style={{ background: 'linear-gradient(180deg, #eef5ff 0%, #e4efff 50%, #eef5ff 100%)' }}
    >
      {/* Radial color blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 15% 50%, rgba(30,58,138,0.07) 0%, transparent 55%)' }} />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 85% 50%, rgba(6,182,212,0.06) 0%, transparent 55%)' }} />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,58,138,0.05) 0%, transparent 50%)' }} />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5 border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
          >
            <Smartphone size={12} />
            Officer Mobile Application
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900"
          >
            Patrol intelligence,{' '}
            <span style={{
              background: 'linear-gradient(90deg,#06b6d4,#3b82f6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              in your pocket
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 text-sm max-w-lg mx-auto leading-relaxed text-gray-600"
          >
            A dedicated mobile app built for field officers — receive assignments, patrol zones, validate
            completion, and stay tracked.
          </motion.p>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">

          {/* LEFT: Phone mockup */}
          <motion.div
            className="flex-shrink-0 flex items-center justify-center w-full lg:w-auto"
            initial={{ opacity: 0, x: -52 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.75, delay: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <PhoneMockup />
          </motion.div>

          {/* RIGHT: Feature list */}
          <div className="flex-1 space-y-6 lg:space-y-8">
            {APP_FEATURES.map(({ Icon, title, desc, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: 44 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.55, delay: 0.28 + i * 0.14, ease: 'easeOut' }}
                className="flex items-start gap-4 group"
              >
                {/* Icon pill */}
                <motion.div
                  className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `${color}18`,
                    border: `1px solid ${color}38`,
                    boxShadow: `0 0 22px ${color}18`,
                  }}
                  whileHover={{ scale: 1.12, rotate: [0, -4, 4, 0] }}
                  transition={{ duration: 0.35 }}
                >
                  <Icon size={21} style={{ color }} />
                </motion.div>

                {/* Text */}
                <div className="pt-0.5">
                  <h3 className="text-base font-bold mb-1.5 group-hover:text-brand-cyan transition-colors duration-200 text-gray-900">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

const FOOTER_COLS = [
  { heading: 'Company',   links: ['About', 'Team'] },
  { heading: 'Resources', links: ['Documentation', 'GitHub', 'Support', 'Privacy'] },
]
const SOCIAL_LINKS = [
  { icon: Code2,         label: 'GitHub'   },
  { icon: MessageSquare, label: 'Twitter'  },
  { icon: Briefcase,     label: 'LinkedIn' },
]

function Footer() {
  return (
    <footer className="border-t py-14 px-4 sm:px-6 bg-gray-50 border-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <HexLogo size={26} />
              <span className="font-bold text-base text-gray-900">ParkVUE</span>
            </div>
            <p className="text-xs leading-relaxed mb-5 text-gray-500">
              AI-powered parking enforcement intelligence, built for Traffic Police.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ icon: Icon, label }) => (
                <button key={label} aria-label={label}
                  className="p-2 rounded-lg transition-colors duration-150 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
          {FOOTER_COLS.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 text-gray-400">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-xs transition-colors duration-150 text-gray-500 hover:text-gray-800">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-gray-200">
          <p className="text-xs text-gray-400">
            © 2026 ParkVUE. Built for Traffic Police.
          </p>
          <p className="text-xs text-gray-400">
            Keep Cities Moving
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function Landing() {
  useEffect(() => { document.title = 'ParkVUE — Parking Intelligence' }, [])

  return (
    <div className="bg-[#eef5ff]">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <StatsSection />
      <MobileAppSection />
      <Footer />
    </div>
  )
}
