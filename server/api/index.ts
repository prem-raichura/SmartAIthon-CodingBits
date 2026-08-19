/**
 * Vercel serverless entry. @vercel/node serves an exported Express app directly,
 * so no serverless-http wrapper is needed (that is AWS Lambda style).
 *
 * The app is imported lazily inside the handler rather than at module scope.
 * A throw during module initialisation — a missing env var, a read-only
 * filesystem, a Prisma client that was not bundled — otherwise surfaces only as
 * the platform's opaque FUNCTION_INVOCATION_FAILED, with the real cause visible
 * nowhere but the runtime log. Catching it here returns the actual message.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type ExpressLike = (req: IncomingMessage, res: ServerResponse) => void;

let cachedApp: ExpressLike | null = null;

async function loadApp(): Promise<ExpressLike> {
  if (cachedApp) return cachedApp;
  const mod = await import('../src/app.js');
  cachedApp = mod.default as unknown as ExpressLike;
  return cachedApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await loadApp();
    return app(req, res);
  } catch (err) {
    const e = err as Error;
    console.error('[boot] server failed to initialise:', e);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify(
        {
          error: 'Server failed to start',
          message: e?.message ?? String(err),
          // First frames only — enough to identify the module that threw.
          stack: e?.stack?.split('\n').slice(0, 6),
        },
        null,
        2,
      ),
    );
  }
}
