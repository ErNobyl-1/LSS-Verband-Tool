import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, FilterState, SSEMessage } from '../types';
import { fetchIncidents, createSSEConnection } from '../api';

export function useIncidents(filters: FilterState) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch incidents from API
  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchIncidents(filters);
      setIncidents(response.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Handle SSE messages
  const handleSSEMessage = useCallback((data: SSEMessage) => {
    if (data.type === 'created' || data.type === 'updated') {
      if (data.incident) {
        setIncidents((prev) => {
          const index = prev.findIndex((i) => i.lsId === data.incident!.lsId);
          if (index >= 0) {
            // Update existing
            const updated = [...prev];
            updated[index] = data.incident!;
            return updated;
          }
          // Add new (at the beginning)
          return [data.incident!, ...prev];
        });
      }
    } else if (data.type === 'batch_upsert' && data.incidents) {
      setIncidents((prev) => {
        const incidentMap = new Map(prev.map((i) => [i.lsId, i]));

        // Update or add each incident
        data.incidents!.forEach((incident) => {
          incidentMap.set(incident.lsId, incident);
        });

        // Convert back to array and sort by lastSeenAt
        return Array.from(incidentMap.values()).sort(
          (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
        );
      });
    }
  }, []);

  // Setup SSE connection
  useEffect(() => {
    const eventSource = createSSEConnection(
      handleSSEMessage,
      () => setConnected(false),
      () => setConnected(true)
    );

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [handleSSEMessage]);

  // Load incidents on mount and filter change
  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return {
    incidents,
    loading,
    error,
    connected,
    refresh: loadIncidents,
  };
}
