"""
app.py — Flask inference service for Patrol Forecast v6.

POST /predict   multipart form, field 'file' = raw violation CSV (history) -> prediction CSV
                optional query ?horizon=24h|48h|both (default both), ?format=csv|json
GET  /health    liveness + bundle info

The uploaded CSV must contain recent history (the model uses lags/rolling/persistence);
predictions are for the day AFTER the last date in the upload (24h) and the day after that (48h),
one row per modeled H3 cell, with the v6 11-field deployment schema.

Run:  python3 app.py                             # dev server on :8077
      gunicorn -w 2 -b 0.0.0.0:$PORT app:app     # production (PORT defaults to 8077)

Env:  PORT          listen port (default 8077)
      CORS_ORIGINS  comma-separated allowed origins, or '*' (default)
"""
import io, os, sys
import numpy as np, pandas as pd, joblib
from flask import Flask, request, jsonify, Response

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import features_v6 as F
import analytics_v6 as A

HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(HERE, 'production_v6.pkl')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 512 * 1024 * 1024   # 512 MB upload cap

# The browser uploads CSVs to /analytics directly, so cross-origin requests must
# be answered. Comma-separated origins in CORS_ORIGINS, or '*' (the default).
CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]


@app.after_request
def add_cors_headers(resp):
    origin = request.headers.get('Origin')
    if '*' in CORS_ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin or '*'
    elif origin and origin in CORS_ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin
    else:
        return resp
    resp.headers['Vary'] = 'Origin'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Max-Age'] = '86400'
    return resp


@app.route('/<path:_any>', methods=['OPTIONS'])
@app.route('/', methods=['OPTIONS'])
def cors_preflight(_any=None):
    """Answer preflight for every path; headers are added by add_cors_headers."""
    return ('', 204)

_BUNDLE = None
def bundle():
    global _BUNDLE
    if _BUNDLE is None:
        if not os.path.exists(BUNDLE_PATH):
            raise FileNotFoundError('production_v6.pkl not found — run train_production_v6.py first')
        _BUNDLE = joblib.load(BUNDLE_PATH)
    return _BUNDLE


def _count_meta(b, hz, latest):
    """Run the 4-head count ensemble for one horizon on the latest-day rows."""
    h = b[hz]
    xp = np.clip(h['xgb'].predict(latest[F.FEATS_XGB]), 0, None)
    hp = np.clip(h['clf'].predict_proba(latest[F.FEATS_LGB])[:, 1]
                 * np.clip(h['cat'].predict(latest[F.FEATS_CAT]), 0, None), 0, None)
    enc = latest.copy()
    for col, (m, gm) in h['glm_enc'].items():
        enc[col+'_te'] = enc[col].map(m).fillna(gm)
    Xg = enc[h['glm_cols']].replace([np.inf, -np.inf], 0).fillna(0).values
    gp = np.clip(h['glm'].predict(h['scaler'].transform(Xg)), 0, None)
    qp = np.clip(h['quant'].predict(latest[F.FEATS_LGB]), 0, None)
    w = np.array(h['ridge_w'])
    pred = np.clip(np.column_stack([xp, hp, gp, qp]) @ w, 0, None)
    return pred, np.column_stack([xp, hp, gp, qp])


def run_inference(clean_df, horizon='both'):
    b = bundle()
    panel, keep, _ = F.build_panel(clean_df)           # rebuild leakage-safe features
    panel['station'] = panel['station'].cat.set_categories(b['station_cats'])
    latest = panel[panel.date == panel.date.max()].copy()   # forecast next day per cell
    if len(latest) == 0:
        raise ValueError('no cells to score on the latest date')

    pred24, heads24 = _count_meta(b, '24h', latest)
    pred48, _       = _count_meta(b, '48h', latest)
    rank_raw = b['rank'].predict(latest[F.FEATS_LGB])

    a = b['attrs']
    cells = latest['cell'].values
    def m(d, default): return np.array([d.get(c, default) for c in cells])
    blockage = m(a['blockage'], 0).astype(float)
    fourw    = m(a['four_wheel'], 0.0)
    events   = m(a['cell_events'], 0.0)
    dens     = np.clip(events / (a['density_p90'] or 1), 0, 1)

    # confidence: ensemble agreement (low CV across 4 heads) x data density
    cv = heads24.std(axis=1) / (heads24.mean(axis=1) + 1.0)
    cv_norm = (cv - cv.min()) / (cv.max() - cv.min() + 1e-9)
    confidence = np.round((1 - cv_norm) * dens, 2).clip(0, 1)

    # rank_score (within-day percentile blend) + volume-dominant risk
    def pct(x): return pd.Series(x).rank(pct=True).values
    rank_score = 0.5*pct(pred24) + 0.25*pct(np.clip(latest['lag_1'].fillna(0).values,0,None)) + 0.25*pct(rank_raw)
    streak = latest['hotspot_streak_7d'].fillna(0).values
    was_top = latest['was_top10_lag1'].fillna(0).values
    growth = latest['growth_7'].fillna(0).clip(0, 1).values
    risk_raw = pct(pred24) * (1 + 0.5*was_top + 0.1*np.clip(streak,0,7)/7 + 0.2*growth)
    risk_score = (pct(risk_raw) * 100).round().astype(int)

    q = b['severity_quantiles']
    def sev(c):
        return 'Low' if c <= q[0] else 'Medium' if c <= q[1] else 'High' if c <= q[2] else 'Critical'

    cong_raw = pred24 * (1 + blockage/100) * (1 + fourw)
    out = pd.DataFrame({
        'h3_id': cells,
        'location': m(a['name'], 'Unknown'),
        'severity': [sev(c) for c in pred24],
        'risk_score': risk_score,
        'pred_24h': np.round(pred24).astype(int),
        'pred_48h': np.round(pred48).astype(int),
        'dominant_violation': m(a['violation'], 'NA'),
        'dominant_vehicle': m(a['vehicle'], 'NA'),
        'congestion_score': (pct(cong_raw) * 100).round().astype(int),
        'blockage_rate': blockage.round().astype(int),
        'confidence': confidence,
        'forecast_date_24h': (latest['date'].max() + pd.Timedelta(days=1)).date().isoformat(),
        'forecast_date_48h': (latest['date'].max() + pd.Timedelta(days=2)).date().isoformat(),
    })
    if horizon == '24h':
        out = out.drop(columns=['pred_48h', 'forecast_date_48h'])
    elif horizon == '48h':
        out = out.drop(columns=['pred_24h', 'forecast_date_24h'])
    return out.sort_values('risk_score', ascending=False).reset_index(drop=True)

@app.route("/")
def home():
    return {
        "service": "Patrol Forecast v6",
        "status": "running",
        "endpoints": [
            "/health",
            "/validate",
            "/predict",
            "/analytics"
        ]
    }

@app.get('/health')
def health():
    try:
        b = bundle()
        return jsonify(status='ok', bundle='production_v6.pkl',
                       cells_known=len(b['attrs']['name']),
                       horizons=['24h', '48h'],
                       schema=['h3_id','location','severity','risk_score','pred_24h','pred_48h',
                               'dominant_violation','dominant_vehicle','congestion_score',
                               'blockage_rate','confidence'])
    except Exception as e:
        return jsonify(status='error', error=str(e)), 503


def _get_upload():
    """Validate the request envelope and return the file's bytes, or (None, error_response)."""
    if 'file' not in request.files:
        return None, (jsonify(ok=False, errors=["upload a CSV as multipart form field 'file'"]), 400)
    f = request.files['file']
    if not f.filename:
        return None, (jsonify(ok=False, errors=['empty filename']), 400)
    if not f.filename.lower().endswith('.csv'):
        return None, (jsonify(ok=False, errors=[f"'{f.filename}' is not a .csv file"]), 400)
    return f, None


@app.post('/validate')
def validate():
    """Dry-run: check the CSV against upload rules without scoring."""
    f, err = _get_upload()
    if err: return err
    try:
        _, warnings, summary = F.validate_and_clean(io.BytesIO(f.read()))
    except F.CSVValidationError as e:
        return jsonify(ok=False, errors=e.errors, warnings=e.warnings), 400
    except Exception as e:
        return jsonify(ok=False, errors=[f'validation failed: {e}']), 500
    return jsonify(ok=True, warnings=warnings, summary=summary)


@app.post('/predict')
def predict():
    f, err = _get_upload()
    if err: return err
    horizon = request.args.get('horizon', 'both')
    fmt = request.args.get('format', 'csv')
    try:
        clean_df, warnings, summary = F.validate_and_clean(io.BytesIO(f.read()))
        result = run_inference(clean_df, horizon=horizon)
    except F.CSVValidationError as e:
        return jsonify(ok=False, errors=e.errors, warnings=e.warnings), 400
    except Exception as e:
        return jsonify(ok=False, errors=[f'inference failed: {e}']), 500

    if fmt == 'json':
        return jsonify(ok=True, count=len(result), warnings=warnings, summary=summary,
                       predictions=result.to_dict(orient='records'))
    buf = io.StringIO(); result.to_csv(buf, index=False)
    fname = f'predictions_{summary["forecast_date_24h"]}.csv'
    headers = {'Content-Disposition': f'attachment; filename={fname}'}
    if warnings:
        headers['X-Validation-Warnings'] = ' | '.join(warnings)
    return Response(buf.getvalue(), mimetype='text/csv', headers=headers)


@app.post('/analytics')
def analytics():
    """Full bundle: predictions + all descriptive analytics for the web dashboard."""
    f, err = _get_upload()
    if err: return err
    try:
        clean_df, warnings, summary = F.validate_and_clean(io.BytesIO(f.read()))
        out = run_inference(clean_df, horizon='both')
        bundle = A.build_bundle(clean_df, out, summary, warnings)
    except F.CSVValidationError as e:
        return jsonify(ok=False, errors=e.errors, warnings=e.warnings), 400
    except Exception as e:
        return jsonify(ok=False, errors=[f'analytics failed: {e}']), 500
    return jsonify(ok=True, bundle=bundle)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8077)), debug=False)
