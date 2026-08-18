"""
make_stations.py — Derive a police-station master (name + centroid lat/lon)
from the historical violations CSV, for seeding the Station table.

Output: ../server/prisma/stations_seed.json  ->  [{ "name", "latitude", "longitude" }]
"""
import json
import os
import pandas as pd

RAW = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'jan to may police violation_anonymized791b166.csv')
)
OUT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'server', 'prisma', 'stations_seed.json')
)
# Coverage bbox sanity filter (same as features_v6)
BBOX = (12.7, 13.2, 77.3, 77.9)


def main():
    df = pd.read_csv(RAW, usecols=['latitude', 'longitude', 'police_station'], low_memory=False)
    df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    df = df.dropna(subset=['latitude', 'longitude', 'police_station'])
    df = df[(df.latitude.between(BBOX[0], BBOX[1])) & (df.longitude.between(BBOX[2], BBOX[3]))]
    df['police_station'] = df['police_station'].astype(str).str.strip()
    df = df[df['police_station'] != '']

    grp = df.groupby('police_station').agg(
        latitude=('latitude', 'median'),
        longitude=('longitude', 'median'),
        n=('latitude', 'size'),
    ).reset_index()
    grp = grp[grp['n'] >= 20].sort_values('n', ascending=False)  # drop noise stations

    stations = [
        {'name': r['police_station'], 'latitude': round(float(r['latitude']), 6), 'longitude': round(float(r['longitude']), 6)}
        for _, r in grp.iterrows()
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(stations, f, indent=2)
    print(f'[stations] wrote {len(stations)} stations -> {OUT}')


if __name__ == '__main__':
    main()
