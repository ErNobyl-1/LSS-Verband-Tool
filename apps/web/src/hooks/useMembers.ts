import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMembers, createSSEConnection } from '../api';
import { AllianceMember, SSEMembersMessage } from '../types';

export function useMembers() {
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<AllianceMember[]>([]);
  const [counts, setCounts] = useState({ total: 0, online: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

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

  const handleSSEMessage = useCallback((data: SSEMembersMessage) => {
    if (data.members) {
      setMembers(data.members);
      setOnlineMembers(data.members.filter(m => m.isOnline));
      setCounts(data.counts);
    }
  }, []);

  useEffect(() => {
    // Initial load
    loadMembers();

    // Setup SSE connection for live updates
    const eventSource = createSSEConnection({
      onMembers: handleSSEMessage,
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [loadMembers, handleSSEMessage]);

  return { members, onlineMembers, counts, loading, error, refresh: loadMembers };
}
