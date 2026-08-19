import { BASE_URL, PY_URL, IS_LIVE, TOKEN_KEY } from '../config/api'

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 20_000

function getToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
}

export const UNAUTHORIZED_EVENT = 'auth:unauthorized'

/** Thrown when the API rejects the token, so callers can force a re-login.
 *  Also fires a window event that AuthProvider listens for. */
export class UnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message)
    this.name = 'UnauthorizedError'
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!IS_LIVE) {
    throw new Error('No API configured. Set VITE_API_URL to run against a live backend.')
  }

  const token = opts.token ?? getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Request timed out: ${path}`)
    }
    throw new Error(`Cannot reach the API at ${BASE_URL}. Is the server running?`)
  } finally {
    clearTimeout(timer)
  }

  // A misrouted path can answer 200 with an SPA index.html. Parsing that as a
  // success used to hand callers an empty object and hide the failure.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    if (res.status === 401) throw new UnauthorizedError()
    throw new Error(`Unexpected response from ${path} (${res.status} ${res.statusText || 'no JSON body'})`)
  }

  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.status === 401) throw new UnauthorizedError(json.error ?? 'Session expired')
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`)
  }
  return json as T
}

// ── officer-lifecycle helpers ────────────────────────────────────────────────

export interface NearestStation {
  id: string
  name: string
  code: string | null
  latitude: number
  longitude: number
  distance_km: number
}

export interface StationOfficer {
  id: string
  name: string
  badge_id: string
  station: string
  status: string
  last_lat: number
  last_lon: number
  total_tickets: number
  active_assignments: number
  approval_rate: number
  effectiveness_score: number
}

export interface UnassignRequest {
  id: string
  reason: string
  status: string
  created_at: string
  officer: { id: string; name: string; police_station: string }
  assignment: { id: string; cell: { h3_index: string; latitude: number; longitude: number; risk_level: string } }
}

export interface GeofenceBreach {
  id: string
  officer_id: string
  officer_name: string
  station: string
  assignment_id: string
  zone: string | null
  risk_level: string | null
  latitude: number
  longitude: number
  distance_m: number | null
  at: string
}

export const getNearestStations = (lat: number, lon: number, n = 2) =>
  request<NearestStation[]>(`/stations/nearest?lat=${lat}&lon=${lon}&n=${n}`)

export const getStationOfficers = (stationId: string, availability?: string) =>
  request<StationOfficer[]>(`/stations/${stationId}/officers${availability ? `?availability=${availability}` : ''}`)

export const assignOfficer = (body: { user_id: string; h3_index: string; time_limit?: string }) =>
  request<{ id: string }>(`/officers/assign`, { method: 'POST', body })

export const getUnassignRequests = (status = 'pending') =>
  request<UnassignRequest[]>(`/unassign-requests?status=${status}`)

export const approveUnassign = (id: string) =>
  request(`/unassign-requests/${id}/approve`, { method: 'POST', body: {} })

export const rejectUnassign = (id: string) =>
  request(`/unassign-requests/${id}/reject`, { method: 'POST', body: {} })

export const cancelAssignment = (id: string, reason?: string) =>
  request(`/assignments/${id}/cancel`, { method: 'POST', body: { reason } })

export const getGeofenceBreaches = () => request<GeofenceBreach[]>(`/location/breaches`)

export const getAssignments = (status?: string) =>
  request<unknown[]>(`/assignments${status ? `?status=${status}` : ''}`)

export interface DeleteOfficerResult {
  deleted: boolean
  officer: { id: string; name: string }
  removed: { assignments: number; field_reports: number }
}

/** Hard delete — also removes the officer's assignments and field reports. */
export const deleteOfficer = (id: string) =>
  request<DeleteOfficerResult>(`/officers/${id}`, { method: 'DELETE' })

// ── field reports (officer submissions) ──────────────────────────────────────

export interface FieldReport {
  validation_id: string
  submitted_at: string
  has_congestion: boolean
  congestion_severity: 'none' | 'low' | 'medium' | 'high' | null
  dominant_vehicle_type: string | null
  vehicle_count_approx: number | null
  opinion: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  photo_url: string | null
  officer: { id: string; name: string; email: string; station: string; badge_id: string }
  zone: {
    cell_id: string
    h3_index: string
    label: string
    location: string | null
    latitude: number | null
    longitude: number | null
    risk_level: string
    predicted_violations: number | null
  }
  assignment: { id: string; status: string; opened_at: string | null; time_limit: string | null } | null
}

export interface FieldReportStats {
  total: number
  with_congestion: number
  with_photo: number
  by_severity: Record<string, number>
}

export const getFieldReports = (params: { severity?: string; officer_id?: string } = {}) => {
  const q = new URLSearchParams()
  if (params.severity && params.severity !== 'all') q.set('severity', params.severity)
  if (params.officer_id) q.set('officer_id', params.officer_id)
  const qs = q.toString()
  return request<FieldReport[]>(`/field-validations/detailed${qs ? `?${qs}` : ''}`)
}

export const getFieldReportStats = () =>
  request<FieldReportStats>('/field-validations/stats')

// ── notifications ────────────────────────────────────────────────────────────

export interface AdminNotification {
  notification_id: string
  assignment_id: string | null
  type: string
  title: string
  body: string
  is_read: boolean
  sent_at: string
}

export const getNotifications = () =>
  request<AdminNotification[]>('/notifications')

export const markNotificationRead = (id: string) =>
  request(`/notifications/${id}/read`, { method: 'PATCH' })

// ── profile ──────────────────────────────────────────────────────────────────

export const getMe = () =>
  request<import('./auth').User>('/auth/me')

export const updateProfile = (body: { name?: string; email?: string; number?: string; username?: string }) =>
  request<import('./auth').User>('/users/me', { method: 'PATCH', body })

export async function uploadCsv(file: File, token: string | null): Promise<{ run_id: string; status: string }> {
  // Step 1: upload the raw CSV straight to the Flask analytics service, which
  // accepts up to 512MB and returns a small aggregated bundle (per-H3-cell
  // predictions + analytics).
  const fd = new FormData()
  fd.append('file', file)

  let analyticsRes: Response
  try {
    analyticsRes = await fetch(`${PY_URL}/analytics`, { method: 'POST', body: fd })
  } catch (e) {
    throw new Error(`Analytics service unreachable: ${e instanceof Error ? e.message : 'network error'}`)
  }

  const analytics = await analyticsRes.json().catch(() => ({})) as {
    ok?: boolean
    bundle?: Record<string, unknown>
    errors?: string[]
  }
  if (!analyticsRes.ok || !analytics.ok || !analytics.bundle) {
    throw new Error(analytics.errors?.join('; ') ?? `Analytics failed (${analyticsRes.status})`)
  }

  // Step 2: send the small bundle to the backend to persist (predictions,
  // analytics, station auto-sync).
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/csv/store`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ original_filename: file.name, bundle: analytics.bundle }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Upload failed (${res.status})`)
  }
  return json as { run_id: string; status: string }
}
