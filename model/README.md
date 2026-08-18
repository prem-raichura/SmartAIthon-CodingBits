---
title: Patrol Forecast V6
emoji: 🚓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8077
pinned: false
---

# Patrol Forecast v6 — Flask Inference Service

CSV in → CSV out. Upload a raw violation CSV (recent history); get a per-H3-cell forecast
for the **next day (24h)** and **day after (48h)** with the v6 11-field deployment schema.

## Files
| file | role |
|---|---|
| `features_v6.py` | shared feature pipeline (used by trainer **and** server — guarantees parity) |
| `train_production_v6.py` | fits the complete ensemble once → `production_v6.pkl` |
| `app.py` | Flask service (`/predict`, `/health`) |
| `production_v6.pkl` | trained bundle (all 5 heads × 2 horizons + GLM + blend weights + attribute maps) |
| `requirements.txt` | deps |

## Setup
```bash
pip install -r requirements.txt
python3 train_production_v6.py            # builds production_v6.pkl (~3 min, one-time)
python3 app.py                            # dev server on :8077
# production:
gunicorn -w 2 -b 0.0.0.0:8077 app:app
```
`train_production_v6.py [path.csv]` defaults to the project training CSV. Re-run to refresh
the model on newer data.

## Endpoints

### `POST /predict`
Multipart form, field **`file`** = raw violation CSV.

Query params:
- `horizon` = `24h` | `48h` | `both` (default `both`)
- `format` = `csv` (default, downloadable) | `json`

```bash
curl -F "file=@recent_violations.csv" \
     "http://localhost:8077/predict?horizon=both&format=csv" -o predictions.csv
```

**Output columns** (one row per modeled H3 cell, sorted by `risk_score` desc):
`h3_id, location, severity, risk_score(0-100), pred_24h, pred_48h, dominant_violation,
dominant_vehicle, congestion_score(0-100), blockage_rate(%), confidence(0-1),
forecast_date_24h, forecast_date_48h`

### `GET /health`
Liveness + bundle info (known cells, horizons, schema).

## Input CSV — upload rules (enforced)
Same format as the training dataset: **raw per-violation rows** (one row = one event).
Validation runs before scoring; failures return `400` with `{ok:false, errors:[...]}`.

| # | Rule | Fail message |
|---|---|---|
| 1 | Parses as CSV with a header; file ends in `.csv` | `not a .csv file` / `cannot parse CSV` |
| 2 | All 11 required columns present | `missing required columns: [...]` |
| 3 | ≥ 50 data rows | `only N rows; need >= 50` |
| 4 | ≥ 50% rows have numeric lat/lon **and** parseable `created_datetime` | `latitude/longitude mostly non-numeric` / `created_datetime mostly unparseable` |
| 5 | ≥ 50 rows inside the dataset's coverage bbox (lat 12.7–13.2, lon 77.3–77.9) after filtering | `only N rows inside coverage bbox` |
| 6 | ≥ 8 distinct dates (history for lag/rolling features) | `only N distinct dates; need >= 8` |
| 7 | ≥ 1 H3 cell with ≥ 50 events | `no H3 cell reaches the 50-event threshold` |

**Required columns:**
`latitude, longitude, created_datetime, police_station, violation_type, vehicle_type,
device_id, created_by_id, junction_name, center_code, location`
(extra columns are ignored — the full 24-column dataset works as-is.)

**Non-blocking warnings** (returned in `warnings[]`, and the `X-Validation-Warnings` header
on CSV responses; request still succeeds):
- `< 28 distinct dates` → recommend ≥ 28 for stable features.
- `> 30%` of rows dropped by geo/date filtering → check coordinates/timestamps.

**Format details:** `created_datetime` = ISO timestamp (UTC); `violation_type` = JSON-array
string like `["WRONG PARKING"]`; lat/lon numeric. Rows are bucketed to H3 res-9. Predictions
are for the day **after** the latest `created_datetime`; a cell is scored only if it clears
the 50-event threshold in the supplied window.

### Dry-run validation — `POST /validate`
Check a file without scoring. Same upload rules; returns `{ok, warnings, summary}` where
`summary` has `rows_in/rows_used/rows_dropped, distinct_dates, date_range, cells_modeled,
forecast_date_24h`.
```bash
curl -F "file=@recent.csv" http://localhost:8077/validate
```

## How it works
1. `load_clean` → geo-filter, H3 cell, hour, date.
2. `build_panel` → the full leakage-safe feature set (lags, rolling, ewm, hotspot
   persistence, peer/spatial rank, station aggregates, enforcement supply, hour-of-day,
   composition, interactions) — identical to training.
3. Score the latest date with both horizons:
   `pred = ridge( xgb, hurdle=clf×catboost, glm, quantile )` per horizon, plus a LambdaMART
   rank head for ordering.
4. Derive schema KPIs: volume-percentile risk_score, severity, congestion, blockage,
   confidence (ensemble-agreement × density), location/violation/vehicle from attribute maps.

## Notes
- Default port 8077 (8000 was occupied on the dev box). Override with `PORT=xxxx`.
- `confidence` is normalized **within each request** (relative agreement across cells in the
  batch), so it is comparable within a response, not across separate uploads.
- Counts at the very top hotspots are conservative (model shrinks the heavy tail ~30-40%);
  ranking is preserved. See main project notes for the tail-correction option.
