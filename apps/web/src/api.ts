import { IncidentsResponse, FilterState, SSEMessage } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchIncidents(filters: FilterState): Promise<IncidentsResponse> {
  const params = new URLSearchParams();

  if (filters.category !== 'all') {
    params.set('category', filters.category);
  }

  if (filters.status !== 'all') {
    params.set('status', filters.status);
  }

  if (filters.search) {
    params.set('q', filters.search);
  }

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

  eventSource.addEventListener('heartbeat', () => {
    // Heartbeat received - connection is alive
  });

  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error);
    onError(error);
  };

  return eventSource;
}
