import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

const { Pool } = pg;

async function runMigrations() {
  console.log('Starting database migrations...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  // Create table directly if it doesn't exist (simpler than full migration setup)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      ls_id VARCHAR(255) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      type VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      source VARCHAR(50) NOT NULL DEFAULT 'unknown',
      category VARCHAR(50) NOT NULL DEFAULT 'emergency',
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      address TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_seen_at TIMESTAMP DEFAULT NOW() NOT NULL,
      raw_json JSONB
    )
  `);

  // Add category column if it doesn't exist (for existing databases)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='category') THEN
        ALTER TABLE incidents ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'emergency';
      END IF;
    END $$;
  `);

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_source_idx ON incidents(source)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents(category)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_last_seen_at_idx ON incidents(last_seen_at)`);

  console.log('Database migrations completed successfully!');

  await pool.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
