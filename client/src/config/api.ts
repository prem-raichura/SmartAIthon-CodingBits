/**
 * BACKEND CONNECTION POINT
 * ========================
 * Backend team: when the Express/Prisma server is ready, change BASE_URL below
 * to point to your running backend (e.g. http://localhost:3000/api).
 * Set VITE_API_URL in client/.env.local to override at runtime.
 *
 * All hooks in src/hooks/useMockData.ts will automatically switch from JSON mocks
 * to live API calls when BASE_URL is non-empty.
 */
/**
 * Normalize VITE_API_URL so a misconfigured value can't turn into a relative
 * path (which would hit the frontend origin instead of the API). Ensures an
 * absolute URL and an `/api` base path.
 */
function normalizeBaseUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ''
  // Add scheme if a bare host was provided (e.g. "api.example.com/api").
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  // Upgrade http → https for non-localhost hosts (avoids mixed-content blocks
  // when the app itself is served over HTTPS).
  if (/^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url)) {
    url = url.replace(/^http:\/\//i, 'https://')
  }
  // Strip trailing slash.
  url = url.replace(/\/+$/, '')
  // Ensure the API is rooted at /api.
  if (!/\/api$/i.test(url)) url = `${url}/api`
  return url
}

export const BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL || '')

// localStorage keys — single source of truth for auth state.
export const TOKEN_KEY = 'btp_token'
export const USER_KEY = 'btp_user'

// Flask analytics service (model/app.py). The browser uploads large CSVs
// straight here (512MB cap) to bypass the backend's JSON body limit.
// Local default: `cd model && python3 app.py` listens on :8077.
export const PY_URL = (import.meta.env.VITE_PY_URL || 'http://localhost:8077').replace(/\/+$/, '')

export const ENDPOINTS = {
  hotspots:        '/hotspots',
  stations:        '/stations',
  officers:        '/officers',
  pendingOfficers: '/officers/pending',
  dashboard:       '/dashboard',
  timeseries:      '/timeseries',
  funnel:          '/funnel',
  violations:      '/violations',
  vehicles:        '/vehicles',
  csvHistory:      '/csv/history',
  csvUpload:       '/csv',
  edi:             '/edi/explanations',
  activity:        '/activity',
  assignOfficer:   '/officers/assign',
  approveOfficer:  '/officers/approve',
  rejectOfficer:   '/officers/reject',
  // officer-lifecycle additions
  stationsMaster:  '/stations/master',
  nearestStations: '/stations/nearest',
  unassignRequests:'/unassign-requests',
  geofenceBreaches:'/location/breaches',
  assignments:     '/assignments',
}

export const IS_LIVE = BASE_URL.length > 0
