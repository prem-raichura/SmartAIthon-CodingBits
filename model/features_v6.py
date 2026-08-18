"""
features_v6.py — shared feature pipeline for Patrol Forecast v6.
Used by BOTH train_production_v6.py and the Flask inference app so features match exactly.

build_panel(df_raw) -> (panel, keep, attrs)
  panel : per-cell-per-day dataframe with the full leakage-safe feature set + targets y_t1/y_t2
  keep  : index of modeled cells (>= MIN_CELL_EVENTS)
  attrs : dict of per-cell static maps (location/violation/vehicle/blockage/four_wheeler/events)
"""
import re, json
import numpy as np
import pandas as pd
import h3
import holidays

H3_RES          = 9
TZ              = 'Asia/Kolkata'
MIN_CELL_EVENTS = 50
TOP_K           = 10

ROAD_BLOCK = {'PARKING IN A MAIN ROAD','PARKING NEAR ROAD CROSSING',
              'PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS','PARKING ON FOOTPATH',
              'DOUBLE PARKING','PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC',
              'PARKING OPPOSITE TO ANOTHER PARKED VEHICLE'}
FOUR_WHEEL = {'CAR','LGV','MAXI-CAB','PRIVATE BUS','VAN','TEMPO','BUS (BMTC/KSRTC)','GOODS AUTO'}
BUCKET = {'WRONG PARKING':'wrong','NO PARKING':'no_parking','PARKING IN A MAIN ROAD':'road',
          'PARKING NEAR ROAD CROSSING':'road','PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS':'road',
          'PARKING ON FOOTPATH':'footpath'}

# Numeric feature list (must match training). Categorical 'station'/'station_s'/'junction_s'/'center_s' appended per-model.
FEATS_NUM = [
    'dow','is_weekend','month','day_of_month','quarter','week_of_period','is_month_start','is_month_end',
    'dow_sin','dow_cos','month_sin','month_cos','is_holiday','days_to_holiday','days_from_holiday',
    'lag_1','lag_2','lag_3','lag_7','lag_14','lag_21','lag_28',
    'roll_mean_3','roll_mean_7','roll_mean_14','roll_mean_21','roll_std_7','roll_std_14','roll_max_7','roll_median_7',
    'ewm_7','ewm_14','ewm_28','accel','diff_1','diff_7','growth_7','growth_28',
    'same_dow_mean','cell_expanding_mean','dev_from_dow','cell_rank','cell_pct_rank_7d','cell_pct_rank_28d',
    'was_top10_lag1','was_top10_lag3','was_top10_lag7','top_rank_pct_lag1','hotspot_streak_7d','hotspot_streak_14d',
    'nbr_count_lag1','nbr_ring2_lag1',
    'station_lag1_total','station_roll7_mean','station_roll14_mean','station_n_hotspots_lag1',
    'dev_lag1','off_lag1','hours_lag1','dev_roll7','off_roll7','hours_roll7','evt_per_dev_lag1',
    'sh_morn','sh_noon','sh_eve','sh_night','peak_hour_lag1',
    'share_wrong','share_nopark','share_2wheeler',
    'lag1_x_streak7','cell_rank_x_growth','rank_x_weekend','ewm7_x_streak7','nbr_x_streak','dev_x_rank',
]
FEATS_XGB = FEATS_NUM + ['station']
FEATS_LGB = FEATS_NUM + ['station']
FEATS_CAT = FEATS_NUM + ['station_s','junction_s','center_s']
CAT_IDX   = [FEATS_CAT.index(c) for c in ['station_s','junction_s','center_s']]

REQUIRED_COLS = ['latitude','longitude','created_datetime','police_station',
                 'violation_type','vehicle_type','device_id','created_by_id',
                 'junction_name','center_code','location']

# ── upload validation rules ──
LAT_MIN, LAT_MAX = 12.7, 13.2          # dataset coverage bounding box
LON_MIN, LON_MAX = 77.3, 77.9
MAX_BYTES        = 512 * 1024 * 1024   # 512 MB
MIN_RAW_ROWS     = 50                  # below this the file is not real history
MIN_VALID_FRAC   = 0.50                # >=50% of rows must have numeric lat/lon + parseable datetime
MIN_GEO_ROWS     = 50                  # rows surviving geo+date filter
MIN_DATES_ERROR  = 8                   # need >= 8 distinct days for lag_7/rolling features
MIN_DATES_WARN   = 28                  # recommend >= 28 days
MIN_MODELED_CELLS= 1                   # >=1 cell clearing MIN_CELL_EVENTS


class CSVValidationError(Exception):
    """Raised when an uploaded CSV fails the upload rules. Carries structured errors/warnings."""
    def __init__(self, errors, warnings=None):
        self.errors = errors if isinstance(errors, list) else [errors]
        self.warnings = warnings or []
        super().__init__('; '.join(self.errors))


def _read_csv(csv_path_or_buffer):
    try:
        df = pd.read_csv(csv_path_or_buffer, low_memory=False)
    except pd.errors.EmptyDataError:
        raise CSVValidationError(['file is empty or not a valid CSV'])
    except Exception as e:
        raise CSVValidationError([f'cannot parse CSV: {e}'])
    return df


def _clean(df):
    """Geo/date filter + H3 cell + hour + date. Assumes columns already validated."""
    df = df.copy()
    df['latitude']  = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    df['dt']   = pd.to_datetime(df['created_datetime'], errors='coerce', utc=True).dt.tz_convert(TZ)
    df = df.dropna(subset=['dt','latitude','longitude'])
    df = df[df.latitude.between(LAT_MIN, LAT_MAX) & df.longitude.between(LON_MIN, LON_MAX)]
    df['hour'] = df['dt'].dt.hour
    df['date'] = df['dt'].dt.floor('D').dt.tz_localize(None)
    df['cell'] = [h3.latlng_to_cell(la, lo, H3_RES) for la, lo in zip(df.latitude, df.longitude)]
    return df


def validate_and_clean(csv_path_or_buffer):
    """
    Enforce upload rules, then return (clean_df, warnings, summary).
    Raises CSVValidationError(errors, warnings) on any hard failure.
    Rules:
      1. parses as CSV with a header
      2. all REQUIRED_COLS present
      3. >= MIN_RAW_ROWS data rows
      4. >= 50% rows have numeric lat/lon AND parseable created_datetime
      5. >= MIN_GEO_ROWS rows fall inside the coverage bbox after filtering
      6. >= MIN_DATES_ERROR distinct dates (history needed for lag/rolling features)
      7. >= 1 H3 cell reaching the modeling threshold (>= 50 events)
    """
    df = _read_csv(csv_path_or_buffer)

    # rule 2 — columns (fatal; cannot continue without them)
    miss = [c for c in REQUIRED_COLS if c not in df.columns]
    if miss:
        raise CSVValidationError([f'missing required columns: {miss}. '
                                  f'Required: {REQUIRED_COLS}'])
    # rule 3 — non-trivial row count
    if len(df) == 0:
        raise CSVValidationError(['CSV has a header but no data rows'])
    if len(df) < MIN_RAW_ROWS:
        raise CSVValidationError([f'only {len(df)} rows; need >= {MIN_RAW_ROWS}. '
                                  f'Upload recent history, not a single day'])

    errors, warnings = [], []
    # rule 4 — parseable lat/lon/datetime
    lat = pd.to_numeric(df['latitude'], errors='coerce')
    lon = pd.to_numeric(df['longitude'], errors='coerce')
    dt  = pd.to_datetime(df['created_datetime'], errors='coerce', utc=True)
    if lat.notna().mean() < MIN_VALID_FRAC or lon.notna().mean() < MIN_VALID_FRAC:
        errors.append('latitude/longitude are mostly non-numeric — check those columns')
    if dt.notna().mean() < MIN_VALID_FRAC:
        errors.append('created_datetime mostly unparseable — expected ISO timestamps')
    if errors:
        raise CSVValidationError(errors)

    clean = _clean(df)
    # rule 5 — geo coverage
    if len(clean) < MIN_GEO_ROWS:
        raise CSVValidationError([
            f'only {len(clean)} rows inside coverage bbox '
            f'(lat {LAT_MIN}-{LAT_MAX}, lon {LON_MIN}-{LON_MAX}) with valid dates; '
            f'need >= {MIN_GEO_ROWS}'])
    # rule 6 — history span
    ndates = clean['date'].nunique()
    if ndates < MIN_DATES_ERROR:
        raise CSVValidationError([
            f'only {ndates} distinct dates; need >= {MIN_DATES_ERROR} for lag/rolling features'])
    if ndates < MIN_DATES_WARN:
        warnings.append(f'{ndates} distinct dates supplied; >= {MIN_DATES_WARN} recommended '
                        f'for stable lag/rolling/persistence features')
    # rule 7 — at least one modeled cell
    vc = clean['cell'].value_counts()
    n_modeled = int((vc >= MIN_CELL_EVENTS).sum())
    if n_modeled < MIN_MODELED_CELLS:
        raise CSVValidationError([
            f'no H3 cell reaches the {MIN_CELL_EVENTS}-event modeling threshold; '
            f'provide more history or denser data'], warnings)
    dropped = len(df) - len(clean)
    if dropped / len(df) > 0.30:
        warnings.append(f'{dropped:,} of {len(df):,} rows ({dropped/len(df):.0%}) dropped by '
                        f'geo/date filtering — verify coordinates and timestamps')

    summary = {
        'rows_in': int(len(df)), 'rows_used': int(len(clean)), 'rows_dropped': int(dropped),
        'distinct_dates': int(ndates),
        'date_range': [clean['date'].min().date().isoformat(), clean['date'].max().date().isoformat()],
        'cells_total': int(clean['cell'].nunique()), 'cells_modeled': n_modeled,
        'forecast_date_24h': (clean['date'].max() + pd.Timedelta(days=1)).date().isoformat(),
    }
    return clean, warnings, summary


def load_clean(csv_path_or_buffer):
    """Trusted path (training): validate then return cleaned df."""
    clean, _, _ = validate_and_clean(csv_path_or_buffer)
    return clean


def _clean_jn(s):
    s = re.sub(r'^BTP\d+\s*-\s*', '', str(s))
    return re.sub(r'\s*Junction$', '', s).strip()


def build_attribute_maps(df):
    """Per-cell static attributes for the output schema."""
    def _v0(x):
        try: t = json.loads(x); return t[0] if t else 'NA'
        except Exception: return 'NA'
    df = df.copy()
    df['v0']       = df['violation_type'].apply(_v0)
    df['is_block'] = df['v0'].isin(ROAD_BLOCK)
    df['is_4w']    = df['vehicle_type'].isin(FOUR_WHEEL)

    def cell_name(sub):
        jn = sub['junction_name']; jn = jn[jn != 'No Junction']
        if len(jn):
            top = jn.mode().iloc[0]
            if str(top).strip() and str(top) != 'No Junction':
                return _clean_jn(top)
        ps = sub['police_station'].mode()
        if len(ps) and str(ps.iloc[0]).strip():
            return str(ps.iloc[0]).strip()
        lt = sub['location'].dropna()
        return (str(lt.iloc[0]).split(',')[0].strip()[:40] or 'Unknown') if len(lt) else 'Unknown'

    ce = df.groupby('cell').size()
    return {
        'name':      df.groupby('cell').apply(cell_name),
        'violation': df.groupby('cell')['v0'].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else 'NA'),
        'vehicle':   df.groupby('cell')['vehicle_type'].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else 'NA'),
        'blockage':  (df.groupby('cell')['is_block'].mean()*100).round().astype(int),
        'four_wheel': df.groupby('cell')['is_4w'].mean(),
        'cell_events': ce,
        'density_p90': float(ce.quantile(0.90)),
    }


def build_panel(df, keep=None):
    """Full leakage-safe feature panel. If keep is given (training cells), restrict to it."""
    daily = df.groupby(['cell','date']).size().rename('count').reset_index()
    vc = df.cell.value_counts()
    if keep is None:
        keep = vc[vc >= MIN_CELL_EVENTS].index
    dates = pd.date_range(df.date.min(), df.date.max(), freq='D')
    idx = pd.MultiIndex.from_product([keep, dates], names=['cell','date'])
    panel = daily.set_index(['cell','date']).reindex(idx, fill_value=0).reset_index()

    stmap = df.groupby('cell')['police_station'].agg(lambda s: s.mode().iloc[0])
    jnmap = df.groupby('cell')['junction_name'].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else 'UNK')
    ccmap = df.groupby('cell')['center_code'].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else 'UNK')
    panel['station']    = panel['cell'].map(stmap).astype('category')
    panel['station_s']  = panel['cell'].map(stmap).astype(str)
    panel['junction_s'] = panel['cell'].map(jnmap).astype(str)
    panel['center_s']   = panel['cell'].map(ccmap).astype(str)
    panel = panel.sort_values(['cell','date']).reset_index(drop=True)
    panel['week_idx'] = ((panel.date - panel.date.min()).dt.days // 7).astype(int)

    g = panel.groupby('cell')['count']
    panel['y_t1'] = g.shift(-1)
    panel['y_t2'] = g.shift(-2)

    # calendar
    ka  = holidays.India(subdiv='KA', years=sorted({panel.date.min().year, panel.date.max().year,
                                                     panel.date.min().year+1}))
    hol = pd.to_datetime([d for d in ka if panel.date.min() <= pd.Timestamp(d) <= panel.date.max()])
    panel['dow']=panel.date.dt.dayofweek; panel['is_weekend']=(panel.dow>=5).astype(int)
    panel['month']=panel.date.dt.month; panel['day_of_month']=panel.date.dt.day
    panel['quarter']=panel.date.dt.quarter; panel['week_of_period']=panel.week_idx
    panel['is_month_start']=(panel.day_of_month<=3).astype(int); panel['is_month_end']=(panel.day_of_month>=28).astype(int)
    panel['dow_sin']=np.sin(2*np.pi*panel.dow/7); panel['dow_cos']=np.cos(2*np.pi*panel.dow/7)
    panel['month_sin']=np.sin(2*np.pi*(panel.month-1)/12); panel['month_cos']=np.cos(2*np.pi*(panel.month-1)/12)
    panel['is_holiday']=panel.date.isin(hol).astype(int)
    panel['days_from_holiday']=panel.date.apply(lambda d:(d-hol[hol<=d]).days.min() if (hol<=d).any() else 999)
    panel['days_to_holiday']=panel.date.apply(lambda d:(hol[hol>=d]-d).days.min() if (hol>=d).any() else 999)

    # lags / rolling / trend
    g=panel.groupby('cell')['count']; gp=panel.groupby('cell')['count']
    for L in [1,2,3,7,14,21,28]:
        panel[f'lag_{L}']=g.shift(L)
    def roll(s,w,fn): return s.shift(1).rolling(w,min_periods=max(2,w//2)).agg(fn)
    for w,fn in [(3,'mean'),(7,'mean'),(14,'mean'),(21,'mean'),(7,'std'),(14,'std'),(7,'max'),(7,'median')]:
        panel[f'roll_{fn}_{w}']=gp.transform(lambda s,_w=w,_fn=fn: roll(s,_w,_fn))
    panel['ewm_7']=gp.transform(lambda s:s.shift(1).ewm(span=7,min_periods=2).mean())
    panel['ewm_14']=gp.transform(lambda s:s.shift(1).ewm(span=14,min_periods=4).mean())
    panel['ewm_28']=gp.transform(lambda s:s.shift(1).ewm(span=28,min_periods=7).mean())
    panel['accel']=panel.roll_mean_3-panel.roll_mean_7
    panel['diff_1']=panel.lag_1-panel.lag_2; panel['diff_7']=panel.lag_7-panel.lag_14
    prevwk=gp.transform(lambda s:roll(s,7,'mean').shift(7)); prev4w=gp.transform(lambda s:roll(s,7,'mean').shift(28))
    panel['growth_7']=(panel.roll_mean_7-prevwk)/(prevwk+1); panel['growth_28']=(panel.roll_mean_7-prev4w)/(prev4w+1)

    # same-dow / expanding / rank
    def past_dow_mean(d):
        d=d.sort_values('date')
        return d.groupby('dow')['count'].apply(lambda s:s.shift(1).expanding().mean())
    panel['same_dow_mean']=(panel.groupby('cell',group_keys=False).apply(past_dow_mean).reset_index(level=0,drop=True))
    panel['cell_expanding_mean']=gp.transform(lambda s:s.shift(1).expanding().mean())
    panel['dev_from_dow']=panel.lag_7-panel.same_dow_mean
    panel['cell_rank']=panel.groupby('date')['cell_expanding_mean'].rank(pct=True)
    wm7=panel.pivot_table(index='date',columns='cell',values='roll_mean_7',fill_value=0)
    panel['cell_pct_rank_7d']=(wm7.rank(axis=1,pct=True).shift(1).stack().reindex(panel.set_index(['date','cell']).index).values)
    wm28=panel.pivot_table(index='date',columns='cell',values='roll_mean_21',fill_value=0)
    panel['cell_pct_rank_28d']=(wm28.rank(axis=1,pct=True).shift(1).stack().reindex(panel.set_index(['date','cell']).index).values)

    # hotspot persistence
    wc=panel.pivot_table(index='date',columns='cell',values='count',fill_value=0)
    is_top=(wc.rank(axis=1,ascending=False,method='min')<=TOP_K).astype(int)
    cont=wc.rank(axis=1,ascending=False,pct=True)
    def melt(wd,n): l=wd.stack().rename(n).reset_index(); l.columns=['date','cell',n]; return l
    feats=[(is_top.shift(1).fillna(0),'was_top10_lag1'),(is_top.shift(3).fillna(0),'was_top10_lag3'),
           (is_top.shift(7).fillna(0),'was_top10_lag7'),(cont.shift(1).fillna(1.0),'top_rank_pct_lag1'),
           (is_top.shift(1).rolling(7,min_periods=1).sum(),'hotspot_streak_7d'),
           (is_top.shift(1).rolling(14,min_periods=1).sum(),'hotspot_streak_14d')]
    for wd,n in feats: panel=panel.merge(melt(wd,n),on=['date','cell'],how='left')
    for c in ['was_top10_lag1','was_top10_lag3','was_top10_lag7','hotspot_streak_7d','hotspot_streak_14d']:
        panel[c]=panel[c].fillna(0)
    panel['top_rank_pct_lag1']=panel['top_rank_pct_lag1'].fillna(1.0)

    # spatial rings
    nbrs1={c:[x for x in h3.grid_disk(c,1) if x!=c] for c in keep}
    nbrs2={c:[x for x in h3.grid_disk(c,2) if x!=c and x not in set(nbrs1[c])] for c in keep}
    wide=panel.pivot_table(index='date',columns='cell',values='count',fill_value=0); prev=wide.shift(1)
    def ring(nbr,n):
        ns={}
        for c,nn in nbr.items():
            cols=[x for x in nn if x in prev.columns]
            ns[c]=prev[cols].sum(axis=1) if cols else pd.Series(0,index=prev.index)
        d_=pd.DataFrame(ns).stack().rename(n).reset_index(); d_.columns=['date','cell',n]; return d_
    panel=panel.merge(ring(nbrs1,'nbr_count_lag1'),on=['date','cell'],how='left')
    panel=panel.merge(ring(nbrs2,'nbr_ring2_lag1'),on=['date','cell'],how='left')

    # station aggregates
    panel['station_str']=panel['cell'].map(stmap).astype(str)
    std=panel.groupby(['station_str','date'])['count'].sum().rename('station_count').reset_index()
    panel=panel.merge(std,on=['station_str','date'],how='left')
    gst=panel.groupby('station_str')['station_count']
    panel['station_lag1_total']=gst.shift(1)
    panel['station_roll7_mean']=gst.transform(lambda s:s.shift(1).rolling(7,min_periods=2).mean())
    panel['station_roll14_mean']=gst.transform(lambda s:s.shift(1).rolling(14,min_periods=3).mean())
    tl1=melt(is_top.shift(1).fillna(0),'wt'); tl1['station_str']=tl1['cell'].map(stmap).astype(str)
    sh=tl1.groupby(['station_str','date'])['wt'].sum().rename('station_n_hotspots_lag1').reset_index()
    panel=panel.merge(sh,on=['station_str','date'],how='left'); panel['station_n_hotspots_lag1']=panel['station_n_hotspots_lag1'].fillna(0)

    # enforcement supply
    enf=df.groupby(['cell','date']).agg(n_devices=('device_id','nunique'),
        n_officers=('created_by_id','nunique'),n_hours=('hour','nunique')).reset_index()
    panel=panel.merge(enf,on=['cell','date'],how='left')
    for c in ['n_devices','n_officers','n_hours']: panel[c]=panel[c].fillna(0)
    gen=panel.groupby('cell')
    panel['dev_lag1']=gen['n_devices'].shift(1); panel['off_lag1']=gen['n_officers'].shift(1); panel['hours_lag1']=gen['n_hours'].shift(1)
    panel['dev_roll7']=gen['n_devices'].transform(lambda s:s.shift(1).rolling(7,min_periods=2).mean())
    panel['off_roll7']=gen['n_officers'].transform(lambda s:s.shift(1).rolling(7,min_periods=2).mean())
    panel['hours_roll7']=gen['n_hours'].transform(lambda s:s.shift(1).rolling(7,min_periods=2).mean())
    panel['evt_per_dev_lag1']=panel['lag_1']/(panel['dev_lag1']+1)

    # hour-of-day distribution
    def hb(h):
        if 5<=h<11: return 'morn'
        if 11<=h<16: return 'noon'
        if 16<=h<21: return 'eve'
        return 'night'
    d2=df.copy(); d2['hb']=d2['hour'].apply(hb)
    hd=(d2.groupby(['cell','date'])['hb'].value_counts(normalize=True).unstack(fill_value=0).reset_index())
    for b in ['morn','noon','eve','night']:
        if b not in hd.columns: hd[b]=0.0
        hd=hd.rename(columns={b:f'sh_{b}'})
    peak=d2.groupby(['cell','date'])['hour'].agg(lambda s:s.mode().iloc[0]).rename('peak_hour').reset_index()
    hd=hd.merge(peak,on=['cell','date'],how='left')
    panel=panel.merge(hd[['cell','date','sh_morn','sh_noon','sh_eve','sh_night','peak_hour']],on=['cell','date'],how='left')
    for c in ['sh_morn','sh_noon','sh_eve','sh_night']:
        panel[c]=panel.groupby('cell')[c].transform(lambda s:s.shift(1).rolling(7,min_periods=1).mean()).fillna(0)
    panel['peak_hour_lag1']=panel.groupby('cell')['peak_hour'].shift(1).fillna(-1)

    # composition shares
    def primary(x):
        try: t=json.loads(x)
        except Exception: return 'other'
        return BUCKET.get(t[0],'other') if t else 'other'
    d3=df.copy(); d3['vbucket']=d3['violation_type'].apply(primary)
    d3['is2w']=d3['vehicle_type'].isin(['SCOOTER','MOTOR CYCLE','MOPED'])
    sh=d3.groupby(['cell','date']).agg(share_wrong=('vbucket',lambda s:(s=='wrong').mean()),
        share_nopark=('vbucket',lambda s:(s=='no_parking').mean()),share_2wheeler=('is2w','mean')).reset_index()
    panel=panel.merge(sh,on=['cell','date'],how='left')
    for c in ['share_wrong','share_nopark','share_2wheeler']:
        panel[c]=panel.groupby('cell')[c].transform(lambda s:s.shift(1).rolling(7,min_periods=1).mean())

    # interactions
    panel['lag1_x_streak7']=panel['lag_1'].fillna(0)*panel['hotspot_streak_7d']
    panel['cell_rank_x_growth']=panel['cell_rank'].fillna(0)*panel['growth_7'].fillna(0).clip(-1,1)
    panel['rank_x_weekend']=panel['cell_rank'].fillna(0)*panel['is_weekend']
    panel['ewm7_x_streak7']=panel['ewm_7'].fillna(0)*panel['hotspot_streak_7d']
    panel['nbr_x_streak']=panel['nbr_count_lag1'].fillna(0)*panel['hotspot_streak_7d']
    panel['dev_x_rank']=panel['dev_lag1'].fillna(0)*panel['cell_rank'].fillna(0)

    panel['station']=panel['station'].astype('category')
    for c in ['station_s','junction_s','center_s']:
        panel[c]=panel[c].astype(str)
    return panel, keep, build_attribute_maps(df)
