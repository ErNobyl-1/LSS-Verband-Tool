import { pgTable, serial, varchar, text, timestamp, jsonb, doublePrecision, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
