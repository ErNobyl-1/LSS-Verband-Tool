import { db } from '../db/index.js';
import { allianceMembers, memberActivityLog, type NewAllianceMember } from '../db/schema.js';
import { eq, desc, and, gte, inArray } from 'drizzle-orm';

interface AllianceMemberData {
  id: number;
  name: string;
  roles: string[];
  caption: string | null;
  online: boolean;
  role_flags: Record<string, boolean>;
}

// Get excluded members from environment
function getExcludedMembers(): Set<string> {
  const excluded = process.env.LSS_EXCLUDED_MEMBERS || '';
  return new Set(
    excluded
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)
  );
}

// Check if a member should be excluded
export function isMemberExcluded(member: { id: number; name: string }): boolean {
  const excluded = getExcludedMembers();
  return excluded.has(member.name.toLowerCase()) || excluded.has(member.id.toString());
}

// Filter out excluded members from a list
export function filterExcludedMembers<T extends { id: number; name: string }>(members: T[]): T[] {
  const excluded = getExcludedMembers();
  return members.filter(
    (m) => !excluded.has(m.name.toLowerCase()) && !excluded.has(m.id.toString())
  );
}

export async function upsertMembers(
  allianceId: number,
  members: AllianceMemberData[]
): Promise<{ created: number; updated: number; activityChanges: number }> {
  const now = new Date();
  let created = 0;
  let updated = 0;
  let activityChanges = 0;

  // Filter out excluded members
  const filteredMembers = filterExcludedMembers(members);

  for (const member of filteredMembers) {
    // Check if member exists
    const existing = await db
      .select()
      .from(allianceMembers)
      .where(eq(allianceMembers.lssMemberId, member.id))
      .limit(1);

    if (existing.length === 0) {
      // Create new member
      const newMember: NewAllianceMember = {
        lssMemberId: member.id,
        allianceId,
        name: member.name,
        roles: member.roles,
        caption: member.caption,
        isOnline: member.online,
        roleFlags: member.role_flags,
        lastOnlineAt: member.online ? now : null,
      };

      await db.insert(allianceMembers).values(newMember);
      created++;

      // Log initial activity
      await db.insert(memberActivityLog).values({
        lssMemberId: member.id,
        isOnline: member.online,
      });
      activityChanges++;
    } else {
      const existingMember = existing[0];
      const wasOnline = existingMember.isOnline;
      const isNowOnline = member.online;

      // Update member
      await db
        .update(allianceMembers)
        .set({
          name: member.name,
          roles: member.roles,
          caption: member.caption,
          isOnline: member.online,
          roleFlags: member.role_flags,
          lastSeenAt: now,
          lastOnlineAt: member.online ? now : existingMember.lastOnlineAt,
        })
        .where(eq(allianceMembers.lssMemberId, member.id));
      updated++;

      // Log activity change if online status changed
      if (wasOnline !== isNowOnline) {
        await db.insert(memberActivityLog).values({
          lssMemberId: member.id,
          isOnline: isNowOnline,
        });
        activityChanges++;
      }
    }
  }

  return { created, updated, activityChanges };
}

export async function getAllMembers(allianceId?: number) {
  let query = db.select().from(allianceMembers);

  if (allianceId) {
    query = query.where(eq(allianceMembers.allianceId, allianceId)) as typeof query;
  }

  const members = await query.orderBy(desc(allianceMembers.lastOnlineAt));

  // Filter out excluded members from results
  const excluded = getExcludedMembers();
  return members.filter(
    (m) => !excluded.has(m.name.toLowerCase()) && !excluded.has(m.odMemberId.toString())
  );
}

export async function getOnlineMembers(allianceId?: number) {
  const conditions = [eq(allianceMembers.isOnline, true)];

  if (allianceId) {
    conditions.push(eq(allianceMembers.allianceId, allianceId));
  }

  const members = await db
    .select()
    .from(allianceMembers)
    .where(and(...conditions))
    .orderBy(allianceMembers.name);

  // Filter out excluded members
  const excluded = getExcludedMembers();
  return members.filter(
    (m) => !excluded.has(m.name.toLowerCase()) && !excluded.has(m.odMemberId.toString())
  );
}

export async function getMemberById(lssMemberId: number) {
  const result = await db
    .select()
    .from(allianceMembers)
    .where(eq(allianceMembers.lssMemberId, lssMemberId))
    .limit(1);

  if (result.length === 0) return null;

  // Check if excluded
  const member = result[0];
  if (isMemberExcluded({ id: member.lssMemberId, name: member.name })) {
    return null;
  }

  return member;
}

export async function getMemberActivityHistory(
  lssMemberId: number,
  options?: { from?: Date; limit?: number }
) {
  const conditions = [eq(memberActivityLog.lssMemberId, lssMemberId)];

  if (options?.from) {
    conditions.push(gte(memberActivityLog.recordedAt, options.from));
  }

  let query = db
    .select()
    .from(memberActivityLog)
    .where(and(...conditions))
    .orderBy(desc(memberActivityLog.recordedAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  return await query;
}

// Get member counts (excluding excluded members)
export async function getMemberCounts(allianceId?: number): Promise<{
  total: number;
  online: number;
}> {
  const allMembers = await getAllMembers(allianceId);
  const onlineMembers = allMembers.filter((m) => m.isOnline);

  return {
    total: allMembers.length,
    online: onlineMembers.length,
  };
}
