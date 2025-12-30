import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import apiRoutes from './routes/api.js';
import { lssScraper } from './services/lss-scraper.js';
import { runMigrations } from './db/migrate.js';
import { initializeMissionTypes } from './services/mission-types.js';
import { authMiddleware } from './middleware/auth.js';
import { ensureAdminExists, cleanupExpiredSessions } from './services/auth.js';
import { runDataRetention } from './services/data-retention.js';
import { logger } from './lib/logger.js';
import { emailService, notifyError } from './lib/email.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: corsOrigin !== '*',
}));
app.use(express.json());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 500, // max 500 Requests pro 15 Min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // max 10 Login-Versuche pro 15 Min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Login-Versuche, bitte später erneut versuchen.' },
  skipSuccessfulRequests: true, // Erfolgreiche Logins nicht zählen
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // HSTS wird vom Reverse Proxy (nginx) gesetzt
  next();
});

// Request logging with pino-http
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/api/stream',
  },
}));

// Authentication middleware (checks token for all /api routes except health)
app.use('/api', authMiddleware);

// Routes
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
      missionCredits: '/api/mission-credits',
    },
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  // Send email notification for critical errors
  notifyError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

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

    // Ensure admin account exists
    await ensureAdminExists();

    // Initialize mission types cache
    await initializeMissionTypes();

    // Verify email service if configured
    if (emailService.isEnabled()) {
      const isEmailWorking = await emailService.verifyConnection();
      if (isEmailWorking) {
        logger.info('Email service verified and ready');
      } else {
        logger.warn('Email service configured but connection verification failed');
      }
    }

    app.listen(Number(PORT), HOST, () => {
      logger.info({ host: HOST, port: PORT }, 'LSS Verband Tool API started');
      logger.info({ url: `http://${HOST}:${PORT}/api/stream` }, 'SSE stream available');

      // Session cleanup - einmal beim Start und dann stündlich
      const runSessionCleanup = async () => {
        try {
          const deleted = await cleanupExpiredSessions();
          if (deleted > 0) {
            logger.info({ deleted }, 'Expired sessions cleaned up');
          }
        } catch (err) {
          logger.error({ err }, 'Session cleanup failed');
          notifyError(err as Error, { component: 'Session Cleanup' });
        }
      };
      runSessionCleanup(); // Beim Start
      setInterval(runSessionCleanup, 60 * 60 * 1000); // Stündlich

      // Data retention - einmal beim Start und dann täglich um 4:00 Uhr
      const scheduleDataRetention = () => {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(4, 0, 0, 0); // 4:00 Uhr
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1); // Morgen 4:00 Uhr
        }
        const msUntilNextRun = nextRun.getTime() - now.getTime();

        setTimeout(async () => {
          try {
            await runDataRetention();
          } catch (err) {
            logger.error({ err }, 'Data retention failed');
            notifyError(err as Error, { component: 'Data Retention', schedule: 'initial' });
          }
          // Nach erstem Lauf: täglich wiederholen
          setInterval(async () => {
            try {
              await runDataRetention();
            } catch (err) {
              logger.error({ err }, 'Data retention failed');
              notifyError(err as Error, { component: 'Data Retention', schedule: 'daily' });
            }
          }, 24 * 60 * 60 * 1000); // Alle 24 Stunden
        }, msUntilNextRun);

        logger.info({ nextRun: nextRun.toISOString() }, 'Data retention scheduled');
      };
      scheduleDataRetention();

      // Start the LSS scraper if credentials are configured
      if (process.env.LSS_EMAIL && process.env.LSS_PASSWORD) {
        logger.info('Starting LSS scraper...');
        lssScraper.start().catch((err) => {
          logger.error({ err }, 'Failed to start LSS scraper');
          notifyError(err as Error, { component: 'LSS Scraper', action: 'start' });
        });
      } else {
        logger.warn('LSS scraper not started (LSS_EMAIL/LSS_PASSWORD not configured)');
      }
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    notifyError(error as Error, { component: 'Server Startup' });
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  await lssScraper.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  await lssScraper.stop();
  process.exit(0);
});
