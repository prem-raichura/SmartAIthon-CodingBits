import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function NotFound() {
  useEffect(() => { document.title = '404 — ParkVUE' }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-surface-dark px-6">
      <div className="text-center max-w-sm">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-[96px] leading-none font-black text-gray-200 dark:text-gray-800 select-none mb-4"
        >
          404
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            The route you&apos;re looking for doesn&apos;t exist in ParkVUE.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white gradient-brand hover:opacity-90 transition-opacity shadow-sm focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 outline-none"
          >
            Back to Dashboard
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
