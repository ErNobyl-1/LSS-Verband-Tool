import { db, pool } from '../db/index.js';
import { allianceStats, type NewAllianceStat } from '../db/schema.js';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import { statsLogger as logger } from '../lib/logger.js';

interface AllianceInfoResponse {
  id: number;
  name: string;
  credits_total: number;
  credits_current: number;
  rank: number;
  finance_active: boolean;
  user_count: number;
  user_online_count: number;
  users: Array<{
    id: number;
    name: string;
    roles: string[];
    caption: string | null;
    online: boolean;
    role_flags: Record<string, boolean>;
  }>;
}

export async function saveAllianceStats(data: AllianceInfoResponse): Promise<void> {
  const stat: NewAllianceStat = {
    allianceId: data.id,
    allianceName: data.name,
    creditsTotal: data.credits_total,
    rank: data.rank,
    userCount: data.user_count,
    userOnlineCount: data.user_online_count,
  };

  await db.insert(allianceStats).values(stat);

  logger.info({
    rank: data.rank,
    credits: data.credits_total,
    usersOnline: data.user_online_count,
    usersTotal: data.user_count,
  }, 'Alliance stats saved');
}

export async function getLatestAllianceStats() {
  const result = await db
    .select()
    .from(allianceStats)
    .orderBy(desc(allianceStats.recordedAt))
    .limit(1);

  return result[0] || null;
}

export async function getStatsFromTimeAgo(allianceId: number, millisAgo: number) {
  const targetTime = new Date(Date.now() - millisAgo);

  // Get the stats entry closest to the target time
  const result = await db
    .select()
    .from(allianceStats)
    .where(
      and(
        eq(allianceStats.allianceId, allianceId),
        lte(allianceStats.recordedAt, targetTime)
      )
    )
    .orderBy(desc(allianceStats.recordedAt))
    .limit(1);

  return result[0] || null;
}

// Backwards compatibility
export async function getStatsFrom24hAgo(allianceId: number) {
  return getStatsFromTimeAgo(allianceId, 24 * 60 * 60 * 1000);
}

export async function getLatestAllianceStatsWithChanges() {
  const latest = await getLatestAllianceStats();
  if (!latest) return null;

  const stats24hAgo = await getStatsFrom24hAgo(latest.allianceId);

  return {
    ...latest,
    change24h: stats24hAgo ? {
      creditsChange: latest.creditsTotal - stats24hAgo.creditsTotal,
      rankChange: stats24hAgo.rank - latest.rank, // Positive = improved rank
    } : null,
  };
}

// Time periods in milliseconds
const TIME_PERIODS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '1mo': 30 * 24 * 60 * 60 * 1000,
  '12mo': 365 * 24 * 60 * 60 * 1000,
};

export type TimePeriod = keyof typeof TIME_PERIODS;

export interface PeriodChange {
  creditsChange: number;
  rankChange: number;
  oldCredits: number;
  oldRank: number;
  recordedAt: Date;
  isPartial: boolean; // true if the period isn't fully covered by data
  actualHours: number; // actual hours of data available
}

// Get the oldest stats record for an alliance
async function getOldestAllianceStats(allianceId: number) {
  const result = await db
    .select()
    .from(allianceStats)
    .where(eq(allianceStats.allianceId, allianceId))
    .orderBy(allianceStats.recordedAt)
    .limit(1);

  return result[0] || null;
}

export async function getLatestAllianceStatsWithAllChanges() {
  const latest = await getLatestAllianceStats();
  if (!latest) return null;

  // Fetch stats for all time periods and the oldest record in parallel
  const [stats24h, stats7d, stats1mo, stats12mo, oldest] = await Promise.all([
    getStatsFromTimeAgo(latest.allianceId, TIME_PERIODS['24h']),
    getStatsFromTimeAgo(latest.allianceId, TIME_PERIODS['7d']),
    getStatsFromTimeAgo(latest.allianceId, TIME_PERIODS['1mo']),
    getStatsFromTimeAgo(latest.allianceId, TIME_PERIODS['12mo']),
    getOldestAllianceStats(latest.allianceId),
  ]);

  const now = new Date();
  const oldestTime = oldest ? new Date(oldest.recordedAt).getTime() : now.getTime();
  const dataAgeMs = now.getTime() - oldestTime;

  const calculateChange = (
    oldStats: typeof stats24h,
    periodMs: number
  ): PeriodChange | null => {
    // If we have stats from the requested period, use them
    if (oldStats) {
      const actualMs = now.getTime() - new Date(oldStats.recordedAt).getTime();
      return {
        creditsChange: Number(latest.creditsTotal) - Number(oldStats.creditsTotal),
        rankChange: oldStats.rank - latest.rank, // Positive = improved rank
        oldCredits: Number(oldStats.creditsTotal),
        oldRank: oldStats.rank,
        recordedAt: oldStats.recordedAt,
        isPartial: actualMs < periodMs * 0.9, // Consider partial if less than 90% of period
        actualHours: Math.round(actualMs / (60 * 60 * 1000)),
      };
    }

    // If no stats from that period but we have older data, use the oldest available
    if (oldest && dataAgeMs > 0) {
      return {
        creditsChange: Number(latest.creditsTotal) - Number(oldest.creditsTotal),
        rankChange: oldest.rank - latest.rank,
        oldCredits: Number(oldest.creditsTotal),
        oldRank: oldest.rank,
        recordedAt: oldest.recordedAt,
        isPartial: true,
        actualHours: Math.round(dataAgeMs / (60 * 60 * 1000)),
      };
    }

    return null;
  };

  return {
    ...latest,
    creditsTotal: Number(latest.creditsTotal),
    changes: {
      '24h': calculateChange(stats24h, TIME_PERIODS['24h']),
      '7d': calculateChange(stats7d, TIME_PERIODS['7d']),
      '1mo': calculateChange(stats1mo, TIME_PERIODS['1mo']),
      '12mo': calculateChange(stats12mo, TIME_PERIODS['12mo']),
    },
  };
}

export async function getAllianceStatsHistory(
  allianceId: number,
  options?: {
    from?: Date;
    to?: Date;
    limit?: number;
  }
) {
  const conditions = [eq(allianceStats.allianceId, allianceId)];

  if (options?.from) {
    conditions.push(gte(allianceStats.recordedAt, options.from));
  }
  if (options?.to) {
    conditions.push(lte(allianceStats.recordedAt, options.to));
  }

  let query = db
    .select()
    .from(allianceStats)
    .where(and(...conditions))
    .orderBy(desc(allianceStats.recordedAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  return await query;
}

// Get aggregated stats for charts (hourly, daily, etc.)
// Uses PostgreSQL date_trunc to aggregate data points per period
export async function getAggregatedStats(
  allianceId: number,
  period: 'hour' | 'day' | 'week' | 'month' = 'day',
  limit = 30
) {
  // Calculate the time range based on period and limit
  const now = new Date();
  let fromDate: Date;

  switch (period) {
    case 'hour':
      fromDate = new Date(now.getTime() - limit * 60 * 60 * 1000);
      break;
    case 'day':
      fromDate = new Date(now.getTime() - limit * 24 * 60 * 60 * 1000);
      break;
    case 'week':
      fromDate = new Date(now.getTime() - limit * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      fromDate = new Date(now.getTime() - limit * 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // First, count total records in time range for debugging
  const countQuery = `
    SELECT COUNT(*) as total,
           MIN(recorded_at) as oldest,
           MAX(recorded_at) as newest
    FROM alliance_stats
    WHERE alliance_id = $1
      AND recorded_at >= $2
  `;
  const countResult = await pool.query(countQuery, [allianceId, fromDate]);
  const { total, oldest, newest } = countResult.rows[0];

  logger.info({
    period,
    limit,
    allianceId,
    fromDate: fromDate.toISOString(),
    now: now.toISOString(),
    totalRecordsInRange: parseInt(total, 10),
    oldestRecord: oldest,
    newestRecord: newest,
  }, 'getAggregatedStats query params');

  // Use a window function approach to get one data point per period
  // This is more reliable than DISTINCT ON in edge cases
  // ROW_NUMBER() assigns 1 to the most recent entry within each truncated period
  const query = `
    WITH ranked AS (
      SELECT
        id,
        alliance_id as "allianceId",
        alliance_name as "allianceName",
        credits_total as "creditsTotal",
        rank,
        user_count as "userCount",
        user_online_count as "userOnlineCount",
        recorded_at as "recordedAt",
        date_trunc($1, recorded_at) as period_start,
        ROW_NUMBER() OVER (
          PARTITION BY date_trunc($1, recorded_at)
          ORDER BY recorded_at DESC
        ) as rn
      FROM alliance_stats
      WHERE alliance_id = $2
        AND recorded_at >= $3
    )
    SELECT
      id,
      "allianceId",
      "allianceName",
      "creditsTotal",
      rank,
      "userCount",
      "userOnlineCount",
      "recordedAt",
      period_start
    FROM ranked
    WHERE rn = 1
    ORDER BY period_start DESC
    LIMIT $4
  `;

  const result = await pool.query(query, [period, allianceId, fromDate, limit]);

  logger.info({
    period,
    aggregatedCount: result.rows.length,
    periodStarts: result.rows.map(r => r.period_start),
    timestamps: result.rows.map(r => r.recordedAt),
  }, 'getAggregatedStats result');

  // Convert BigInt creditsTotal to Number and ensure proper date formatting
  // Exclude period_start from response as it's only used internally
  return result.rows.map(row => ({
    id: row.id,
    allianceId: row.allianceId,
    allianceName: row.allianceName,
    creditsTotal: Number(row.creditsTotal),
    rank: row.rank,
    userCount: row.userCount,
    userOnlineCount: row.userOnlineCount,
    recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : row.recordedAt,
  }));
}
