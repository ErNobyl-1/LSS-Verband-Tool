import { db, incidents, Incident } from '../db/index.js';
import { eq, ilike, and, or, sql, desc } from 'drizzle-orm';
import { IncidentInput, IncidentQuery } from '../validation/schemas.js';
import { broadcastIncident, broadcastBatch } from './sse.js';

export async function upsertIncident(input: IncidentInput): Promise<{ incident: Incident; isNew: boolean }> {
  const now = new Date();

  // Check if incident exists
  const existing = await db.query.incidents.findFirst({
    where: eq(incidents.lsId, input.ls_id),
  });

  if (existing) {
    // Update existing - check if data changed
    const hasChanges =
      existing.title !== input.title ||
      existing.type !== input.type ||
      existing.status !== input.status ||
      existing.source !== input.source ||
      existing.category !== input.category ||
      existing.lat !== input.lat ||
      existing.lon !== input.lon ||
      existing.address !== input.address;

    const [updated] = await db
      .update(incidents)
      .set({
        title: input.title,
        type: input.type ?? existing.type,
        status: input.status ?? existing.status,
        source: input.source ?? existing.source,
        category: input.category ?? existing.category,
        lat: input.lat ?? existing.lat,
        lon: input.lon ?? existing.lon,
        address: input.address ?? existing.address,
        rawJson: input.raw_json ?? existing.rawJson,
        updatedAt: hasChanges ? now : existing.updatedAt,
        lastSeenAt: now,
      })
      .where(eq(incidents.lsId, input.ls_id))
      .returning();

    if (hasChanges) {
      broadcastIncident(updated, 'updated');
    }

    return { incident: updated, isNew: false };
  }

  // Create new incident
  const [created] = await db
    .insert(incidents)
    .values({
      lsId: input.ls_id,
      title: input.title,
      type: input.type ?? null,
      status: input.status ?? 'active',
      source: input.source ?? 'unknown',
      category: input.category ?? 'emergency',
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      address: input.address ?? null,
      rawJson: input.raw_json ?? null,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    })
    .returning();

  broadcastIncident(created, 'created');

  return { incident: created, isNew: true };
}

export async function upsertIncidents(inputs: IncidentInput[]): Promise<{
  incidents: Incident[];
  created: number;
  updated: number;
}> {
  const results: Incident[] = [];
  let created = 0;
  let updated = 0;

  for (const input of inputs) {
    const result = await upsertIncident(input);
    results.push(result.incident);
    if (result.isNew) {
      created++;
    } else {
      updated++;
    }
  }

  // Broadcast batch update for efficiency
  if (results.length > 0) {
    broadcastBatch(results, 'batch_upsert');
  }

  return { incidents: results, created, updated };
}

export async function queryIncidents(query: IncidentQuery): Promise<{
  incidents: Incident[];
  total: number;
}> {
  const conditions = [];

  if (query.source) {
    conditions.push(eq(incidents.source, query.source));
  }

  if (query.category) {
    conditions.push(eq(incidents.category, query.category));
  }

  if (query.status) {
    conditions.push(eq(incidents.status, query.status));
  }

  if (query.q) {
    conditions.push(
      or(
        ilike(incidents.title, `%${query.q}%`),
        ilike(incidents.lsId, `%${query.q}%`),
        ilike(incidents.address ?? '', `%${query.q}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidents)
    .where(whereClause);

  // Get paginated results
  const results = await db
    .select()
    .from(incidents)
    .where(whereClause)
    .orderBy(desc(incidents.lastSeenAt))
    .limit(query.limit)
    .offset(query.offset);

  return {
    incidents: results,
    total: count,
  };
}

export async function getIncidentById(id: number): Promise<Incident | null> {
  const result = await db.query.incidents.findFirst({
    where: eq(incidents.id, id),
  });
  return result ?? null;
}

export async function getIncidentByLsId(lsId: string): Promise<Incident | null> {
  const result = await db.query.incidents.findFirst({
    where: eq(incidents.lsId, lsId),
  });
  return result ?? null;
}

/**
 * Deletes incidents that are no longer present in the game.
 * Keeps only incidents whose lsId is in the provided set of active IDs.
 * Returns the deleted incidents for SSE broadcast.
 */
export async function deleteStaleIncidents(activeLsIds: string[]): Promise<Incident[]> {
  if (activeLsIds.length === 0) {
    // If no active incidents, delete all
    const allIncidents = await db.select().from(incidents);
    if (allIncidents.length > 0) {
      await db.delete(incidents);
    }
    return allIncidents;
  }

  // Find incidents not in the active set
  const staleIncidents = await db
    .select()
    .from(incidents)
    .where(sql`${incidents.lsId} NOT IN (${sql.join(activeLsIds.map(id => sql`${id}`), sql`, `)})`);

  if (staleIncidents.length > 0) {
    // Delete stale incidents
    await db
      .delete(incidents)
      .where(sql`${incidents.lsId} NOT IN (${sql.join(activeLsIds.map(id => sql`${id}`), sql`, `)})`);
  }

  return staleIncidents;
}
