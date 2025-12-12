import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllianceStats, createSSEConnection } from '../api';
import { AllianceStats, SSEAllianceStatsMessage } from '../types';

export function useAllianceStats() {
  const [stats, setStats] = useState<AllianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetchAllianceStats();
      if (response.success && response.data) {
        setStats(response.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alliance stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSSEMessage = useCallback((data: SSEAllianceStatsMessage) => {
    if (data.stats) {
      setStats(data.stats);
    }
  }, []);

  useEffect(() => {
    // Initial load
    loadStats();

    // Setup SSE connection for live updates
    const eventSource = createSSEConnection({
      onAllianceStats: handleSSEMessage,
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [loadStats, handleSSEMessage]);

  return { stats, loading, error, refresh: loadStats };
}
