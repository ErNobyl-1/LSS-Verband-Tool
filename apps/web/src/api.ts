import { IncidentsResponse, SSEMessage, AllianceStatsResponse, AllianceStatsHistoryResponse, MembersResponse, MissionCreditsResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchIncidents(): Promise<IncidentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', '500');

  const response = await fetch(`${API_URL}/api/incidents?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export function createSSEConnection(
  onMessage: (data: SSEMessage) => void,
  onError: (error: Event) => void,
  onConnect: () => void
): EventSource {
  const eventSource = new EventSource(`${API_URL}/api/stream`);

  eventSource.addEventListener('connected', () => {
    console.log('[SSE] Connected to stream');
    onConnect();
  });

  eventSource.addEventListener('incident', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEMessage;
      console.log('[SSE] Incident event:', data.type);
      onMessage(data);
    } catch (e) {
      console.error('[SSE] Failed to parse incident event:', e);
    }
  });

  eventSource.addEventListener('batch', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEMessage;
      console.log('[SSE] Batch event:', data.type, 'count:', data.incidents?.length);
      onMessage(data);
    } catch (e) {
      console.error('[SSE] Failed to parse batch event:', e);
    }
  });

  eventSource.addEventListener('deleted', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEMessage;
      console.log('[SSE] Deleted event:', data.deletedIds?.length, 'incidents removed');
      onMessage(data);
    } catch (e) {
      console.error('[SSE] Failed to parse deleted event:', e);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    // Heartbeat received - connection is alive
  });

  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error);
    onError(error);
  };

  return eventSource;
}

export async function fetchAllianceStats(): Promise<AllianceStatsResponse> {
  const response = await fetch(`${API_URL}/api/alliance/stats`);

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

  const response = await fetch(`${API_URL}/api/alliance/stats/history?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function fetchMembers(onlineOnly = false): Promise<MembersResponse> {
  const params = onlineOnly ? '?online_only=true' : '';
  const response = await fetch(`${API_URL}/api/members${params}`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function fetchMissionCredits(): Promise<MissionCreditsResponse> {
  const response = await fetch(`${API_URL}/api/mission-credits`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
