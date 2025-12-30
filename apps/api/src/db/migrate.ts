import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';
import { dbLogger as logger } from '../lib/logger.js';

const { Pool } = pg;

export async function runMigrations(existingPool?: pg.Pool): Promise<void> {
  logger.info('Starting database migrations...');

  const pool = existingPool || new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    // Run Drizzle migrations from ./drizzle folder
    await migrate(db, { migrationsFolder: './drizzle' });
    logger.info('Database migrations completed successfully!');
  } catch (error) {
    logger.error({ err: error }, 'Migration failed');
    throw error;
  }

  // Only close pool if we created it
  if (!existingPool) {
    await pool.end();
  }
}

// Run migrations directly if this file is executed
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
