import { useState, useEffect, useCallback } from 'react';
import { fetchAllianceStats } from '../api';
import { AllianceStats } from '../types';

export function useAllianceStats(refreshInterval = 60000) {
  const [stats, setStats] = useState<AllianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadStats();

    const interval = setInterval(loadStats, refreshInterval);
    return () => clearInterval(interval);
  }, [loadStats, refreshInterval]);

  return { stats, loading, error, refresh: loadStats };
}
