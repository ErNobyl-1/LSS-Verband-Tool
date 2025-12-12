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

export interface SSEMessage {
  type: 'created' | 'updated' | 'batch_upsert';
  incident?: Incident;
  incidents?: Incident[];
  timestamp: string;
}

export type CategoryFilter = 'all' | 'emergency' | 'planned' | 'event';
export type StatusFilter = 'all' | 'red' | 'yellow' | 'green';

export interface FilterState {
  category: CategoryFilter;
  status: StatusFilter;
  search: string;
}
