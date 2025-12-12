import { useState, useEffect, useCallback } from 'react';
import { fetchMembers } from '../api';
import { AllianceMember } from '../types';

export function useMembers(refreshInterval = 60000) {
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<AllianceMember[]>([]);
  const [counts, setCounts] = useState({ total: 0, online: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetchMembers();
      if (response.success) {
        setMembers(response.data);
        setOnlineMembers(response.data.filter(m => m.isOnline));
        setCounts(response.meta);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();

    const interval = setInterval(loadMembers, refreshInterval);
    return () => clearInterval(interval);
  }, [loadMembers, refreshInterval]);

  return { members, onlineMembers, counts, loading, error, refresh: loadMembers };
}
