export interface Incident {
  id: number;
  lsId: string;
  title: string;
  type: string | null;
  status: string | null;
  source: 'alliance' | 'alliance_event' | 'own' | 'own_shared' | 'unknown';
  category: 'emergency' | 'planned' | 'event';
  lat: number | null;
  lon: number | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  rawJson: Record<string, unknown> | null;
  // Mission details fields (updated separately from mission list)
  playersAtMission: string[] | null;
  playersDriving: string[] | null;
  remainingSeconds: number | null;
  durationSeconds: number | null;
  remainingAt: string | null;
  exactEarnings: number | null; // Exact credits for planned missions only
}

export interface IncidentsResponse {
  success: boolean;
  data: Incident[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SSEIncidentMessage {
  type: 'created' | 'updated' | 'batch_upsert' | 'deleted';
  incident?: Incident;
  incidents?: Incident[];
  deletedIds?: string[];
  timestamp: string;
}

export interface SSEAllianceStatsMessage {
  type: 'alliance_stats';
  stats: AllianceStats;
  timestamp: string;
}

export interface SSEMembersMessage {
  type: 'members';
  members: AllianceMember[];
  counts: { total: number; online: number };
  timestamp: string;
}

export type SSEMessage = SSEIncidentMessage | SSEAllianceStatsMessage | SSEMembersMessage;

export type CategoryFilter = 'all' | 'emergency' | 'planned' | 'event';
export type StatusFilter = 'all' | 'red' | 'yellow' | 'green';

export interface FilterState {
  category: CategoryFilter;
  status: StatusFilter;
  search: string;
}

export interface AllianceStats {
  id: number;
  allianceId: number;
  allianceName: string;
  creditsTotal: number;
  rank: number;
  userCount: number | null;
  userOnlineCount: number | null;
  recordedAt: string;
  change24h: {
    creditsChange: number;
    rankChange: number; // Positive = improved rank
  } | null;
}

export interface AllianceStatsResponse {
  success: boolean;
  data: AllianceStats | null;
  message?: string;
}

export interface PeriodChange {
  creditsChange: number;
  rankChange: number;
  oldCredits: number;
  oldRank: number;
  recordedAt: string;
  isPartial: boolean;
  actualHours: number;
}

export interface AllianceStatsFull {
  id: number;
  allianceId: number;
  allianceName: string;
  creditsTotal: number;
  rank: number;
  userCount: number | null;
  userOnlineCount: number | null;
  recordedAt: string;
  changes: {
    '24h': PeriodChange | null;
    '7d': PeriodChange | null;
    '1mo': PeriodChange | null;
    '12mo': PeriodChange | null;
  };
}

export interface AllianceStatsFullResponse {
  success: boolean;
  data: AllianceStatsFull | null;
  message?: string;
}

export interface AllianceStatsHistoryResponse {
  success: boolean;
  data: AllianceStats[];
  meta: {
    allianceId: number;
    period?: string;
    count: number;
  };
}

export interface AllianceMember {
  id: number;
  lssMemberId: number;
  allianceId: number;
  name: string;
  displayName: string | null;
  roles: string[];
  caption: string | null;
  isOnline: boolean;
  roleFlags: Record<string, boolean>;
  firstSeenAt: string;
  lastSeenAt: string;
  lastOnlineAt: string | null;
}

export interface MembersResponse {
  success: boolean;
  data: AllianceMember[];
  meta: {
    total: number;
    online: number;
  };
}

export interface MissionCreditsResponse {
  success: boolean;
  data: Record<string, number>; // mission_type_id -> average_credits
  meta: {
    count: number;
    lastUpdate: string | null;
  };
}
