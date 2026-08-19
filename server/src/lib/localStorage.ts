import { mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Local disk fallback for file uploads, used when Cloudinary is not configured
 * so the server runs fully offline.
 *
 * On a serverless host the deployment bundle is read-only — only /tmp is
 * writable — so the directory must live there. Nothing is created at import
 * time: doing so crashed every invocation on Vercel with EROFS before any
 * route could run.
 */
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const UPLOADS_DIR = isServerless
  ? path.join('/tmp', 'uploads')
  : path.resolve(process.cwd(), 'uploads');

/** True when files written here survive between requests. */
export const uploadsArePersistent = !isServerless;

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
  // Created on first use, not at import — see note above.
  await mkdir(UPLOADS_DIR, { recursive: true });

  const ext = EXT_BY_MIME[mimetype] ?? 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  const base = (env.PUBLIC_URL ?? origin).replace(/\/+$/, '');
  return `${base}/uploads/${filename}`;
}
