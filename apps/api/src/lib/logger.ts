import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logger with appropriate transport
export const logger = pino({
  level: logLevel,
  // In development, use pino-pretty for readable output
  // In production, output JSON for log aggregation
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Base fields added to every log
  base: {
    service: 'lss-api',
  },
  // Custom timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for different modules
export const createLogger = (module: string) => logger.child({ module });

// Pre-configured child loggers for common modules
export const scraperLogger = createLogger('scraper');
export const authLogger = createLogger('auth');
export const dbLogger = createLogger('db');
export const apiLogger = createLogger('api');
export const retentionLogger = createLogger('retention');
export const statsLogger = createLogger('stats');
