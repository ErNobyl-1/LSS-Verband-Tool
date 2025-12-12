import { IncidentsResponse, SSEIncidentMessage, SSEAllianceStatsMessage, SSEMembersMessage, AllianceStatsResponse, AllianceStatsHistoryResponse, MembersResponse, MissionCreditsResponse } from './types';
import { getAuthToken, getAuthHeaders } from './hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchIncidents(): Promise<IncidentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', '500');

  const response = await fetch(`${API_URL}/api/incidents?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

interface SSECallbacks {
  onIncident?: (data: SSEIncidentMessage) => void;
  onAllianceStats?: (data: SSEAllianceStatsMessage) => void;
  onMembers?: (data: SSEMembersMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
}

export function createSSEConnection(callbacks: SSECallbacks): EventSource {
  // SSE doesn't support custom headers, so we pass token as query parameter
  const token = getAuthToken();
  const url = token
    ? `${API_URL}/api/stream?token=${encodeURIComponent(token)}`
    : `${API_URL}/api/stream`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('connected', () => {
    console.log('[SSE] Connected to stream');
    callbacks.onConnect?.();
  });

  eventSource.addEventListener('incident', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEIncidentMessage;
      console.log('[SSE] Incident event:', data.type);
      callbacks.onIncident?.(data);
    } catch (e) {
      console.error('[SSE] Failed to parse incident event:', e);
    }
  });

  eventSource.addEventListener('batch', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEIncidentMessage;
      console.log('[SSE] Batch event:', data.type, 'count:', data.incidents?.length);
      callbacks.onIncident?.(data);
    } catch (e) {
      console.error('[SSE] Failed to parse batch event:', e);
    }
  });

  eventSource.addEventListener('deleted', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEIncidentMessage;
      console.log('[SSE] Deleted event:', data.deletedIds?.length, 'incidents removed');
      callbacks.onIncident?.(data);
    } catch (e) {
      console.error('[SSE] Failed to parse deleted event:', e);
    }
  });

  eventSource.addEventListener('alliance_stats', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEAllianceStatsMessage;
      console.log('[SSE] Alliance stats event');
      callbacks.onAllianceStats?.(data);
    } catch (e) {
      console.error('[SSE] Failed to parse alliance stats event:', e);
    }
  });

  eventSource.addEventListener('members', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEMembersMessage;
      console.log('[SSE] Members event:', data.counts.online, '/', data.counts.total, 'online');
      callbacks.onMembers?.(data);
    } catch (e) {
      console.error('[SSE] Failed to parse members event:', e);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    // Heartbeat received - connection is alive
  });

  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error);
    callbacks.onError?.(error);
  };

  return eventSource;
}

export async function fetchAllianceStats(): Promise<AllianceStatsResponse> {
  const response = await fetch(`${API_URL}/api/alliance/stats`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function fetchAllianceStatsHistory(
  period: 'hour' | 'day' | 'week' | 'month' = 'day',
  limit = 30
): Promise<AllianceStatsHistoryResponse> {
  const params = new URLSearchParams({
    period,
    limit: limit.toString(),
  });

  const response = await fetch(`${API_URL}/api/alliance/stats/history?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function fetchMembers(onlineOnly = false): Promise<MembersResponse> {
  const params = onlineOnly ? '?online_only=true' : '';
  const response = await fetch(`${API_URL}/api/members${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function fetchMissionCredits(): Promise<MissionCreditsResponse> {
  const response = await fetch(`${API_URL}/api/mission-credits`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export interface PlayerNamesResponse {
  success: boolean;
  data: Record<string, string>; // lssName -> displayName
}

export async function fetchPlayerNames(): Promise<PlayerNamesResponse> {
  const response = await fetch(`${API_URL}/api/player-names`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
