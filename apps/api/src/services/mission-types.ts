import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { missionTypes, MissionType } from '../db/schema.js';

interface LSSMissionType {
  id: string;
  name: string;
  average_credits: number;
}

// In-memory cache for quick lookups
let missionTypeCache: Map<string, number> = new Map();
let lastCacheUpdate: Date | null = null;

/**
 * Fetch mission types from LSS API and update database cache
 */
export async function refreshMissionTypes(): Promise<number> {
  console.log('Fetching mission types from LSS API...');

  try {
    const response = await fetch('https://www.leitstellenspiel.de/einsaetze.json');

    if (!response.ok) {
      throw new Error(`LSS API returned ${response.status}`);
    }

    const missions: LSSMissionType[] = await response.json();
    console.log(`Received ${missions.length} mission types from LSS API`);

    let upsertCount = 0;

    // Process in batches to avoid overwhelming the database
    for (const mission of missions) {
      const missionTypeId = String(mission.id);
      const averageCredits = mission.average_credits || 0;

      // Upsert into database
      await db
        .insert(missionTypes)
        .values({
          missionTypeId,
          name: mission.name,
          averageCredits,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: missionTypes.missionTypeId,
          set: {
            name: mission.name,
            averageCredits,
            updatedAt: new Date(),
          },
        });

      // Update in-memory cache
      missionTypeCache.set(missionTypeId, averageCredits);
      upsertCount++;
    }

    lastCacheUpdate = new Date();
    console.log(`Updated ${upsertCount} mission types in database`);

    return upsertCount;
  } catch (error) {
    console.error('Failed to refresh mission types:', error);
    throw error;
  }
}

/**
 * Load mission types from database into memory cache
 */
export async function loadMissionTypesCache(): Promise<void> {
  console.log('Loading mission types cache from database...');

  const allTypes = await db.select().from(missionTypes);

  missionTypeCache.clear();
  for (const mt of allTypes) {
    missionTypeCache.set(mt.missionTypeId, mt.averageCredits);
  }

  lastCacheUpdate = new Date();
  console.log(`Loaded ${allTypes.length} mission types into cache`);
}

/**
 * Get average credits for a mission type ID
 */
export function getAverageCredits(missionTypeId: string): number | null {
  return missionTypeCache.get(missionTypeId) ?? null;
}

/**
 * Get all mission types as a map (for bulk lookups)
 */
export function getAllMissionCredits(): Record<string, number> {
  return Object.fromEntries(missionTypeCache);
}

/**
 * Get cache stats
 */
export function getMissionTypeCacheStats(): { count: number; lastUpdate: Date | null } {
  return {
    count: missionTypeCache.size,
    lastUpdate: lastCacheUpdate,
  };
}

/**
 * Initialize mission types - load from DB, refresh if empty or stale
 */
export async function initializeMissionTypes(): Promise<void> {
  // First try to load from database
  await loadMissionTypesCache();

  // If cache is empty, fetch from LSS API
  if (missionTypeCache.size === 0) {
    console.log('Mission types cache empty, fetching from LSS API...');
    await refreshMissionTypes();
  } else {
    // Check if data is older than 1 week
    const allTypes = await db.select().from(missionTypes).limit(1);
    if (allTypes.length > 0) {
      const age = Date.now() - allTypes[0].updatedAt.getTime();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;

      if (age > oneWeek) {
        console.log('Mission types cache is stale (>1 week), refreshing...');
        refreshMissionTypes().catch(err => {
          console.error('Background refresh of mission types failed:', err);
        });
      }
    }
  }
}
