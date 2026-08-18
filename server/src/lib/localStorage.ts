import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Local disk fallback for file uploads, used when Cloudinary is not configured
 * so the server runs fully offline. Files land in <repo>/server/uploads and are
 * served by the express.static mount at /uploads.
 */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** Writes the buffer to disk and returns an absolute, browser-reachable URL. */
export async function saveToDisk(
  buffer: Buffer,
  mimetype: string,
  origin: string,
): Promise<string> {
  const ext = EXT_BY_MIME[mimetype] ?? 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  const base = (env.PUBLIC_URL ?? origin).replace(/\/+$/, '');
  return `${base}/uploads/${filename}`;
}
