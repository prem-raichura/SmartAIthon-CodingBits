import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 bg-white dark:bg-surface-dark">
      <motion.div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e3a8a, #06b6d4)' }}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(6,182,212,0.35)',
            '0 0 0 14px rgba(6,182,212,0)',
            '0 0 0 0 rgba(6,182,212,0.35)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Loader2 size={30} className="text-white animate-spin" />
      </motion.div>

      <div className="w-40 space-y-2">
        {[1, 0.7].map((w, i) => (
          <div
            key={i}
            className="relative h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
            style={{ width: `${w * 100}%` }}
          >
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
          </div>
        ))}
      </div>

      <p className="text-xs font-medium tracking-wide text-gray-400 dark:text-gray-600">
        Authenticating…
      </p>
    </div>
  )
}
