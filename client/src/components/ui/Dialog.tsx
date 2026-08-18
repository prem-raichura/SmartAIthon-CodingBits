import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  className?: string
  /** Max width class, e.g. 'max-w-md' (default) or 'max-w-2xl' */
  width?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  width = 'max-w-md',
}: DialogProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel container */}
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <motion.div
              key="dialog-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'dialog-title' : undefined}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                'relative w-full rounded-2xl p-6',
                'bg-white dark:bg-surface-dark-card',
                'border border-gray-200 dark:border-gray-800',
                'shadow-xl dark:shadow-black/40',
                width,
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className={cn(
                  'absolute right-4 top-4 p-1 rounded-lg',
                  'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  'outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60',
                  'transition-colors duration-150',
                )}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>

              {/* Header */}
              {(title || description) && (
                <div className="mb-5 pr-6">
                  {title && (
                    <h2
                      id="dialog-title"
                      className="text-base font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  )}
                </div>
              )}

              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
