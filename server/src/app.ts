import express from 'express';
import cors from 'cors';
// helmet 8's package "exports" has no "types" condition, so some TS/resolver
// combos (e.g. the Vercel build) type the default as a non-callable namespace.
// Resolve the callable defensively so the build is environment-proof.
import * as helmetModule from 'helmet';
import morgan from 'morgan';
import { cloudinaryConfigured, env } from './config/env.js';

const helmet = ((helmetModule as { default?: unknown }).default ?? helmetModule) as (
  ...args: unknown[]
) => express.RequestHandler;
import { errorHandler } from './middleware/error.js';
import { UPLOADS_DIR } from './lib/localStorage.js';
import { pyHealth } from './lib/pyClient.js';
import { verifyEmailTransport } from './utils/email.js';
import authRouter from './modules/auth/router.js';
import registrationRequestsRouter from './modules/registrationRequests/router.js';
import usersRouter from './modules/users/router.js';
import predictionRunsRouter from './modules/predictionRuns/router.js';
import predictionCellsRouter from './modules/predictionCells/router.js';
import assignmentsRouter from './modules/assignments/router.js';
import notificationsRouter from './modules/notifications/router.js';
import fieldValidationsRouter from './modules/fieldValidations/router.js';
import modelFeedbackBatchesRouter from './modules/modelFeedbackBatches/router.js';
import uploadsRouter from './modules/uploads/router.js';
import csvUploadRouter from './modules/csvUpload/router.js';
import analyticsRouter from './modules/analytics/router.js';
import stationsRouter from './modules/stations/router.js';
import locationRouter from './modules/location/router.js';
import unassignRequestsRouter from './modules/unassignRequests/router.js';
import jobsRouter from './modules/jobs/router.js';

const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // Any local origin (any port) so the Vite dev server, Expo web and
    // LAN devices work without env churn.
    if (LOCAL_HOSTS.has(host)) return true;
    // In development, trust any bare IPv4 origin. Not every ISP hands out an
    // RFC1918 address (this machine gets a 180.x LAN IP), so a private-range
    // allowlist silently blocked Expo Web on the LAN.
    if (env.NODE_ENV !== 'production' && /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
    // Private LAN ranges — an Expo build on a phone hits the server by IP.
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    // Allow any Vercel deployment (prod + preview URLs) without env churn.
    if (host.endsWith('.vercel.app')) return true;
  } catch { /* malformed origin */ }
  return false;
}

const corsMiddleware = cors({
  origin(origin, cb) {
    // Non-browser clients (curl, server-to-server) send no Origin.
    if (!origin || isAllowedOrigin(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
});

// crossOriginResourcePolicy must be relaxed so locally stored upload images
// can be embedded by the client, which runs on a different port.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(corsMiddleware); // also answers OPTIONS preflight automatically
app.use(morgan('dev'));
// Default 25mb (Express default is 100kb) to fit the analytics bundle posted to
// /api/csv/store. Lower JSON_BODY_LIMIT to 4mb behind a serverless host.
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

// Locally stored officer photos (used when Cloudinary is not configured).
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));

// ?deep=1 also probes the Python model service — handy when bringing the stack
// up locally.
app.get('/api/health', async (req, res) => {
  if (req.query.deep !== '1') return res.json({ status: 'ok' });

  // Probes the integrations so a misconfigured deployment is diagnosable from
  // outside. Reports which backends are active — never their credentials.
  const [model, mail] = await Promise.all([pyHealth(), verifyEmailTransport()]);

  res.json({
    status: 'ok',
    model_service: { url: env.PY_SERVICE_URL, ...model },
    email: {
      // 'stub' silently discards mail — the most common cause of "approved but
      // no email arrived" on a fresh deployment.
      mode: env.EMAIL_MODE,
      host: env.EMAIL_MODE === 'smtp' ? `${env.SMTP_HOST}:${env.SMTP_PORT ?? 587}` : null,
      from: env.EMAIL_MODE === 'smtp' ? env.SMTP_FROM ?? null : null,
      verified: mail.ok,
      error: mail.error ?? null,
    },
    uploads: cloudinaryConfigured ? 'cloudinary' : 'local-disk',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/registration-requests', registrationRequestsRouter);
app.use('/api/users', usersRouter);
app.use('/api/prediction-runs', predictionRunsRouter);
app.use('/api/prediction-cells', predictionCellsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/field-validations', fieldValidationsRouter);
app.use('/api/model-feedback-batches', modelFeedbackBatchesRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/csv', csvUploadRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/location', locationRouter);
app.use('/api/unassign-requests', unassignRequestsRouter);
app.use('/api/jobs', jobsRouter);
// Mounted last: this router owns the remaining flat /api/* analytics paths
// (/dashboard, /timeseries, /hotspots, /stations, …). Anything matched by a
// router above never reaches it.
app.use('/api', analyticsRouter);

// JSON 404 so unknown API paths never return Express' HTML error page — the
// client treats a non-JSON body as a silent success otherwise.
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

export default app;
