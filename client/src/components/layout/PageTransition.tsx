import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PageTransitionProps {
  children: ReactNode
  locationKey: string
}

export function PageTransition({ children, locationKey }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={locationKey}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
