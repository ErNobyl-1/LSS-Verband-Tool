import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, SSEMessage } from '../types';
import { fetchIncidents, createSSEConnection } from '../api';

const RETRY_INTERVAL = 5000; // 5 seconds

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch incidents from API
  const loadIncidents = useCallback(async () => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetchIncidents();
      setIncidents(response.data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);

      // Schedule retry on error
      retryTimeoutRef.current = setTimeout(() => {
        loadIncidents();
      }, RETRY_INTERVAL);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } else if (data.type === 'deleted' && data.deletedIds) {
      // Remove deleted incidents from the list
      const deletedSet = new Set(data.deletedIds);
      setIncidents((prev) => prev.filter((i) => !deletedSet.has(i.lsId)));
    }
  }, []);

  // Setup SSE connection
  useEffect(() => {
    const eventSource = createSSEConnection(
      handleSSEMessage,
      () => setConnected(false),
      () => {
        setConnected(true);
        // Reload incidents when SSE connects (API is available)
        loadIncidents();
      }
    );

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [handleSSEMessage, loadIncidents]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    incidents,
    loading,
    error,
    connected,
    refresh: loadIncidents,
  };
}
