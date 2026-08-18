import fs from 'fs';
import { parse } from 'csv-parse';
import { cellToLatLng } from 'h3-js';

export interface CsvRow {
  h3_index: string;
  predicted_violations: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  latitude: number;
  longitude: number;
}

const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  low: 'low',
  Low: 'low',
  medium: 'medium',
  Medium: 'medium',
  high: 'high',
  High: 'high',
  critical: 'critical',
  Critical: 'critical',
};

export function parsePredictionCsv(csvPath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];

    fs.createReadStream(csvPath)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
      .on('data', (record: Record<string, string>) => {
        const h3Index = record.cell ?? record.h3_index;
        if (!h3Index) return;

        let lat: number, lng: number;
        try {
          [lat, lng] = cellToLatLng(h3Index);
        } catch {
          console.warn(`[CSV] Invalid H3 index skipped: ${h3Index}`);
          return;
        }

        const rawSeverity = record.severity ?? record.risk_level ?? 'low';
        rows.push({
          h3_index: h3Index,
          predicted_violations:
            record.pred != null && record.pred !== ''
              ? Math.round(parseFloat(record.pred))
              : null,
          risk_level: severityMap[rawSeverity] ?? 'low',
          latitude: lat,
          longitude: lng,
        });
      })
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}
