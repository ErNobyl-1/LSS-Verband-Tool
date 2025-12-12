import { db } from '../db/index.js';
import { allianceStats, type NewAllianceStat } from '../db/schema.js';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

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

  console.log(
    `[Alliance-Stats] Saved: Rank #${data.rank}, Credits: ${data.credits_total.toLocaleString('de-DE')}, ` +
    `Users: ${data.user_online_count}/${data.user_count} online`
  );
}

export async function getLatestAllianceStats() {
  const result = await db
    .select()
    .from(allianceStats)
    .orderBy(desc(allianceStats.recordedAt))
    .limit(1);

  return result[0] || null;
}

export async function getStatsFrom24hAgo(allianceId: number) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get the stats entry closest to 24h ago
  const result = await db
    .select()
    .from(allianceStats)
    .where(
      and(
        eq(allianceStats.allianceId, allianceId),
        lte(allianceStats.recordedAt, twentyFourHoursAgo)
      )
    )
    .orderBy(desc(allianceStats.recordedAt))
    .limit(1);

  return result[0] || null;
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
export async function getAggregatedStats(
  allianceId: number,
  period: 'hour' | 'day' | 'week' | 'month' = 'day',
  limit = 30
) {
  // For now, return raw data - can add SQL aggregation later
  const now = new Date();
  let from: Date;

  switch (period) {
    case 'hour':
      from = new Date(now.getTime() - limit * 60 * 60 * 1000);
      break;
    case 'day':
      from = new Date(now.getTime() - limit * 24 * 60 * 60 * 1000);
      break;
    case 'week':
      from = new Date(now.getTime() - limit * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      from = new Date(now.getTime() - limit * 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return await getAllianceStatsHistory(allianceId, { from });
}
