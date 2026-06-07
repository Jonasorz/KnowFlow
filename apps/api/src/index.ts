import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { ApiResponse } from '@knowflow/shared';
import { sourcesRoutes } from './routes/sources.js';
import { articlesRoutes } from './routes/articles.js';
import { aiRoutes } from './routes/ai.js';
import { settingsRoutes } from './routes/settings.js';
import { initializeDatabase } from './services/db.js';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

// Configure global proxy dispatcher if environment variables are set
const proxyUrl = process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY;
if (proxyUrl) {
  console.log(`[Proxy] Detected proxy environment variable: ${proxyUrl}. Configuring global dispatcher.`);
  try {
    const dispatcher = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(dispatcher);
  } catch (err) {
    console.error('[Proxy] Failed to configure global ProxyAgent:', err);
  }
}

const app = new Hono();

// ============================================================
// Middleware
// ============================================================
app.use('*', logger());

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

// ============================================================
// Global error handler
// ============================================================
app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  const status = 'status' in err ? (err as { status: number }).status : 500;
  const response: ApiResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
  };

  return c.json(response, status as 400 | 500);
});

// ============================================================
// 404 handler
// ============================================================
app.notFound((c) => {
  const response: ApiResponse = {
    success: false,
    error: `Not Found: ${c.req.method} ${c.req.path}`,
  };
  return c.json(response, 404);
});

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================
// Routes
// ============================================================
app.route('/api/sources', sourcesRoutes);
app.route('/api/articles', articlesRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/settings', settingsRoutes);

// ============================================================
// Start server
// ============================================================
const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Initialize database (creates tables if they don't exist)
  await initializeDatabase();

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(`🚀 KnowFlow API server running at http://localhost:${info.port}`);
    }
  );
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
