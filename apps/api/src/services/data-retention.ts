import { db, incidents, allianceStats, memberActivityLog } from '../db/index.js';
import { lt, and, sql, notInArray } from 'drizzle-orm';
import { retentionLogger as logger } from '../lib/logger.js';

// Default retention periods (can be overridden via environment variables)
const INCIDENTS_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_INCIDENTS_DAYS || '4', 10);
const ACTIVITY_LOG_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_ACTIVITY_DAYS || '30', 10);
const STATS_AGGREGATION_DAYS = parseInt(process.env.DATA_RETENTION_STATS_AGGREGATE_DAYS || '30', 10);

/**
 * Delete incidents older than X days
 * Incidents are short-lived (max 2 days in game), so we can safely delete after 4 days
 */
export async function cleanupOldIncidents(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INCIDENTS_RETENTION_DAYS);

  const result = await db
    .delete(incidents)
    .where(lt(incidents.lastSeenAt, cutoffDate));

  return result.rowCount ?? 0;
}

/**
 * Delete member activity logs older than X days
 * This table grows fastest and is only needed for recent activity tracking
 */
export async function cleanupOldActivityLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ACTIVITY_LOG_RETENTION_DAYS);

  const result = await db
    .delete(memberActivityLog)
    .where(lt(memberActivityLog.recordedAt, cutoffDate));

  return result.rowCount ?? 0;
}

/**
 * Aggregate alliance stats older than X days
 * Keeps only the last entry per day for historical data
 * This allows detailed stats for recent data and daily summaries for long-term trends
 */
export async function aggregateOldAllianceStats(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STATS_AGGREGATION_DAYS);

  // Find IDs to keep: the last entry for each day (for data older than cutoff)
  // Using raw SQL for the complex subquery
  const result = await db.execute(sql`
    WITH daily_last_entries AS (
      SELECT DISTINCT ON (alliance_id, DATE(recorded_at)) id
      FROM alliance_stats
      WHERE recorded_at < ${cutoffDate}
      ORDER BY alliance_id, DATE(recorded_at), recorded_at DESC
    )
    DELETE FROM alliance_stats
    WHERE recorded_at < ${cutoffDate}
    AND id NOT IN (SELECT id FROM daily_last_entries)
  `);

  return (result as any).rowCount ?? 0;
}

/**
 * Run all data retention tasks
 * Should be called daily (e.g., at 4:00 AM after backups)
 */
export async function runDataRetention(): Promise<{
  incidents: number;
  activityLogs: number;
  statsAggregated: number;
}> {
  logger.info({
    incidentsRetention: INCIDENTS_RETENTION_DAYS,
    activityRetention: ACTIVITY_LOG_RETENTION_DAYS,
    statsAggregation: STATS_AGGREGATION_DAYS,
  }, 'Starting data retention cleanup');

  const incidentsDeleted = await cleanupOldIncidents();
  const activityLogsDeleted = await cleanupOldActivityLogs();
  const statsAggregated = await aggregateOldAllianceStats();

  logger.info({
    incidentsDeleted,
    activityLogsDeleted,
    statsAggregated,
  }, 'Data retention completed');

  return {
    incidents: incidentsDeleted,
    activityLogs: activityLogsDeleted,
    statsAggregated: statsAggregated,
  };
}
