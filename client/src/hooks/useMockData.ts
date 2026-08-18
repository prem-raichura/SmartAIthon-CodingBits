import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Hotspot,
  Station,
  Officer,
  PendingOfficer,
  DashboardKPIs,
  TimeseriesData,
  FunnelData,
  ViolationType,
  VehicleType,
  CSVUploadHistory,
  EDIExplanation,
  ActivityItem,
} from '../types'
import { BASE_URL, IS_LIVE, ENDPOINTS, TOKEN_KEY } from '../config/api'

import hotspotsRaw from '../mocks/hotspots.json'
import stationsRaw from '../mocks/stations.json'
import officersRaw from '../mocks/officers.json'
import pendingRaw from '../mocks/pending_officers.json'
import dashboardRaw from '../mocks/dashboard.json'
import timeseriesRaw from '../mocks/timeseries.json'
import funnelRaw from '../mocks/funnel.json'
import violationsRaw from '../mocks/violations.json'
import vehiclesRaw from '../mocks/vehicles.json'
import csvHistoryRaw from '../mocks/csv_history.json'
import ediRaw from '../mocks/edi_explanations.json'
import activityRaw from '../mocks/activity.json'

// Returns a random delay between 200 and 400 ms to simulate network latency.
function jitter(): number {
  return 200 + Math.floor(Math.random() * 200)
}

function useMock<T>(raw: T, endpoint: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tracks the work started by the most recent load() so an unmount — or a
  // second refetch — cannot resolve into a stale setState.
  const inflight = useRef<{ abort: () => void } | null>(null)

  // Fetch (or re-fetch) the endpoint. Flips loading on so callers can show
  // skeletons during a refresh, not just on first mount.
  const load = useCallback(() => {
    inflight.current?.abort()
    setLoading(true)
    setError(null)

    if (IS_LIVE) {
      const controller = new AbortController()
      inflight.current = { abort: () => controller.abort() }

      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      fetch(`${BASE_URL}${endpoint}`, { headers, signal: controller.signal })
        .then(r => {
          if (!r.ok) throw new Error(`Server returned ${r.status}`)
          return r.json() as Promise<unknown>
        })
        .then(json => { setData(json as T); setLoading(false) })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : 'Failed to load data')
          setLoading(false)
        })
      return
    }

    // Mock mode — simulate network delay with static JSON
    const timer = setTimeout(() => {
      setData(raw)
      setLoading(false)
    }, jitter())
    inflight.current = { abort: () => clearTimeout(timer) }
    // raw and endpoint are module-level / call-site constants — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  useEffect(() => {
    load()
    return () => inflight.current?.abort()
  }, [load])

  return { data, loading, error, refetch: load }
}

export function useHotspots() {
  return useMock<Hotspot[]>(hotspotsRaw as Hotspot[], ENDPOINTS.hotspots)
}

export function useStations() {
  return useMock<Station[]>(stationsRaw as Station[], ENDPOINTS.stations)
}

export function useOfficers() {
  return useMock<Officer[]>(officersRaw as Officer[], ENDPOINTS.officers)
}

export function usePendingOfficers() {
  return useMock<PendingOfficer[]>(pendingRaw as PendingOfficer[], ENDPOINTS.pendingOfficers)
}

export function useDashboardKPIs() {
  return useMock<DashboardKPIs>(dashboardRaw as DashboardKPIs, ENDPOINTS.dashboard)
}

export function useTimeseries() {
  return useMock<TimeseriesData>(timeseriesRaw as TimeseriesData, ENDPOINTS.timeseries)
}

export function useFunnel() {
  return useMock<FunnelData>(funnelRaw as FunnelData, ENDPOINTS.funnel)
}

export function useViolations() {
  return useMock<ViolationType[]>(violationsRaw as ViolationType[], ENDPOINTS.violations)
}

export function useVehicles() {
  return useMock<VehicleType[]>(vehiclesRaw as VehicleType[], ENDPOINTS.vehicles)
}

export function useCSVHistory() {
  return useMock<CSVUploadHistory[]>(csvHistoryRaw as CSVUploadHistory[], ENDPOINTS.csvHistory)
}

export function useEDIExplanations() {
  return useMock<EDIExplanation[]>(ediRaw as EDIExplanation[], ENDPOINTS.edi)
}

export function useActivity() {
  return useMock<ActivityItem[]>(activityRaw as ActivityItem[], ENDPOINTS.activity)
}
