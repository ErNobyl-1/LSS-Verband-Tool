import { pgTable, serial, varchar, text, timestamp, jsonb, doublePrecision, index, uniqueIndex, integer, bigint, boolean } from 'drizzle-orm/pg-core';

export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  lsId: varchar('ls_id', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  type: varchar('type', { length: 100 }),
  status: varchar('status', { length: 50 }).default('active'),
  source: varchar('source', { length: 50 }).notNull().default('unknown'),
  category: varchar('category', { length: 50 }).notNull().default('emergency'),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  rawJson: jsonb('raw_json'),
}, (table) => ({
  lsIdIdx: uniqueIndex('incidents_ls_id_idx').on(table.lsId),
  sourceIdx: index('incidents_source_idx').on(table.source),
  categoryIdx: index('incidents_category_idx').on(table.category),
  statusIdx: index('incidents_status_idx').on(table.status),
  createdAtIdx: index('incidents_created_at_idx').on(table.createdAt),
  lastSeenAtIdx: index('incidents_last_seen_at_idx').on(table.lastSeenAt),
}));

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

// Alliance stats history - tracks credits_total and rank over time
export const allianceStats = pgTable('alliance_stats', {
  id: serial('id').primaryKey(),
  allianceId: integer('alliance_id').notNull(),
  allianceName: varchar('alliance_name', { length: 255 }).notNull(),
  creditsTotal: bigint('credits_total', { mode: 'number' }).notNull(),
  rank: integer('rank').notNull(),
  userCount: integer('user_count'),
  userOnlineCount: integer('user_online_count'),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  allianceIdIdx: index('alliance_stats_alliance_id_idx').on(table.allianceId),
  recordedAtIdx: index('alliance_stats_recorded_at_idx').on(table.recordedAt),
  // Composite index for efficient time-series queries
  allianceTimeIdx: index('alliance_stats_alliance_time_idx').on(table.allianceId, table.recordedAt),
}));

export type AllianceStat = typeof allianceStats.$inferSelect;
export type NewAllianceStat = typeof allianceStats.$inferInsert;

// Alliance members - current state of each member
export const allianceMembers = pgTable('alliance_members', {
  id: serial('id').primaryKey(),
  lssMemberId: integer('lss_member_id').notNull().unique(), // LSS user ID
  allianceId: integer('alliance_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  roles: jsonb('roles').$type<string[]>().default([]),
  caption: varchar('caption', { length: 255 }),
  isOnline: boolean('is_online').default(false),
  roleFlags: jsonb('role_flags').$type<Record<string, boolean>>().default({}),
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  lastOnlineAt: timestamp('last_online_at'),
}, (table) => ({
  lssMemberIdIdx: uniqueIndex('alliance_members_lss_member_id_idx').on(table.lssMemberId),
  allianceIdIdx: index('alliance_members_alliance_id_idx').on(table.allianceId),
  isOnlineIdx: index('alliance_members_is_online_idx').on(table.isOnline),
}));

export type AllianceMember = typeof allianceMembers.$inferSelect;
export type NewAllianceMember = typeof allianceMembers.$inferInsert;

// Member online activity log - tracks when members come online/offline
export const memberActivityLog = pgTable('member_activity_log', {
  id: serial('id').primaryKey(),
  lssMemberId: integer('lss_member_id').notNull(),
  isOnline: boolean('is_online').notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  lssMemberIdIdx: index('member_activity_log_lss_member_id_idx').on(table.lssMemberId),
  recordedAtIdx: index('member_activity_log_recorded_at_idx').on(table.recordedAt),
  memberTimeIdx: index('member_activity_log_member_time_idx').on(table.lssMemberId, table.recordedAt),
}));

export type MemberActivityLog = typeof memberActivityLog.$inferSelect;
export type NewMemberActivityLog = typeof memberActivityLog.$inferInsert;

// Mission types - cached from LSS API for average credits lookup
export const missionTypes = pgTable('mission_types', {
  id: serial('id').primaryKey(),
  missionTypeId: varchar('mission_type_id', { length: 50 }).notNull().unique(), // e.g. "0", "1", "1/a", "2-0"
  name: varchar('name', { length: 500 }).notNull(),
  averageCredits: integer('average_credits').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  missionTypeIdIdx: uniqueIndex('mission_types_mission_type_id_idx').on(table.missionTypeId),
}));

export type MissionType = typeof missionTypes.$inferSelect;
export type NewMissionType = typeof missionTypes.$inferInsert;
