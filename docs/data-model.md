# Datenmodell

## Übersicht

Das System verwendet PostgreSQL mit folgenden Tabellen:

```
┌─────────────────────┐     ┌─────────────────────┐
│       users         │     │      sessions       │
├─────────────────────┤     ├─────────────────────┤
│ id                  │────▸│ user_id             │
│ lss_name            │     │ token               │
│ password_hash       │     │ expires_at          │
│ display_name        │     └─────────────────────┘
│ badge_color         │
│ is_active           │     ┌─────────────────────┐
│ is_admin            │     │  alliance_members   │
│ alliance_member_id  │────▸├─────────────────────┤
└─────────────────────┘     │ id                  │
                            │ alliance_id         │
┌─────────────────────┐     │ name                │
│     incidents       │     │ is_online           │
├─────────────────────┤     │ last_online_at      │
│ id                  │     └─────────────────────┘
│ ls_id               │              │
│ title               │              │
│ type                │              ▼
│ category            │     ┌─────────────────────┐
│ source              │     │ member_activity_log │
│ status              │     ├─────────────────────┤
│ lat, lon            │     │ member_id           │
│ address             │     │ went_online         │
│ participants        │     │ recorded_at         │
│ start_time          │     └─────────────────────┘
│ end_time            │
│ raw_json            │     ┌─────────────────────┐
└─────────────────────┘     │   alliance_stats    │
                            ├─────────────────────┤
                            │ alliance_id         │
                            │ rank                │
                            │ credits             │
                            │ users_online        │
                            │ users_total         │
                            │ recorded_at         │
                            └─────────────────────┘
```

---

## Tabellen

### users

Benutzer des Tools (nicht zu verwechseln mit LSS-Spielern).

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| lss_name | VARCHAR(100) | NOT NULL, UNIQUE | LSS-Spielername (Login) |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt-gehashtes Passwort |
| display_name | VARCHAR(100) | NULL | Anzeigename (z.B. echter Vorname) |
| badge_color | VARCHAR(7) | NULL | Farbe für Badge (#RRGGBB) |
| alliance_member_id | INTEGER | NULL, FK | Verknüpfung zu alliance_members |
| is_active | BOOLEAN | DEFAULT false | Account freigeschaltet? |
| is_admin | BOOLEAN | DEFAULT false | Admin-Rechte? |
| created_at | TIMESTAMP | DEFAULT NOW() | Registrierungszeitpunkt |
| last_login_at | TIMESTAMP | NULL | Letzter Login |

### sessions

Aktive Benutzer-Sessions.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | INTEGER | NOT NULL, FK | Benutzer-ID |
| token | VARCHAR(255) | NOT NULL, UNIQUE | Session-Token |
| created_at | TIMESTAMP | DEFAULT NOW() | Session-Start |
| expires_at | TIMESTAMP | NOT NULL | Ablaufzeitpunkt |

### incidents

Einsätze aus dem Leitstellenspiel.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| ls_id | VARCHAR(255) | NOT NULL, UNIQUE | LSS-interne Einsatz-ID |
| title | VARCHAR(500) | NOT NULL | Einsatztitel |
| type | VARCHAR(200) | NULL | Einsatztyp (z.B. "Wohnungsbrand") |
| category | VARCHAR(50) | NOT NULL | `emergency`, `planned`, `event` |
| source | VARCHAR(50) | NOT NULL | `own_shared`, `alliance`, `alliance_event` |
| status | VARCHAR(50) | DEFAULT 'active' | Status |
| lat | DOUBLE | NULL | Breitengrad |
| lon | DOUBLE | NULL | Längengrad |
| address | TEXT | NULL | Adresse |
| participants | TEXT[] | NULL | Beteiligte Spieler |
| start_time | TIMESTAMP | NULL | Geplanter Start (bei Sicherheitswachen) |
| end_time | TIMESTAMP | NULL | Geplantes Ende |
| created_at | TIMESTAMP | DEFAULT NOW() | Erster Import |
| updated_at | TIMESTAMP | DEFAULT NOW() | Letzte Änderung |
| last_seen_at | TIMESTAMP | DEFAULT NOW() | Letzter Scrape |
| raw_json | JSONB | NULL | Rohdaten aus Extraktion |

**Kategorien (category):**
- `emergency` - Notfälle (normale Einsätze + Krankentransporte)
- `planned` - Geplante Einsätze (Sicherheitswachen)
- `event` - Großschadenslagen

**Quellen (source):**
- `own_shared` - Eigene freigegebene Einsätze
- `alliance` - Verbandseinsätze
- `alliance_event` - Verbands-Großschadenslagen

### alliance_members

Verbandsmitglieder (aus dem Spiel).

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | INTEGER | PRIMARY KEY | LSS-Spieler-ID |
| alliance_id | INTEGER | NOT NULL | Verbands-ID |
| name | VARCHAR(100) | NOT NULL | Spielername |
| is_online | BOOLEAN | DEFAULT false | Aktuell online? |
| last_online_at | TIMESTAMP | NULL | Letzter Online-Zeitpunkt |
| last_offline_at | TIMESTAMP | NULL | Letzter Offline-Zeitpunkt |
| created_at | TIMESTAMP | DEFAULT NOW() | Erste Erfassung |
| updated_at | TIMESTAMP | DEFAULT NOW() | Letzte Aktualisierung |

### member_activity_log

Protokoll der Online/Offline-Wechsel (für Statistiken).

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| member_id | INTEGER | NOT NULL, FK | Mitglieder-ID |
| went_online | BOOLEAN | NOT NULL | true=online, false=offline |
| recorded_at | TIMESTAMP | DEFAULT NOW() | Zeitpunkt |

**Hinweis:** Wird nach `DATA_RETENTION_ACTIVITY_DAYS` (default: 30) Tagen gelöscht.

### alliance_stats

Verbandsstatistiken (historisch).

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| alliance_id | INTEGER | NOT NULL | Verbands-ID |
| rank | INTEGER | NOT NULL | Verbandsrang |
| credits | BIGINT | NOT NULL | Verdiente Credits |
| users_online | INTEGER | NOT NULL | Mitglieder online |
| users_total | INTEGER | NOT NULL | Mitglieder gesamt |
| recorded_at | TIMESTAMP | DEFAULT NOW() | Erfassungszeitpunkt |

**Hinweis:** Nach `DATA_RETENTION_STATS_AGGREGATE_DAYS` (default: 30) Tagen werden Einträge auf 1 pro Tag aggregiert.

---

## Indizes

```sql
-- Users
CREATE UNIQUE INDEX users_lss_name_idx ON users(lss_name);

-- Sessions
CREATE UNIQUE INDEX sessions_token_idx ON sessions(token);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

-- Incidents
CREATE UNIQUE INDEX incidents_ls_id_idx ON incidents(ls_id);
CREATE INDEX incidents_category_idx ON incidents(category);
CREATE INDEX incidents_source_idx ON incidents(source);
CREATE INDEX incidents_created_at_idx ON incidents(created_at);
CREATE INDEX incidents_last_seen_at_idx ON incidents(last_seen_at);

-- Alliance Members
CREATE INDEX alliance_members_alliance_id_idx ON alliance_members(alliance_id);

-- Member Activity Log
CREATE INDEX member_activity_log_member_id_idx ON member_activity_log(member_id);
CREATE INDEX member_activity_log_recorded_at_idx ON member_activity_log(recorded_at);

-- Alliance Stats
CREATE INDEX alliance_stats_alliance_id_idx ON alliance_stats(alliance_id);
CREATE INDEX alliance_stats_recorded_at_idx ON alliance_stats(recorded_at);
```

---

## Datenaufbewahrung (Data Retention)

Das System bereinigt automatisch alte Daten (täglich um 4:00 Uhr):

| Daten | Retention | Verhalten |
|-------|-----------|-----------|
| Incidents | 4 Tage | Löschen |
| Member Activity Log | 30 Tage | Löschen |
| Alliance Stats | 30 Tage | Aggregieren auf 1/Tag |
| Sessions | 24 Stunden | Löschen (abgelaufene) |

Konfigurierbar via `.env`:
```env
DATA_RETENTION_INCIDENTS_DAYS=4
DATA_RETENTION_ACTIVITY_DAYS=30
DATA_RETENTION_STATS_AGGREGATE_DAYS=30
```

---

## Beispiel-Queries

### Alle aktiven Verbandseinsätze

```sql
SELECT * FROM incidents
WHERE category = 'emergency'
  AND source = 'alliance'
ORDER BY created_at DESC
LIMIT 100;
```

### Online-Mitglieder

```sql
SELECT name, last_online_at
FROM alliance_members
WHERE is_online = true
ORDER BY name;
```

### Credits-Verlauf (letzte 7 Tage)

```sql
SELECT
  DATE(recorded_at) as tag,
  MAX(credits) - MIN(credits) as credits_gewonnen
FROM alliance_stats
WHERE recorded_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(recorded_at)
ORDER BY tag;
```

### Aktivste Spieler (nach Online-Zeit)

```sql
SELECT
  m.name,
  COUNT(*) FILTER (WHERE went_online = true) as sessions,
  COUNT(*) as events
FROM member_activity_log l
JOIN alliance_members m ON l.member_id = m.id
WHERE l.recorded_at > NOW() - INTERVAL '7 days'
GROUP BY m.name
ORDER BY sessions DESC
LIMIT 10;
```

---

## raw_json Struktur (incidents)

Das `raw_json` Feld speichert zusätzliche Daten aus der Extraktion:

```json
{
  "element_id": "mission_panel_123456",
  "panel_class": "panel-success",
  "data_attributes": {
    "mission_type_id": "42",
    "user_id": "12345"
  },
  "extracted_at": "2024-01-15T10:30:00.000Z"
}
```

Dies ermöglicht:
- Nachvollziehbarkeit der Datenquelle
- Debugging von Extraktionsproblemen
- Flexible Erweiterung ohne Schema-Änderung
