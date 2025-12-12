# Datenmodell

## Tabellen

### incidents

Haupttabelle für alle Einsätze.

| Spalte       | Typ                    | Constraints      | Beschreibung                          |
|--------------|------------------------|------------------|---------------------------------------|
| id           | SERIAL                 | PRIMARY KEY      | Auto-increment ID                     |
| ls_id        | VARCHAR(255)           | NOT NULL, UNIQUE | Eindeutige LSS-Einsatz-ID             |
| title        | VARCHAR(500)           | NOT NULL         | Einsatztitel                          |
| type         | VARCHAR(100)           | NULL             | Einsatztyp (z.B. "Brandeinsatz")      |
| status       | VARCHAR(50)            | DEFAULT 'active' | Status (active, in_progress, etc.)    |
| source       | VARCHAR(50)            | NOT NULL, DEFAULT 'unknown' | Quelle (alliance, alliance_event, own, unknown) |
| lat          | DOUBLE PRECISION       | NULL             | Breitengrad                           |
| lon          | DOUBLE PRECISION       | NULL             | Längengrad                            |
| address      | TEXT                   | NULL             | Adresse als Text                      |
| created_at   | TIMESTAMP              | NOT NULL, DEFAULT NOW() | Erster Import                    |
| updated_at   | TIMESTAMP              | NOT NULL, DEFAULT NOW() | Letzte inhaltliche Änderung     |
| last_seen_at | TIMESTAMP              | NOT NULL, DEFAULT NOW() | Letzter Import (auch ohne Änderung) |
| raw_json     | JSONB                  | NULL             | Rohdaten aus Extraktion               |

## Indizes

```sql
-- Eindeutiger Index auf ls_id (automatisch durch UNIQUE constraint)
CREATE UNIQUE INDEX incidents_ls_id_idx ON incidents(ls_id);

-- Filter-Indizes
CREATE INDEX incidents_source_idx ON incidents(source);
CREATE INDEX incidents_status_idx ON incidents(status);

-- Zeit-Indizes für Sortierung und Cleanup
CREATE INDEX incidents_created_at_idx ON incidents(created_at);
CREATE INDEX incidents_last_seen_at_idx ON incidents(last_seen_at);
```

## Constraints

### source Enum (via Anwendungslogik)

Erlaubte Werte:
- `alliance` - Verbandseinsätze
- `alliance_event` - Verband-Event-Einsätze
- `own` - Eigene Einsätze
- `unknown` - Unbekannt/Default

### ls_id Format

Das `ls_id` Feld folgt dem Format: `{source}_{original_id}`

Beispiele:
- `alliance_12345`
- `alliance_event_67890`
- `own_11111`

## Schema (Drizzle ORM)

```typescript
import { pgTable, serial, varchar, text, timestamp, jsonb, doublePrecision, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  lsId: varchar('ls_id', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  type: varchar('type', { length: 100 }),
  status: varchar('status', { length: 50 }).default('active'),
  source: varchar('source', { length: 50 }).notNull().default('unknown'),
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
  statusIdx: index('incidents_status_idx').on(table.status),
  createdAtIdx: index('incidents_created_at_idx').on(table.createdAt),
  lastSeenAtIdx: index('incidents_last_seen_at_idx').on(table.lastSeenAt),
}));
```

## Upsert-Logik

Bei jedem Import:

1. Suche Einsatz mit gleichem `ls_id`
2. Wenn gefunden:
   - Prüfe ob Daten geändert (title, type, status, source, lat, lon, address)
   - Wenn geändert: Update `updated_at`
   - Immer: Update `last_seen_at`
3. Wenn nicht gefunden:
   - Neuen Einsatz erstellen
   - `created_at`, `updated_at`, `last_seen_at` = NOW()

## Beispiel-Queries

### Alle aktiven Verbandseinsätze

```sql
SELECT * FROM incidents
WHERE source = 'alliance'
  AND status = 'active'
ORDER BY last_seen_at DESC
LIMIT 100;
```

### Suche nach Titel

```sql
SELECT * FROM incidents
WHERE title ILIKE '%brand%'
ORDER BY last_seen_at DESC;
```

### Einsätze mit Koordinaten

```sql
SELECT * FROM incidents
WHERE lat IS NOT NULL
  AND lon IS NOT NULL
ORDER BY last_seen_at DESC;
```

### Statistik nach Quelle

```sql
SELECT source, COUNT(*) as count
FROM incidents
GROUP BY source;
```

### Alte Einsätze (nicht mehr gesehen seit 24h)

```sql
SELECT * FROM incidents
WHERE last_seen_at < NOW() - INTERVAL '24 hours';
```

## raw_json Struktur

Das `raw_json` Feld speichert beliebige Zusatzdaten aus der Extraktion:

```json
{
  "original_id": "12345",
  "element_id": "mission_12345",
  "classes": ["missionSideBarEntry", "mission_deleted"],
  "extracted_at": "2024-01-15T10:30:00Z"
}
```

Dies ermöglicht:
- Nachvollziehbarkeit der Datenquelle
- Debugging von Extraktionsproblemen
- Flexible Erweiterung ohne Schema-Änderung
