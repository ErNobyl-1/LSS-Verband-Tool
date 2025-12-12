# Architektur - LSS Verband Tool

## Überblick

Das LSS Verband Tool ist ein lokales System zur Extraktion und Visualisierung von Einsatzdaten aus dem Browsergame "Leitstellenspiel".

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Docker Environment                             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        API Service (Node.js)                     │    │
│  │  Port: 3001                                                      │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │               LSS Scraper (Puppeteer/Chromium)           │    │    │
│  │  │  - Headless Browser für Leitstellenspiel                 │    │    │
│  │  │  - Automatischer Login mit Credentials                   │    │    │
│  │  │  - Periodische Extraktion (alle 10s)                     │    │    │
│  │  │  - DOM-Parsing der Mission Lists                         │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  Endpoints:                                                      │    │
│  │  - POST /ingest/incidents  → Daten empfangen (Auth required)    │    │
│  │  - GET  /api/incidents     → Daten abfragen                     │    │
│  │  - GET  /api/stream        → SSE Live-Updates                   │    │
│  │  - GET  /api/health        → Health Check                       │    │
│  └────────────────────────────┬────────────────────────────────────┘    │
│                               │                                          │
│                               │ SQL                                      │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      PostgreSQL Database                         │    │
│  │  Port: 5432                                                      │    │
│  │                                                                  │    │
│  │  Tabelle: incidents                                             │    │
│  │  - Upsert nach ls_id                                            │    │
│  │  - Timestamps: created_at, updated_at, last_seen_at             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               ▲                                          │
│                               │ HTTP/SSE                                 │
│  ┌────────────────────────────┴────────────────────────────────────┐    │
│  │                        Web Service (React)                       │    │
│  │  Port: 3000                                                      │    │
│  │                                                                  │    │
│  │  Features:                                                       │    │
│  │  - Dashboard mit Filtern                                        │    │
│  │  - Listenansicht & Kartenansicht                                │    │
│  │  - Live-Updates via SSE                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         Adminer (Optional)                       │    │
│  │  Port: 8080                                                      │    │
│  │  Datenbank-Administration                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Komponenten

### 1. LSS Scraper (Puppeteer)

**Aufgabe:** Extrahiert Einsatzdaten via Headless Browser direkt von der Leitstellenspiel-Webseite.

**Datenquellen:**
- `#mission_list` - Eigene Einsätze (nur freigegebene)
- `#mission_list_krankentransporte` - Eigene Krankentransporte (nur freigegebene)
- `#mission_list_alliance` - Verbandseinsätze
- `#mission_list_krankentransporte_alliance` - Verbands-Krankentransporte
- `#mission_list_sicherheitswache` - Eigene Sicherheitswachen (nur freigegebene)
- `#mission_list_sicherheitswache_alliance` - Verbands-Sicherheitswachen
- `#mission_list_alliance_event` - Großschadenslagen

**Verhalten:**
- Startet automatisch mit dem API-Server
- Loggt sich mit konfigurierten Credentials ein
- Extrahiert alle 10 Sekunden (konfigurierbar)
- Re-Login bei Session-Ablauf
- Retry bei Fehlern

### 2. Backend API (Node.js/Express)

**Technologie:** Node.js 20, Express, Drizzle ORM, PostgreSQL, Puppeteer

**Authentifizierung:**
- Alle `/ingest/*` Endpoints erfordern `X-API-Key` Header
- Key wird gegen `API_KEY` Environment Variable geprüft

**Hauptfunktionen:**
- Datenvalidierung mit Zod
- Upsert-Logik (Update oder Insert basierend auf `ls_id`)
- SSE Broadcasting für Live-Updates
- Integrierter LSS Scraper

### 3. PostgreSQL Database

**Schema:** Siehe [data-model.md](data-model.md)

**Features:**
- JSONB für flexible Rohdaten-Speicherung
- Indizes für performante Abfragen
- Volume für Datenpersistenz

### 4. Web Frontend (React)

**Technologie:** React 18, Vite, TailwindCSS, MapLibre GL

**Features:**
- Filterable Einsatzliste (nach Kategorie, Quelle, Status)
- Detailansicht
- Kartenansicht mit Markern
- Live-Updates via SSE

## Datenfluss

### Scrape Flow

```
1. Scraper prüft ob Session aktiv (mission_list vorhanden?)
2. Falls nicht: Login auf /users/sign_in
3. DOM-Extraktion aus allen Mission Lists
4. Filterung: nur freigegebene eigene Einsätze (panel-success)
5. Upsert in Datenbank
6. SSE Broadcast an verbundene Clients
7. Warten auf nächstes Intervall
```

### Query Flow

```
1. Web UI: GET /api/incidents?category=emergency&source=alliance
2. API baut SQL Query mit Drizzle
3. Paginierte Response mit Meta-Daten
4. UI rendert Liste/Karte
```

### Live Update Flow

```
1. Web UI öffnet EventSource zu /api/stream
2. Bei jedem Scrape: API sendet SSE Event mit geänderten Daten
3. UI empfängt Event, updated lokalen State
4. Re-Render ohne Page Reload
```

## Kategorien und Quellen

### Kategorien (category)
- **emergency**: Notfälle (normale Einsätze + Krankentransporte)
- **planned**: Geplante Einsätze (Sicherheitswachen)
- **event**: Großschadenslagen

### Quellen (source)
- **own_shared**: Eigene freigegebene Einsätze
- **alliance**: Verbands-Einsätze
- **alliance_event**: Verbands-Großschadenslagen

## Sicherheit

- LSS-Credentials werden nur im Server verwendet (nicht im Browser)
- API-Key Authentifizierung für externe Schreiboperationen
- CORS für lokale Entwicklung konfiguriert
- Headless Browser läuft isoliert im Container

## Skalierung

Das System ist für lokale Nutzung optimiert:
- Single-User Szenario
- Niedrige Request-Rate (alle 10s)
- Moderate Datenmenge (typisch < 1000 Einsätze)

Für Multi-User oder höhere Last müssten Connection Pooling und Rate Limiting erweitert werden.
