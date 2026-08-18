import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

export async function callAnalytics(buf: Buffer, filename: string): Promise<Record<string, unknown>> {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'text/csv' }), filename);

  let res: Response;
  try {
    res = await fetch(`${env.PY_SERVICE_URL}/analytics`, { method: 'POST', body: fd });
  } catch (e: unknown) {
    throw new AppError(502, `Python service unreachable: ${(e as Error).message}`);
  }

  const json = await res.json().catch(() => ({})) as { ok?: boolean; errors?: string[]; bundle?: Record<string, unknown> };
  if (!res.ok || !json.ok) {
    const msg = json.errors?.join('; ') ?? `Python service error (${res.status})`;
    throw new AppError(502, msg);
  }
  return json.bundle as Record<string, unknown>;
}

/** Never rejects — an unreachable model service is reported, not thrown. */
export async function pyHealth(): Promise<{ ok: boolean; detail: unknown }> {
  try {
    const res = await fetch(`${env.PY_SERVICE_URL}/health`);
    const detail = await res.json().catch(() => null);
    return { ok: res.ok, detail };
  } catch (e: unknown) {
    return { ok: false, detail: (e as Error).message };
  }
}
