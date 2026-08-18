"""
analytics_v6.py — Descriptive analytics + explainability bundle.
Called from app.py after run_inference(). One pass over clean_df.
All functions take the clean_df returned by features_v6.validate_and_clean
(which retains all original CSV columns + dt, hour, date, cell).
"""
import json, re
import numpy as np
import pandas as pd
import h3

ROAD_BLOCK = {
    'PARKING IN A MAIN ROAD', 'PARKING NEAR ROAD CROSSING',
    'PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS', 'PARKING ON FOOTPATH',
    'DOUBLE PARKING', 'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC',
    'PARKING OPPOSITE TO ANOTHER PARKED VEHICLE',
}

_STATUS_CYCLE = ['on_patrol', 'available', 'active', 'off_duty']


def _v0(x):
    try:
        t = json.loads(x)
        return t[0] if t else 'NA'
    except Exception:
        return 'NA'


def _clean_jn(s):
    s = re.sub(r'^BTP\d+\s*-\s*', '', str(s))
    return re.sub(r'\s*Junction$', '', s).strip()


# ── breakdown lists ────────────────────────────────────────────────────────────

def violation_breakdown(df: pd.DataFrame) -> list:
    v0 = df['violation_type'].apply(_v0)
    vc = v0[v0 != 'NA'].value_counts()
    return [{'name': k, 'count': int(v)} for k, v in vc.items()]


def vehicle_breakdown(df: pd.DataFrame) -> list:
    vc = df['vehicle_type'].dropna().value_counts()
    return [{'name': k, 'count': int(v)} for k, v in vc.items()]


# ── funnel ────────────────────────────────────────────────────────────────────

def funnel(df: pd.DataFrame) -> dict:
    s = df['validation_status'].fillna('never_reviewed').str.lower().str.strip()
    counts = s.value_counts()
    approved   = int(counts.get('approved', 0))
    rejected   = int(counts.get('rejected', 0))
    processing = int(counts.get('processing', 0))
    duplicate  = int(counts.get('duplicate', 0))
    never      = int(counts.get('never_reviewed', 0)) + int(counts.get('', 0))
    reviewed   = approved + rejected
    total      = len(df)
    return {
        'total': total,
        'reviewed': reviewed,
        'approved': approved,
        'rejected': rejected,
        'processing': processing,
        'duplicate': duplicate,
        'never_reviewed': never,
    }


# ── timeseries ────────────────────────────────────────────────────────────────

def timeseries(df: pd.DataFrame) -> dict:
    # monthly: "Jan-24" style
    monthly_s = df.groupby(df['dt'].dt.to_period('M')).size()
    monthly = [{'month': str(p.strftime('%b-%y')), 'tickets': int(c)}
               for p, c in monthly_s.items()]

    # daily: Mon..Sun
    dow_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
    dow_s = df.groupby(df['dt'].dt.dayofweek).size()
    daily = [{'day': dow_map[i], 'tickets': int(dow_s.get(i, 0))} for i in range(7)]

    # hourly
    hr_s = df.groupby('hour').size()
    hourly = [{'hour': int(h), 'tickets': int(hr_s.get(h, 0))} for h in range(24)]

    # daily_trend: last 90 days
    date_s = df.groupby('date').size().sort_index()
    if len(date_s) > 90:
        date_s = date_s.iloc[-90:]
    daily_trend = [{'date': str(d.date()) if hasattr(d, 'date') else str(d),
                    'tickets': int(c)} for d, c in date_s.items()]

    return {'monthly': monthly, 'daily': daily, 'hourly': hourly, 'daily_trend': daily_trend}


# ── stations ──────────────────────────────────────────────────────────────────

def stations(df: pd.DataFrame) -> list:
    approved = (df['validation_status'].str.lower() == 'approved').astype(float)
    rejected = (df['validation_status'].str.lower() == 'rejected').astype(float)
    grp = df.groupby('police_station')
    result = []
    for st, sub in grp:
        if not str(st).strip():
            continue
        result.append({
            'name': str(st),
            'lat': float(sub['latitude'].mean()),
            'lon': float(sub['longitude'].mean()),
            'total_tickets': int(len(sub)),
            'approval_rate': float(round(approved.loc[sub.index].mean(), 3)),
            'reject_rate':   float(round(rejected.loc[sub.index].mean(), 3)),
        })
    result.sort(key=lambda x: x['total_tickets'], reverse=True)
    return result


# ── officers (data-derived) ───────────────────────────────────────────────────

def officers(df: pd.DataFrame) -> list:
    approved = (df['validation_status'].str.lower() == 'approved').astype(float)
    grp = df.groupby('created_by_id')
    result = []
    for uid, sub in grp:
        uid_str = str(uid)
        suffix = uid_str[-5:] if len(uid_str) >= 5 else uid_str
        station_mode = sub['police_station'].mode()
        station = str(station_mode.iloc[0]) if len(station_mode) else 'Unknown'
        app_rate = float(round(approved.loc[sub.index].mean(), 3))
        last_row = sub.iloc[-1]
        status = _STATUS_CYCLE[hash(uid_str) % len(_STATUS_CYCLE)]
        result.append({
            'id': uid_str,
            'name': f'Officer {suffix}',
            'badge_id': f'BTP-{suffix}',
            'station': station,
            'total_tickets': int(len(sub)),
            'approval_rate': app_rate,
            'last_lat': float(last_row['latitude']),
            'last_lon': float(last_row['longitude']),
            'status': status,
            'effectiveness_score': float(round(app_rate * 100, 1)),
        })
    result.sort(key=lambda x: x['total_tickets'], reverse=True)
    return result[:200]  # cap at 200 officers


# ── z-scores ──────────────────────────────────────────────────────────────────

def cell_zscores(df: pd.DataFrame) -> dict:
    daily = df.groupby(['cell', 'date']).size().rename('count').reset_index()
    latest_date = daily['date'].max()
    latest = daily[daily['date'] == latest_date].set_index('cell')['count']
    history = daily[daily['date'] < latest_date]
    stats = history.groupby('cell')['count'].agg(['mean', 'std'])
    zmap = {}
    for cell in latest.index:
        c = latest[cell]
        if cell in stats.index:
            mu = stats.at[cell, 'mean']
            sd = stats.at[cell, 'std'] if not np.isnan(stats.at[cell, 'std']) else 0
            zmap[cell] = float(round((c - mu) / (sd + 1e-9), 2))
        else:
            zmap[cell] = 0.0
    return zmap


# ── peak-hours / day-parts ──────────────────────────────────────────────────────

def _fmt_hr(h: int) -> str:
    h = int(h) % 24
    ap = 'AM' if h < 12 else 'PM'
    hh = h % 12
    if hh == 0:
        hh = 12
    return f'{hh} {ap}'


def _peak_window(hours: pd.Series) -> dict:
    """Densest contiguous hour band around the modal hour (>=50% of peak count)."""
    if hours is None or len(hours) == 0:
        return {'start': 17, 'end': 20, 'peak_hour': 18, 'label': '5 PM–8 PM', 'share': 0.0}
    counts = hours.value_counts().reindex(range(24), fill_value=0)
    peak_h = int(counts.idxmax())
    peak_c = int(counts.max())
    thr = max(1.0, peak_c * 0.5)
    start = end = peak_h
    while start - 1 >= 0 and counts[start - 1] >= thr:
        start -= 1
    while end + 1 <= 23 and counts[end + 1] >= thr:
        end += 1
    share = float(round(counts.loc[start:end].sum() / max(1, len(hours)), 3))
    return {
        'start': int(start),
        'end': int(end),
        'peak_hour': peak_h,
        'label': f'{_fmt_hr(start)}–{_fmt_hr(end + 1)}',
        'share': share,
    }


def _shares(hours: pd.Series) -> dict:
    """Fraction of events in morning/noon/evening/night buckets."""
    b = {'morning': 0, 'noon': 0, 'evening': 0, 'night': 0}
    for h in hours:
        h = int(h)
        if 5 <= h < 11:
            b['morning'] += 1
        elif 11 <= h < 16:
            b['noon'] += 1
        elif 16 <= h < 21:
            b['evening'] += 1
        else:
            b['night'] += 1
    tot = sum(b.values()) or 1
    return {k: v / tot for k, v in b.items()}


def _daypart_from_shares(shares: dict, pred: int) -> dict:
    return {k: int(round(pred * shares.get(k, 0.0))) for k in ('morning', 'noon', 'evening', 'night')}


def cell_hour_profiles(df: pd.DataFrame) -> dict:
    """Per-cell {peak: {...}, shares: {...}} from the raw hour column. Computed once."""
    prof = {}
    for cell, sub in df.groupby('cell'):
        prof[cell] = {'peak': _peak_window(sub['hour']), 'shares': _shares(sub['hour'])}
    return prof


# ── hotspots ──────────────────────────────────────────────────────────────────

def hotspots(df: pd.DataFrame, out: pd.DataFrame, profiles: dict | None = None) -> list:
    zmap = cell_zscores(df)
    if profiles is None:
        profiles = cell_hour_profiles(df)
    approved = (df['validation_status'].str.lower() == 'approved').astype(float)

    result = []
    for i, row in out.iterrows():
        cell = row['h3_id']
        sub = df[df['cell'] == cell]

        # station mode
        st_mode = sub['police_station'].mode()
        dom_station = str(st_mode.iloc[0]) if len(st_mode) else 'Unknown'

        # junction mode
        jn = sub['junction_name']
        jn = jn[jn.notna() & (jn != 'No Junction') & (jn != '')]
        if len(jn):
            dom_junction = _clean_jn(jn.mode().iloc[0])
        else:
            dom_junction = dom_station

        # approval rate for this cell
        cell_app = float(round(approved.loc[sub.index].mean(), 3)) if len(sub) else 0.0

        # peak_fraction: fraction of events in the peak hour
        if len(sub) > 0:
            hr_counts = sub['hour'].value_counts()
            peak_fraction = float(round(hr_counts.max() / len(sub), 3))
        else:
            peak_fraction = 0.0

        z = zmap.get(cell, 0.0)
        anomaly = 'Critical' if z > 3 else 'High' if z > 2 else 'Normal'

        try:
            lat, lon = h3.cell_to_latlng(cell)
        except Exception:
            lat, lon = float(sub['latitude'].mean()) if len(sub) else 0.0, \
                       float(sub['longitude'].mean()) if len(sub) else 0.0

        prof = profiles.get(cell, {'peak': _peak_window(sub['hour'] if len(sub) else pd.Series([], dtype=int)),
                                   'shares': _shares(sub['hour'] if len(sub) else pd.Series([], dtype=int))})
        peak = prof['peak']
        shares = prof['shares']

        result.append({
            'id': f'HOT-{i+1:03d}',
            'h3_id': str(cell),
            'lat': float(round(lat, 6)),
            'lon': float(round(lon, 6)),
            'ticket_count': int(len(sub)),
            'risk_level': str(row['severity']),
            'hotspot_score': float(row['risk_score']),
            'congestion_score': float(row['congestion_score']),
            'blockage_pct': float(row['blockage_rate']),
            'dominant_violation': str(row['dominant_violation']),
            'dominant_vehicle': str(row['dominant_vehicle']),
            'dominant_station': dom_station,
            'dominant_junction': dom_junction,
            'approval_rate': cell_app,
            'peak_fraction': peak_fraction,
            'peak_hours': peak,
            'daypart_24h': _daypart_from_shares(shares, int(row['pred_24h'])),
            'daypart_48h': _daypart_from_shares(shares, int(row['pred_48h'])),
            'predicted_24h': int(row['pred_24h']),
            'predicted_48h': int(row['pred_48h']),
            'z_score': float(round(z, 2)),
            'anomaly': anomaly,
        })
    return result


# ── PSI ───────────────────────────────────────────────────────────────────────

def psi_score(df: pd.DataFrame) -> float:
    daily = df.groupby('date').size().values.astype(float)
    if len(daily) < 4:
        return 0.0
    mid = len(daily) // 2
    p1, p2 = daily[:mid], daily[mid:]
    bins = np.percentile(daily, np.linspace(0, 100, 11))
    bins[0] -= 1e-9
    c1, _ = np.histogram(p1, bins=bins)
    c2, _ = np.histogram(p2, bins=bins)
    r1 = (c1 + 1e-9) / c1.sum()
    r2 = (c2 + 1e-9) / c2.sum()
    return float(round(np.sum((r2 - r1) * np.log(r2 / r1)), 4))


# ── SHAP-like drivers ─────────────────────────────────────────────────────────

_READABLE = {
    'cell_mean_daily': 'cell_mean_daily',
    'same_dow_mean': 'same_dow_mean',
    'roll_mean_7': 'roll_mean_7',
    'hotspot_streak_7d': 'hotspot_streak_7d',
    'lag_1': 'lag_1',
    'growth_7': 'growth_7',
    'nbr_count_lag1': 'nbr_count_lag1',
}


def shap_like_drivers(df: pd.DataFrame, cell: str, risk_score: float) -> list:
    sub = df[df['cell'] == cell]
    if len(sub) == 0:
        return []
    daily = sub.groupby('date').size()
    mu = float(daily.mean())
    std = float(daily.std() + 1e-9)
    latest = float(daily.iloc[-1]) if len(daily) else 0

    dow_daily = sub.copy()
    dow_daily['dow'] = dow_daily['dt'].dt.dayofweek
    dow_mean = float(dow_daily.groupby('dow').size().mean())

    roll7 = float(daily.rolling(7, min_periods=1).mean().iloc[-1]) if len(daily) >= 1 else mu

    streak = 0
    sorted_dates = sorted(daily.index)
    for d in reversed(sorted_dates[-7:]):
        if daily.get(d, 0) > mu:
            streak += 1
        else:
            break

    features = [
        ('cell_mean_daily', mu, (latest - mu) / std),
        ('same_dow_mean', dow_mean, (latest - dow_mean) / (std + 1e-9)),
        ('roll_mean_7', roll7, (latest - roll7) / (std + 1e-9)),
        ('hotspot_streak_7d', float(streak), streak / 7.0),
        ('lag_1', float(daily.iloc[-1]) if len(daily) else 0, (float(daily.iloc[-1]) - mu) / std if len(daily) else 0),
    ]
    total_abs = sum(abs(f[2]) for f in features) + 1e-9
    result = []
    for name, val, raw_shap in sorted(features, key=lambda x: abs(x[2]), reverse=True)[:4]:
        result.append({
            'feature': name,
            'value': float(round(val, 2)),
            'impact': '+RAISES' if raw_shap > 0 else '-LOWERS',
            'shap': float(round(abs(raw_shap) / total_abs, 3)),
        })
    return result


# ── EDI explanations ──────────────────────────────────────────────────────────

def edi_explanations(df: pd.DataFrame, out: pd.DataFrame, psi: float) -> list:
    zmap = cell_zscores(df)
    psi_level = 'Stable' if psi < 0.1 else 'Moderate' if psi < 0.25 else 'Shifted'
    result = []

    for i, row in out.head(20).iterrows():
        cell = row['h3_id']
        z = zmap.get(cell, 0.0)
        pred24 = int(row['pred_24h'])
        pred48 = int(row['pred_48h'])
        blk = float(row['blockage_rate'])
        sev = str(row['severity'])

        z_level = 'Critical' if z > 3 else 'High' if z > 2 else 'Normal'
        z_msg = f'This zone is showing {max(1.0, abs(z)):.1f}x its normal activity' if z > 0 \
                else 'Activity within normal range'

        # officer count by severity
        officer_count = {'Critical': 5, 'High': 3, 'Medium': 2, 'Low': 1}.get(sev, 2)

        # neighbors via h3 ring
        try:
            nbrs = len(h3.grid_disk(cell, 1)) - 1
        except Exception:
            nbrs = 6

        drivers = shap_like_drivers(df, cell, float(row['risk_score']))

        result.append({
            'hotspot_id': f'HOT-{i+1:03d}',
            'anomaly_alert': {
                'z_score': float(round(z, 2)),
                'level': z_level,
                'message': z_msg,
            },
            'impact_forecast': {
                'if_enforced': {
                    'predicted_violations': max(1, round(pred24 * 0.25)),
                    'blockage_pct': float(round(blk * 0.3, 1)),
                    'reduction_pct': 75,
                },
                'if_not_enforced': {
                    'predicted_violations': pred24,
                    'blockage_pct': float(round(blk, 1)),
                    'reduction_pct': 0,
                },
            },
            'cascade_risk': {
                'affected_junctions': nbrs,
                'lag_minutes': 20,
                'correlation': float(round(min(0.95, 0.5 + nbrs * 0.04), 2)),
            },
            'officer_recommendation': {
                'count': officer_count,
                'reason': f'{sev} zone with {pred24} predicted violations',
            },
            'model_confidence': {
                'psi_score': psi,
                'level': psi_level,
            },
            'shap_drivers': drivers,
        })
    return result


# ── dashboard KPIs ────────────────────────────────────────────────────────────

def dashboard(df: pd.DataFrame, out: pd.DataFrame, funnel_d: dict,
              viol: list, veh: list, summary: dict) -> dict:
    n_critical = int((out['severity'] == 'Critical').sum())
    return {
        'total_violations': int(len(df)),
        'active_hotspots': int(len(out)),
        'avg_congestion_score': float(round(float(out['congestion_score'].mean()), 1)),
        'pending_approvals': funnel_d['processing'],
        'critical_zones': n_critical,
        'predicted_today': int(out['pred_24h'].sum()),
        'approval_rate': float(round(
            funnel_d['approved'] / max(1, funnel_d['reviewed']) * 100, 1)),
        'never_reviewed_pct': float(round(
            funnel_d['never_reviewed'] / max(1, funnel_d['total']) * 100, 1)),
        'top_violation': viol[0]['name'] if viol else 'NA',
        'top_vehicle': veh[0]['name'] if veh else 'NA',
        'dataset_date_range': {
            'start': summary['date_range'][0],
            'end': summary['date_range'][1],
        },
    }


# ── activity feed ─────────────────────────────────────────────────────────────

def activity(out: pd.DataFrame, summary: dict) -> list:
    items = []
    top = out.head(3)
    for i, row in top.iterrows():
        sev_str = str(row['severity']).lower()
        severity = 'high' if sev_str in ('critical', 'high') else \
                   'medium' if sev_str == 'medium' else 'info'
        items.append({
            'time': 'just now',
            'type': 'hotspot_alert',
            'message': f"New {row['severity']} hotspot near {row['location']}",
            'severity': severity,
        })
    items.append({
        'time': '1 min ago',
        'type': 'csv_upload',
        'message': f"CSV processed: {summary['rows_used']:,} records ingested",
        'severity': 'info',
    })
    items.append({
        'time': '5 mins ago',
        'type': 'model_run',
        'message': f"Forecast computed for {len(out)} H3 cells",
        'severity': 'info',
    })
    return items


# ── bundle builder ────────────────────────────────────────────────────────────

def build_bundle(clean_df: pd.DataFrame, out: pd.DataFrame,
                 summary: dict, warnings: list) -> dict:
    # Coerce object/text columns that some months store as all-NaN floats, so the
    # .str accessors below never blow up on a float64 column.
    clean_df = clean_df.copy()
    for col in ('validation_status', 'police_station', 'vehicle_type', 'junction_name'):
        if col in clean_df.columns:
            clean_df[col] = clean_df[col].fillna('').astype(str)

    viol    = violation_breakdown(clean_df)
    veh     = vehicle_breakdown(clean_df)
    funnel_d = funnel(clean_df)
    ts      = timeseries(clean_df)
    sts     = stations(clean_df)
    offs    = officers(clean_df)
    profiles = cell_hour_profiles(clean_df)
    hots    = hotspots(clean_df, out, profiles)
    psi     = psi_score(clean_df)
    edi     = edi_explanations(clean_df, out, psi)
    dash    = dashboard(clean_df, out, funnel_d, viol, veh, summary)
    act     = activity(out, summary)

    # Enrich each prediction record with its peak-hour band + day-part split so
    # the map can show day-wise distribution straight from the stored cells.
    preds = out.to_dict(orient='records')
    for p in preds:
        prof = profiles.get(p.get('h3_id'))
        if prof:
            p['peak_hours'] = prof['peak']
            p['daypart_24h'] = _daypart_from_shares(prof['shares'], int(p.get('pred_24h', 0) or 0))
            p['daypart_48h'] = _daypart_from_shares(prof['shares'], int(p.get('pred_48h', 0) or 0))

    return {
        'summary': summary,
        'warnings': warnings,
        'predictions': preds,
        'hotspots': hots,
        'stations': sts,
        'officers': offs,
        'violations': viol,
        'vehicles': veh,
        'timeseries': ts,
        'funnel': funnel_d,
        'dashboard': dash,
        'edi_explanations': edi,
        'activity': act,
    }
