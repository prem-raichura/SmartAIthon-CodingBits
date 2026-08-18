"""
make_seed_upload.py — Generate the bootstrap "past-month" upload CSV.

The app's normal flow is: upload last month's raw violations -> model predicts
next 24h/48h. To bootstrap an empty system we carve the most-recent full month
out of the historical anonymised dataset and (optionally) SMOTE-like augment the
sparse H3 cells so the file is well-balanced and comfortably passes
features_v6.validate_and_clean (>=50 rows, >=8 dates, >=1 dense cell).

Usage:
    python3 make_seed_upload.py
    python3 make_seed_upload.py --month 2023-05 --augment --target-per-cell 40
"""
import argparse
import os
import numpy as np
import pandas as pd

try:
    import h3
    _H3 = True
except Exception:
    _H3 = False

DEFAULT_INPUT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'jan to may police violation_anonymized791b166.csv')
)
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), 'seed_upload.csv')
H3_RES = 9


def _parse_dt(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors='coerce', utc=True)


def carve_month(df: pd.DataFrame, month: str | None) -> tuple[pd.DataFrame, str]:
    dt = _parse_dt(df['created_datetime'])
    df = df.assign(_dt=dt).dropna(subset=['_dt'])
    df['_period'] = df['_dt'].dt.to_period('M')
    if month:
        period = pd.Period(month, freq='M')
    else:
        period = df['_period'].max()  # most-recent full month present
    carved = df[df['_period'] == period].copy()
    return carved, str(period)


def augment_sparse(df: pd.DataFrame, target: int, min_seed: int, cap: int) -> pd.DataFrame:
    """Oversample (with light jitter) cells that have few events, up to `target`."""
    if not _H3:
        print('[seed] h3 not available — skipping augmentation.')
        return df

    lat = pd.to_numeric(df['latitude'], errors='coerce')
    lon = pd.to_numeric(df['longitude'], errors='coerce')
    ok = lat.notna() & lon.notna()
    cells = pd.Series(index=df.index, dtype=object)
    cells[ok] = [h3.latlng_to_cell(a, b, H3_RES) for a, b in zip(lat[ok], lon[ok])]
    df = df.assign(_cell=cells)

    extra = []
    added = 0
    for cell, sub in df[df['_cell'].notna()].groupby('_cell'):
        n = len(sub)
        if n < min_seed or n >= target:
            continue
        need = min(target - n, cap - added)
        if need <= 0:
            break
        samp = sub.sample(n=need, replace=True, random_state=42).copy()
        # light spatial jitter (~10 m) so duplicated points are not identical
        samp['latitude'] = pd.to_numeric(samp['latitude'], errors='coerce') + np.random.normal(0, 1e-4, need)
        samp['longitude'] = pd.to_numeric(samp['longitude'], errors='coerce') + np.random.normal(0, 1e-4, need)
        # spread timestamps across the month so lag/rolling features stay sane
        base = _parse_dt(samp['created_datetime'])
        jitter = pd.to_timedelta(np.random.randint(-10, 11, need), unit='D')
        samp['created_datetime'] = (base + jitter).dt.strftime('%Y-%m-%d %H:%M:%S+00')
        extra.append(samp)
        added += need

    if extra:
        df = pd.concat([df, *extra], ignore_index=True)
        print(f'[seed] augmented {added:,} rows across sparse cells.')
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', default=DEFAULT_INPUT)
    ap.add_argument('--output', default=DEFAULT_OUTPUT)
    ap.add_argument('--month', default=None, help='YYYY-MM (default: most recent full month)')
    ap.add_argument('--augment', action='store_true', help='SMOTE-like oversample of sparse cells')
    ap.add_argument('--target-per-cell', type=int, default=40)
    ap.add_argument('--min-seed', type=int, default=5)
    ap.add_argument('--cap', type=int, default=20000, help='max synthetic rows to add')
    args = ap.parse_args()

    print(f'[seed] reading {args.input} ...')
    df = pd.read_csv(args.input, low_memory=False)
    print(f'[seed] {len(df):,} raw rows.')

    carved, period = carve_month(df, args.month)
    print(f'[seed] carved month {period}: {len(carved):,} rows.')

    if args.augment:
        carved = augment_sparse(carved, args.target_per_cell, args.min_seed, args.cap)

    # drop helper columns, keep the original schema intact
    carved = carved.drop(columns=[c for c in ('_dt', '_period', '_cell') if c in carved.columns])
    carved.to_csv(args.output, index=False)
    print(f'[seed] wrote {len(carved):,} rows -> {args.output}')
    print(f'[seed] distinct dates: {_parse_dt(carved["created_datetime"]).dt.date.nunique()}')


if __name__ == '__main__':
    main()
