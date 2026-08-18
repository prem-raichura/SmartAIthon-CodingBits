import path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { callAnalytics } from '../../lib/pyClient.js';
import { invalidateLatestRun } from '../analytics/service.js';
import { cellToLatLng } from 'h3-js';
import type { RiskLevel } from '@prisma/client';

// Dataset coverage bounding box — rejects obviously-bad coordinates.
// Matches the model's filter in model/features_v6.py.
const COVERAGE_BBOX = { latMin: 12.6, latMax: 13.3, lonMin: 77.2, lonMax: 77.9 };
const SKIP_STATION = new Set(['', 'null', 'no police station']);

/**
 * Scan a raw violation CSV for `police_station` values and auto-add any station
 * not already in the DB, using the centroid (avg lat/lon) of its rows. Keeps the
 * officer-registration station picker in sync with whatever data gets uploaded.
 * Never throws — station sync must not fail a prediction run.
 */
async function syncStationsFromCsv(buf: Buffer): Promise<void> {
  try {
    const records = parse(buf, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Array<Record<string, string>>;

    const agg = new Map<string, { lat: number; lon: number; n: number }>();
    for (const r of records) {
      const name = (r.police_station ?? '').trim();
      if (SKIP_STATION.has(name.toLowerCase())) continue;
      const lat = parseFloat(r.latitude);
      const lon = parseFloat(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < COVERAGE_BBOX.latMin || lat > COVERAGE_BBOX.latMax || lon < COVERAGE_BBOX.lonMin || lon > COVERAGE_BBOX.lonMax) continue;
      const a = agg.get(name) ?? { lat: 0, lon: 0, n: 0 };
      a.lat += lat; a.lon += lon; a.n += 1;
      agg.set(name, a);
    }
    if (agg.size === 0) return;

    const existing = new Set(
      (await prisma.station.findMany({ select: { name: true } })).map((s) => s.name),
    );
    const toAdd = [...agg.entries()]
      .filter(([name]) => !existing.has(name))
      .map(([name, a]) => ({
        name,
        latitude: Number((a.lat / a.n).toFixed(6)),
        longitude: Number((a.lon / a.n).toFixed(6)),
      }));

    if (toAdd.length) {
      const res = await prisma.station.createMany({ data: toAdd, skipDuplicates: true });
      console.log(`[csvUpload] auto-added ${res.count} new station(s): ${toAdd.map((s) => s.name).join(', ')}`);
    }
  } catch (err) {
    console.error('[csvUpload] station sync skipped:', err);
  }
}

/**
 * Auto-register new police stations from the analytics bundle. The model service
 * already returns per-station centroids ({ name, lat, lon }), so unlike
 * syncStationsFromCsv this does not re-parse the raw CSV. Never throws —
 * station sync must not fail a prediction run.
 */
async function syncStationsFromBundle(
  stations: Array<{ name?: string; lat?: number; lon?: number }> | undefined,
): Promise<void> {
  try {
    if (!Array.isArray(stations) || stations.length === 0) return;

    const candidates = new Map<string, { lat: number; lon: number }>();
    for (const s of stations) {
      const name = (s.name ?? '').trim();
      if (SKIP_STATION.has(name.toLowerCase())) continue;
      const lat = Number(s.lat);
      const lon = Number(s.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < COVERAGE_BBOX.latMin || lat > COVERAGE_BBOX.latMax || lon < COVERAGE_BBOX.lonMin || lon > COVERAGE_BBOX.lonMax) continue;
      candidates.set(name, { lat, lon });
    }
    if (candidates.size === 0) return;

    const existing = new Set(
      (await prisma.station.findMany({ select: { name: true } })).map((s) => s.name),
    );
    const toAdd = [...candidates.entries()]
      .filter(([name]) => !existing.has(name))
      .map(([name, a]) => ({
        name,
        latitude: Number(a.lat.toFixed(6)),
        longitude: Number(a.lon.toFixed(6)),
      }));

    if (toAdd.length) {
      const res = await prisma.station.createMany({ data: toAdd, skipDuplicates: true });
      console.log(`[csvUpload] auto-added ${res.count} new station(s): ${toAdd.map((s) => s.name).join(', ')}`);
    }
  } catch (err) {
    console.error('[csvUpload] station sync skipped:', err);
  }
}

const RISK_MAP: Record<string, RiskLevel> = {
  low: 'low', Low: 'low',
  medium: 'medium', Medium: 'medium',
  high: 'high', High: 'high',
  critical: 'critical', Critical: 'critical',
};

interface PredRow {
  h3_id: string;
  severity: string;
  risk_score: number;
  pred_24h: number;
  pred_48h: number;
  dominant_violation: string;
  dominant_vehicle: string;
  congestion_score: number;
  blockage_rate: number;
  confidence: number;
  location: string;
  forecast_date_24h: string;
  forecast_date_48h: string;
}

export async function createRun(file: Express.Multer.File, userId: string) {
  return createRunMeta(file.originalname ?? 'upload.csv', userId);
}

/** Create a run record from a filename only — used by the direct-to-model flow
 *  where the raw CSV never reaches this backend (only the analytics bundle does). */
export async function createRunMeta(filename: string, userId: string) {
  return prisma.predictionRun.create({
    data: {
      // No disk on serverless; keep the original name as the record reference.
      csv_path: filename,
      original_filename: filename,
      uploaded_by: userId,
      model_version: 'v6',
      prediction_window: 'H24',
      h3_resolution: 9,
      status: 'pending',
    },
  });
}

/** Outcome of a processing attempt, so the controller can answer with the real
 *  state instead of always claiming 'pending'. */
export interface ProcessResult {
  status: 'done' | 'failed';
  error?: string;
}

/** Legacy path: backend received the raw CSV, forwards to the model service,
 *  then persists. */
export async function process(runId: string, buf: Buffer): Promise<ProcessResult> {
  const run = await prisma.predictionRun.findUnique({ where: { run_id: runId } });
  if (!run) return { status: 'failed', error: 'Run not found' };

  await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'processing' } });

  try {
    // Auto-register any new police stations found in this upload.
    await syncStationsFromCsv(buf);
    const bundle = await callAnalytics(buf, run.original_filename ?? 'upload.csv');
    await persistBundle(runId, bundle);
    return { status: 'done' };
  } catch (err) {
    await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'failed' } });
    console.error(`[csvUpload] run ${runId} failed:`, err);
    return { status: 'failed', error: err instanceof Error ? err.message : 'Processing failed' };
  }
}

/** Direct-to-model path: the client uploaded the CSV straight to the model
 *  service and posts back the small analytics bundle, keeping this request well
 *  under the JSON body limit. */
export async function processFromBundle(
  runId: string,
  bundle: Record<string, unknown>,
): Promise<ProcessResult> {
  const run = await prisma.predictionRun.findUnique({ where: { run_id: runId } });
  if (!run) return { status: 'failed', error: 'Run not found' };

  await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'processing' } });

  try {
    await syncStationsFromBundle(
      bundle.stations as Array<{ name?: string; lat?: number; lon?: number }> | undefined,
    );
    await persistBundle(runId, bundle);
    return { status: 'done' };
  } catch (err) {
    await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'failed' } });
    console.error(`[csvUpload] run ${runId} failed:`, err);
    return { status: 'failed', error: err instanceof Error ? err.message : 'Processing failed' };
  }
}

/** Persist predictions + analytics from a model bundle into the DB and mark the
 *  run done. Throws on failure so callers can flip the run to 'failed'. */
async function persistBundle(runId: string, bundle: Record<string, unknown>): Promise<void> {
    const predictions = (bundle.predictions as PredRow[]) ?? [];
    const hotspots    = (bundle.hotspots as Array<{ id?: string; h3_id?: string }>) ?? [];

    // Build HOT-NNN lookup: h3_id → hotspot_code. Joined on h3_id, not array
    // position — the two lists are produced independently and any reordering
    // would otherwise mislabel every cell.
    const hotspotMap = new Map<string, string>();
    hotspots.forEach((h, i) => {
      if (!h?.h3_id) return;
      hotspotMap.set(h.h3_id, h.id ?? `HOT-${String(i + 1).padStart(3, '0')}`);
    });

    const CHUNK = 500;
    for (let i = 0; i < predictions.length; i += CHUNK) {
      const slice = predictions.slice(i, i + CHUNK);
      await prisma.predictionCell.createMany({
        data: slice.map((row) => {
          let lat: number | undefined, lon: number | undefined;
          try {
            [lat, lon] = cellToLatLng(row.h3_id);
          } catch { /* ignore bad h3 */ }

          const riskLevelRaw = row.severity ?? 'low';
          const risk_level: RiskLevel = RISK_MAP[riskLevelRaw] ?? 'low';

          return {
            run_id: runId,
            h3_index: row.h3_id,
            h3_resolution: 9,
            prediction_window: 'H24',
            latitude: lat,
            longitude: lon,
            predicted_violations: row.pred_24h ?? null,
            pred_48h: row.pred_48h ?? null,
            dominant_vehicle_type: row.dominant_vehicle ?? null,
            dominant_violation: row.dominant_violation ?? null,
            congestion_score: row.congestion_score ?? null,
            blockage_rate: row.blockage_rate ?? null,
            risk_level,
            risk_score: row.risk_score ?? null,
            confidence: row.confidence ?? null,
            location: row.location ?? null,
            forecast_date_24h: row.forecast_date_24h ? new Date(row.forecast_date_24h) : null,
            forecast_date_48h: row.forecast_date_48h ? new Date(row.forecast_date_48h) : null,
            hotspot_code: hotspotMap.get(row.h3_id) ?? null,
          };
        }),
      });
    }

    // Store analytics blob
    const summary = bundle.summary as Record<string, unknown>;
    await prisma.runAnalytics.create({
      data: {
        run_id: runId,
        dashboard:   bundle.dashboard   as object,
        hotspots:    bundle.hotspots    as object,
        stations:    bundle.stations    as object,
        officers:    bundle.officers    as object,
        violations:  bundle.violations  as object,
        vehicles:    bundle.vehicles    as object,
        timeseries:  bundle.timeseries  as object,
        funnel:      bundle.funnel      as object,
        edi:         bundle.edi_explanations as object,
        activity:    bundle.activity    as object,
      },
    });

    const rowsIn = typeof summary?.rows_in === 'number' ? summary.rows_in : predictions.length;
    await prisma.predictionRun.update({
      where: { run_id: runId },
      data: { status: 'done', run_at: new Date(), rows_in: rowsIn },
    });

    // A newer run exists — drop the analytics cache so the dashboard shows it.
    invalidateLatestRun();
}

export async function history() {
  const runs = await prisma.predictionRun.findMany({
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  const statusMap: Record<string, string> = {
    done: 'completed', pending: 'processing', processing: 'processing', failed: 'failed',
  };

  return runs.map((r: typeof runs[number]) => ({
    id: r.run_id,
    filename: r.original_filename ?? 'upload.csv',
    uploaded_on: r.created_at.toISOString().replace('T', ' ').slice(0, 16),
    rows: r.rows_in ?? 0,
    status: statusMap[r.status] ?? r.status,
    uploaded_by: r.uploaded_by ?? 'admin',
  }));
}
