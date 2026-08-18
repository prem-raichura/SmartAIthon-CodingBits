import { useState, useMemo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadCsv, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  Upload, FileText, Trash2, RefreshCw, Eye,
  Check, X, AlertTriangle,
} from 'lucide-react'
import { useCSVHistory } from '../hooks/useMockData'
import type { CSVUploadHistory } from '../types'
import { Dialog } from '../components/ui/Dialog'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────


const UPLOAD_STEPS = [
  { label: 'Validating schema…', threshold: 0 },
  { label: 'Parsing 8,294 records…', threshold: 16 },
  { label: 'Geo-filtering rows…', threshold: 32 },
  { label: 'Computing H3 cells…', threshold: 48 },
  { label: 'Updating predictions…', threshold: 80 },
  { label: 'Done!', threshold: 100 },
]

const REQUIRED_COLUMNS = [
  'id', 'latitude', 'longitude', 'vehicle_type', 'violation_type',
  'created_datetime', 'police_station', 'junction_name', 'validation_status',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(2)} MB`
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

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  processing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  failed:     'bg-critical-50 text-critical-700 border-critical-200 dark:bg-critical-950/30 dark:text-critical-400 dark:border-critical-800',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CSVUpload() {
  const { data: historyData, loading: historyLoading } = useCSVHistory()

  // Local mutable history (new uploads get prepended)
  const [displayHistory, setDisplayHistory] = useState<CSVUploadHistory[] | null>(null)
  useEffect(() => {
    if (!historyData) return
    setDisplayHistory(prev => prev ?? historyData)
  }, [historyData])

  // File drop state
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadDone, setUploadDone] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const { token } = useAuth()

  // Newly added entry (for highlight)
  const [newEntryId, setNewEntryId] = useState<string | null>(null)

  // Table filter
  const [statusFilter, setStatusFilter] = useState('all')

  // Dialogs
  const [detailEntry, setDetailEntry] = useState<CSVUploadHistory | null>(null)

  useEffect(() => { document.title = 'Dataset Management — ParkVUE' }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    if (!displayHistory) return []
    return statusFilter === 'all' ? displayHistory : displayHistory.filter(h => h.status === statusFilter)
  }, [displayHistory, statusFilter])

  // Active upload step index
  const activeStepCount = UPLOAD_STEPS.filter(s => uploadProgress >= s.threshold).length

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are accepted')
      return
    }
    setSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function finishUpload(runId: string, rowCount: number, filename: string) {
    setUploadDone(true)
    setUploadProgress(100)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    const newEntry: CSVUploadHistory = {
      id: runId,
      filename,
      uploaded_on: ts,
      rows: rowCount,
      status: 'completed',
      uploaded_by: 'admin',
    }
    setDisplayHistory(prev => [newEntry, ...(prev ?? [])])
    setNewEntryId(runId)
    toast.success(`${filename} processed — ${rowCount.toLocaleString()} records ingested`)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setIsUploading(false)
      setUploadDone(false)
      setUploadProgress(0)
      setSelectedFile(null)
      setNewEntryId(null)
    }, 2500)
  }

  function failUpload(message: string) {
    stopPolling()
    toast.error(message)
    setIsUploading(false)
    setUploadProgress(0)
  }

  async function startUpload() {
    if (!selectedFile) return
    // A previous run's poller must never survive into a new upload.
    stopPolling()
    setIsUploading(true)
    setUploadProgress(5)

    let runId: string
    try {
      const res = await uploadCsv(selectedFile, token)
      runId = res.run_id
      if (!runId) throw new Error('Server did not return a run id')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      setIsUploading(false)
      setUploadProgress(0)
      return
    }

    // Simulate step progress while polling
    const STEP_PCTS = [16, 32, 48, 80, 90]
    let step = 0
    setUploadProgress(STEP_PCTS[0])

    // Give up rather than polling forever when the run never settles.
    const POLL_MS = 1500
    const MAX_ATTEMPTS = 120 // 3 minutes
    let attempts = 0

    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > MAX_ATTEMPTS) {
        failUpload('Processing timed out — check the server logs and try again')
        return
      }
      try {
        const run = await request<{ status: string; rows_in?: number }>(`/prediction-runs/${runId}`, { token })
        if (step < STEP_PCTS.length - 1) {
          step++
          setUploadProgress(STEP_PCTS[step])
        }
        if (run.status === 'done') {
          stopPolling()
          finishUpload(runId, run.rows_in ?? 0, selectedFile.name)
        } else if (run.status === 'failed') {
          failUpload('Processing failed — check the CSV schema and try again')
        }
      } catch { /* transient error — keep polling until MAX_ATTEMPTS */ }
    }, POLL_MS)
  }

  function handleReprocess(entry: CSVUploadHistory) {
    toast.success(`Re-processing queued for ${entry.filename}`)
  }

  function handleDelete(id: string) {
    setDisplayHistory(prev => prev?.filter(h => h.id !== id) ?? [])
    toast.success('Upload record deleted')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">

      {/* Page header */}
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-brand-cyan bg-clip-text text-transparent">
          Dataset Management
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload new violation data to retrain models
        </p>
      </FadeUp>

      {/* Main content */}
      <div className="space-y-6">

        <div className="space-y-6">

          {/* Upload card */}
          <FadeUp delay={0.05}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Dataset</h2>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                  e.target.value = ''
                }}
              />

              <AnimatePresence mode="wait">
                {/* ── STATE: Uploading (progress view) ── */}
                {isUploading && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {uploadDone ? 'Complete!' : 'Processing…'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                          {Math.round(uploadProgress)}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-cyan transition-none"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-2 py-1">
                      {UPLOAD_STEPS.map((step, idx) => {
                        const isCompleted = idx < activeStepCount - 1 || uploadDone
                        const isCurrent = idx === activeStepCount - 1 && !uploadDone
                        const isPending = idx >= activeStepCount

                        return (
                          <motion.div
                            key={step.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                            className="flex items-center gap-2.5 text-sm"
                          >
                            {isCompleted ? (
                              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <Check size={9} className="text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="w-4 h-4 rounded-full border-2 border-brand-cyan flex-shrink-0 animate-pulse" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700 flex-shrink-0" />
                            )}
                            <span className={cn(
                              isCompleted && 'text-green-600 dark:text-green-400',
                              isCurrent && 'text-brand-cyan font-medium',
                              isPending && 'text-gray-400 dark:text-gray-600',
                            )}>
                              {step.label}
                            </span>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {/* ── STATE: File selected ── */}
                {!isUploading && selectedFile && (
                  <motion.div
                    key="file-selected"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* File info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fmtBytes(selectedFile.size)}</p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Upload button */}
                    <button
                      onClick={startUpload}
                      className={cn(
                        'w-full py-2.5 rounded-xl font-semibold text-sm text-white',
                        'bg-gradient-to-r from-brand-600 to-brand-cyan',
                        'hover:opacity-90 active:opacity-80 transition-opacity',
                        'shadow-sm shadow-brand-600/20',
                      )}
                    >
                      Upload &amp; Process
                    </button>
                  </motion.div>
                )}

                {/* ── STATE: Empty drop zone ── */}
                {!isUploading && !selectedFile && (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'relative rounded-2xl border-2 border-dashed cursor-pointer',
                        'flex flex-col items-center justify-center gap-3 py-12 px-8',
                        'transition-all duration-200',
                        dragOver
                          ? 'border-brand-cyan bg-cyan-50 dark:bg-cyan-950/20 shadow-[0_0_0_4px_rgba(6,182,212,0.12)]'
                          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 hover:border-brand-cyan/50 hover:bg-gray-100 dark:hover:bg-gray-800/30',
                      )}
                    >
                      <motion.div
                        animate={dragOver ? { scale: 1.15, y: -6 } : { scale: 1, y: 0 }}
                        whileHover={{ y: -5, scale: 1.08 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                      >
                        <Upload
                          size={44}
                          className={cn(
                            'transition-colors duration-200',
                            dragOver ? 'text-brand-cyan' : 'text-gray-400 dark:text-gray-600',
                          )}
                        />
                      </motion.div>

                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Drop CSV file here or{' '}
                          <span className="text-brand-cyan underline underline-offset-2">click to browse</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
                          Must match schema: id, latitude, longitude, vehicle_type, violation_type,
                          created_datetime, police_station, junction_name, validation_status (and others).
                          See documentation.
                        </p>
                      </div>

                      {dragOver && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 rounded-2xl bg-brand-cyan/5 pointer-events-none"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeUp>

          {/* Schema requirements card */}
          <FadeUp delay={0.1}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Schema Requirements</h3>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Required columns
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  {REQUIRED_COLUMNS.map(col => (
                    <li key={col} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan flex-shrink-0" />
                      <code className="font-mono text-gray-700 dark:text-gray-300">{col}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">
                Columns must use snake_case headers. Encoding: UTF-8. Max file size: 500 MB.
              </p>
            </div>
          </FadeUp>

          {/* Upload history table */}
          <FadeUp delay={0.15}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark-card shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upload History</h2>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-xl',
                    'bg-gray-50 dark:bg-gray-800',
                    'border border-gray-200 dark:border-gray-700',
                    'text-gray-700 dark:text-gray-300',
                    'outline-none focus:ring-2 focus:ring-brand-cyan/40',
                  )}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {historyLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-10" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        {['Upload ID', 'Filename', 'Date', 'Rows', 'Status', 'Uploaded By', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <AnimatePresence>
                        {filteredHistory.map(entry => (
                          <motion.tr
                            key={entry.id}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className={cn(
                              'transition-colors duration-300',
                              newEntryId === entry.id
                                ? 'bg-green-50/70 dark:bg-green-950/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-900/30',
                            )}
                          >
                            <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {entry.id}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200 max-w-36 truncate">
                              {entry.filename}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {entry.uploaded_on}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
                              {entry.rows.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
                                STATUS_BADGE[entry.status] ?? STATUS_BADGE['failed'],
                              )}>
                                {entry.status === 'completed' && <Check size={10} />}
                                {entry.status === 'processing' && <RefreshCw size={10} className="animate-spin" />}
                                {entry.status === 'failed' && <AlertTriangle size={10} />}
                                <span className="capitalize">{entry.status}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {entry.uploaded_by}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setDetailEntry(entry)}
                                  title="View details"
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleReprocess(entry)}
                                  title="Re-process"
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                >
                                  <RefreshCw size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  title="Delete"
                                  className="p-1.5 rounded-lg hover:bg-critical-50 dark:hover:bg-critical-950/30 text-gray-400 hover:text-critical-600 dark:hover:text-critical-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>

                      {filteredHistory.length === 0 && !historyLoading && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-600">
                            No uploads match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeUp>
        </div>

      </div>

      {/* ── Detail Dialog ── */}
      <Dialog
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title="Upload Details"
        width="max-w-sm"
      >
        {detailEntry && (
          <div className="space-y-3 text-sm">
            {[
              ['Upload ID', detailEntry.id],
              ['Filename', detailEntry.filename],
              ['Date', detailEntry.uploaded_on],
              ['Rows Processed', detailEntry.rows.toLocaleString()],
              ['Uploaded By', detailEntry.uploaded_by],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-right text-xs">{value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-1">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border',
                STATUS_BADGE[detailEntry.status] ?? STATUS_BADGE['failed'],
              )}>
                {detailEntry.status === 'completed' && <Check size={10} />}
                {detailEntry.status === 'processing' && <RefreshCw size={10} className="animate-spin" />}
                {detailEntry.status === 'failed' && <AlertTriangle size={10} />}
                <span className="capitalize">{detailEntry.status}</span>
              </span>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  )
}
