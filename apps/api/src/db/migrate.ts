import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { dbLogger as logger } from '../lib/logger.js';

const { Pool } = pg;

export async function runMigrations(existingPool?: pg.Pool): Promise<void> {
  logger.info('Starting database migrations...');

  const pool = existingPool || new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  // ============================================
  // INCIDENTS TABLE
  // ============================================
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

  // Incidents indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_source_idx ON incidents(source)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents(category)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS incidents_last_seen_at_idx ON incidents(last_seen_at)`);

  // ============================================
  // ALLIANCE STATS TABLE
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS alliance_stats (
      id SERIAL PRIMARY KEY,
      alliance_id INTEGER NOT NULL,
      alliance_name VARCHAR(255) NOT NULL,
      credits_total BIGINT NOT NULL,
      rank INTEGER NOT NULL,
      user_count INTEGER,
      user_online_count INTEGER,
      recorded_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Alliance stats indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alliance_stats_alliance_id_idx ON alliance_stats(alliance_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alliance_stats_recorded_at_idx ON alliance_stats(recorded_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alliance_stats_alliance_time_idx ON alliance_stats(alliance_id, recorded_at)`);

  // ============================================
  // ALLIANCE MEMBERS TABLE
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS alliance_members (
      id SERIAL PRIMARY KEY,
      lss_member_id INTEGER NOT NULL UNIQUE,
      alliance_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      roles JSONB DEFAULT '[]',
      caption VARCHAR(255),
      is_online BOOLEAN DEFAULT FALSE,
      role_flags JSONB DEFAULT '{}',
      first_seen_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_seen_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_online_at TIMESTAMP
    )
  `);

  // Alliance members indexes
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS alliance_members_lss_member_id_idx ON alliance_members(lss_member_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alliance_members_alliance_id_idx ON alliance_members(alliance_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alliance_members_is_online_idx ON alliance_members(is_online)`);

  // ============================================
  // MEMBER ACTIVITY LOG TABLE
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS member_activity_log (
      id SERIAL PRIMARY KEY,
      lss_member_id INTEGER NOT NULL,
      is_online BOOLEAN NOT NULL,
      recorded_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Member activity log indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS member_activity_log_lss_member_id_idx ON member_activity_log(lss_member_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS member_activity_log_recorded_at_idx ON member_activity_log(recorded_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS member_activity_log_member_time_idx ON member_activity_log(lss_member_id, recorded_at)`);

  // ============================================
  // MISSION TYPES TABLE (cached from LSS API)
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mission_types (
      id SERIAL PRIMARY KEY,
      mission_type_id VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(500) NOT NULL,
      average_credits INTEGER NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Mission types index
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS mission_types_mission_type_id_idx ON mission_types(mission_type_id)`);

  // ============================================
  // USERS TABLE (for authentication)
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      lss_name VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      alliance_member_id INTEGER,
      is_active BOOLEAN DEFAULT FALSE NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_login_at TIMESTAMP
    )
  `);

  // Users indexes
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_lss_name_idx ON users(lss_name)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS users_is_active_idx ON users(is_active)`);

  // Add badge_color column if it doesn't exist (for existing databases)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='badge_color') THEN
        ALTER TABLE users ADD COLUMN badge_color VARCHAR(7);
      END IF;
    END $$;
  `);

  // ============================================
  // SESSIONS TABLE (for authentication)
  // ============================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Sessions indexes
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)`);

  logger.info('Database migrations completed successfully!');

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
