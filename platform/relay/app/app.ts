import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { isHttpAccessLoggingEnabled } from './http-access-log.js';
import { httpBodyLogger, isHttpBodyLoggingEnabled } from './http-body-log.js';
import { v1 } from './routes/v1/index.js';

const app = new Hono({ strict: false });

const relayAppDir = dirname(fileURLToPath(import.meta.url));
const assetsRoot = join(relayAppDir, '..', 'public', 'assets');

// Plugin assets (e.g. service logos) are mirrored at build time and rarely change,
// so we instruct browsers and shared caches/CDNs to hold onto them for 7 days.
const ASSETS_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ASSETS_CACHE_CONTROL = `public, max-age=${ASSETS_CACHE_MAX_AGE_SECONDS}, s-maxage=${ASSETS_CACHE_MAX_AGE_SECONDS}`;

app.use('/api/assets/*', async (c, next) => {
  await next();
  // Only attach the cache header to successful asset responses; if the file
  // isn't found, serveStatic falls through to the 404 handler and we leave
  // those responses uncached.
  if (c.res.status === 200 || c.res.status === 206) {
    c.res.headers.set('Cache-Control', ASSETS_CACHE_CONTROL);
  }
});

app.use(
  '/api/assets/*',
  serveStatic({
    root: assetsRoot,
    rewriteRequestPath: (path) => path.replace(/^\/api\/assets\/?/, '').replace(/^\//, '') || '.',
  }),
);

if (isHttpAccessLoggingEnabled()) {
  app.use(logger());
}
if (isHttpBodyLoggingEnabled()) {
  app.use(httpBodyLogger);
}

app.get('/', (c) => c.redirect('/api/v1', 302));

app.route('/api/v1', v1);

export { app };
