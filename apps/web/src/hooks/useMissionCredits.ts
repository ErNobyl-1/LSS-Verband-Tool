import { useState, useEffect } from 'react';
import { fetchMissionCredits } from '../api';

export function useMissionCredits() {
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetchMissionCredits();
        setCredits(response.data);
      } catch (e) {
        console.error('Failed to load mission credits:', e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const getCredits = (missionTypeId: string | null): number | null => {
    if (!missionTypeId) return null;
    return credits[missionTypeId] ?? null;
  };

  return { credits, loading, getCredits };
}
