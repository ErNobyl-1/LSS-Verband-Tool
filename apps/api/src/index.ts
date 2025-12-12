import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { lssScraper } from './services/lss-scraper.js';
import { runMigrations } from './db/migrate.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Routes (read-only API for frontend)
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'LSS Verband Tool API',
    version: '1.0.0',
    endpoints: {
      incidents: '/api/incidents',
      stream: '/api/stream',
      health: '/api/health',
      allianceStats: '/api/alliance/stats',
      allianceStatsHistory: '/api/alliance/stats/history',
      members: '/api/members',
      membersOnline: '/api/members/online',
    },
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Start server with migrations
async function startServer() {
  try {
    // Run database migrations before starting
    await runMigrations();

    app.listen(Number(PORT), HOST, () => {
      console.log(`🚀 LSS Verband Tool API running at http://${HOST}:${PORT}`);
      console.log(`📡 SSE stream available at http://${HOST}:${PORT}/api/stream`);

      // Start the LSS scraper if credentials are configured
      if (process.env.LSS_EMAIL && process.env.LSS_PASSWORD) {
        console.log(`🌐 Starting LSS scraper...`);
        lssScraper.start().catch((err) => {
          console.error('Failed to start LSS scraper:', err);
        });
      } else {
        console.log(`ℹ️  LSS scraper not started (LSS_EMAIL/LSS_PASSWORD not configured)`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await lssScraper.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await lssScraper.stop();
  process.exit(0);
});
