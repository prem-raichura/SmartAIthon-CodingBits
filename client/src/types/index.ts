// ─── Severity / Risk ────────────────────────────────────────────────────────

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'

// ─── Hotspot ────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string
  lat: number
  lon: number
  ticket_count: number
  risk_level: RiskLevel
  hotspot_score: number
  congestion_score: number
  blockage_pct: number
  dominant_violation: string
  dominant_vehicle: string
  dominant_station: string
  dominant_junction: string
  approval_rate: number
  peak_fraction: number
  predicted_24h: number
  predicted_48h: number
  z_score: number
  anomaly: string
  // officer-lifecycle additions (live mode only)
  h3_id?: string
  peak_hours?: PeakHours
  daypart_24h?: DayPart
  daypart_48h?: DayPart
  forecast_date_24h?: string
  forecast_date_48h?: string
}

export interface PeakHours {
  start: number
  end: number
  peak_hour: number
  label: string
  share: number
}

export interface DayPart {
  morning: number
  noon: number
  evening: number
  night: number
}

// ─── Station ─────────────────────────────────────────────────────────────────

export interface Station {
  name: string
  lat: number
  lon: number
  total_tickets: number
  approval_rate: number
  reject_rate: number
}

// ─── Officer ─────────────────────────────────────────────────────────────────

export type OfficerStatus = 'active' | 'on_patrol' | 'available' | 'off_duty'

export interface Officer {
  id: string
  name: string
  badge_id: string
  station: string
  total_tickets: number
  approval_rate: number
  last_lat: number
  last_lon: number
  status: OfficerStatus
  effectiveness_score: number
}

export interface AssignedOfficer {
  officer: Officer
  distance_km: number
  eta_min: number
  effectiveness: number
  zone_familiarity: number
}

// ─── Pending Officer ─────────────────────────────────────────────────────────

export interface PendingOfficer {
  id: string
  name: string
  badge_id: string
  requested_station: string
  phone: string
  email: string
  applied_on: string
  experience_years: number
  status: string
}

// ─── Violation / Vehicle breakdown ───────────────────────────────────────────

export interface ViolationType {
  name: string
  count: number
}

export interface VehicleType {
  name: string
  count: number
}

// ─── Timeseries ──────────────────────────────────────────────────────────────

export interface MonthlyPoint {
  month: string
  tickets: number
}

export interface DailyPoint {
  day: string
  tickets: number
}

export interface HourlyPoint {
  hour: number
  tickets: number
}

export interface DailyTrendPoint {
  date: string
  tickets: number
}

export interface TimeseriesData {
  monthly: MonthlyPoint[]
  daily: DailyPoint[]
  hourly: HourlyPoint[]
  daily_trend: DailyTrendPoint[]
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export interface FunnelData {
  total: number
  reviewed: number
  approved: number
  rejected: number
  processing: number
  duplicate: number
  never_reviewed: number
}

// ─── CSV Upload History ───────────────────────────────────────────────────────

export interface CSVUploadHistory {
  id: string
  filename: string
  uploaded_on: string
  rows: number
  status: string
  uploaded_by: string
}

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export interface DashboardKPIs {
  total_violations: number
  active_hotspots: number
  avg_congestion_score: number
  pending_approvals: number
  critical_zones: number
  predicted_today: number
  approval_rate: number
  never_reviewed_pct: number
  top_violation: string
  top_vehicle: string
  dataset_date_range: {
    start: string
    end: string
  }
}

// ─── EDI Explanation ─────────────────────────────────────────────────────────

export interface ShapDriver {
  feature: string
  value: number
  impact: string
  shap: number
}

export interface ImpactScenario {
  predicted_violations: number
  blockage_pct: number
  reduction_pct: number
}

export interface EDIExplanation {
  hotspot_id: string
  anomaly_alert: {
    z_score: number
    level: string
    message: string
  }
  impact_forecast: {
    if_enforced: ImpactScenario
    if_not_enforced: ImpactScenario
  }
  cascade_risk: {
    affected_junctions: number
    lag_minutes: number
    correlation: number
  }
  officer_recommendation: {
    count: number
    reason: string
  }
  model_confidence: {
    psi_score: number
    level: string
  }
  shap_drivers: ShapDriver[]
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export type ActivitySeverity = 'high' | 'medium' | 'info'

export interface ActivityItem {
  time: string
  type: string
  message: string
  severity: ActivitySeverity
}
