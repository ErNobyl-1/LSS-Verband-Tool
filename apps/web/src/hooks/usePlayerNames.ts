import { useState, useEffect } from 'react';
import { fetchPlayerNames } from '../api';

export function usePlayerNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetchPlayerNames();
        setNames(response.data);
      } catch (e) {
        console.error('Failed to load player names:', e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const getDisplayName = (ingameName: string): string => {
    return names[ingameName] ?? ingameName;
  };

  return { names, loading, getDisplayName };
}
