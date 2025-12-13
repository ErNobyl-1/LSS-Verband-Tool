# Architektur - LSS Verband Tool

## Überblick

Das LSS Verband Tool ist ein selbst gehostetes System zur Echtzeit-Übersicht von Verbandseinsätzen aus dem Browsergame "Leitstellenspiel.de". Es besteht aus vier Docker-Services und unterstützt mehrere Benutzer mit Authentifizierung.

```
                                    ┌─────────────────────────────────────┐
                                    │         Internet / Browser          │
                                    └─────────────────┬───────────────────┘
                                                      │
                                                      │ HTTPS (443)
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   Docker Environment                                  │
│                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            nginx (Reverse Proxy)                                 │ │
│  │  - SSL/TLS Termination (Let's Encrypt)                                          │ │
│  │  - Routes: / → web:3000, /api → api:3001                                       │ │
│  │  - Security Headers (HSTS, X-Frame-Options, etc.)                               │ │
│  └───────────────────────────────────┬─────────────────────────────────────────────┘ │
│                                      │                                               │
│      ┌───────────────────────────────┼───────────────────────────────┐               │
│      │                               │                                               │
│      ▼                               ▼                                               │
│  ┌─────────────┐            ┌─────────────────┐                                      │
│  │  Web (3000) │            │   API (3001)    │                                      │
│  │             │            │                 │                                      │
│  │  React      │◀──────────▶│  Express.js     │                                      │
│  │  Vite       │   HTTP/    │  Puppeteer      │                                      │
│  │  TailwindCSS│   SSE      │  Drizzle ORM    │                                      │
│  │  MapLibre   │            │  Pino Logger    │                                      │
│  └─────────────┘            └────────┬────────┘                                      │
│                                      │                                               │
│                                      │ SQL                                           │
│                                      ▼                                               │
│                             ┌─────────────────┐                                      │
│                             │ PostgreSQL (DB) │                                      │
│                             │                 │                                      │
│                             │  - incidents    │                                      │
│                             │  - users        │                                      │
│                             │  - sessions     │                                      │
│                             │  - members      │                                      │
│                             │  - stats        │                                      │
│                             └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Komponenten

### 1. Web Frontend (React)

**Technologie:** React 18, Vite, TailwindCSS, MapLibre GL JS, Chart.js

**Funktion:** Single-Page-Application für die Benutzeroberfläche.

**Seiten:**
- `/` - Statistik-Dashboard (Startseite)
- `/incidents` - Einsatzliste (Notfälle + Geplant)
- `/map` - Kartenansicht aller Einsätze
- `/settings` - Benutzereinstellungen
- `/admin` - Benutzerverwaltung (nur Admins)
- `/datenschutz` - Datenschutzerklärung (öffentlich)

**Features:**
- Live-Updates via Server-Sent Events (SSE)
- Responsive Design (Mobile-optimiert)
- Filterbare Einsatzlisten
- Interaktive Karte mit Markern

### 2. API Backend (Node.js/Express)

**Technologie:** Node.js 20, Express.js, Drizzle ORM, Puppeteer, Pino

**Funktion:** REST API + SSE Server + Scraper

**Hauptmodule:**

| Modul | Beschreibung |
|-------|--------------|
| `lss-scraper.ts` | Headless Browser für Datenextraktion |
| `auth.ts` | Authentifizierung (Login, Sessions, bcrypt) |
| `incidents.ts` | Einsatzverwaltung |
| `alliance-members.ts` | Mitglieder-Tracking |
| `alliance-stats.ts` | Statistik-Erfassung |
| `sse.ts` | Server-Sent Events Broadcasting |
| `data-retention.ts` | Automatische Datenbereinigung |

**API-Struktur:**
```
/api
├── /auth
│   ├── POST /login
│   ├── POST /logout
│   └── GET  /me
├── /incidents
│   └── GET  /
├── /members
│   └── GET  /
├── /stats
│   └── GET  /alliance
├── /admin
│   ├── GET  /users
│   ├── PUT  /users/:id
│   └── DELETE /users/:id
├── /stream (SSE)
└── /health
```

### 3. LSS Scraper (Puppeteer)

**Technologie:** Puppeteer mit Chromium

**Funktion:** Extrahiert Daten aus dem Leitstellenspiel via Headless Browser.

**Datenquellen:**

| Container-ID | Quelle | Kategorie |
|--------------|--------|-----------|
| `#mission_list` | Eigene Einsätze | emergency |
| `#mission_list_krankentransporte` | Eigene Krankentransporte | emergency |
| `#mission_list_alliance` | Verbandseinsätze | emergency |
| `#mission_list_krankentransporte_alliance` | Verbands-Krankentransporte | emergency |
| `#mission_list_sicherheitswache` | Eigene Sicherheitswachen | planned |
| `#mission_list_sicherheitswache_alliance` | Verbands-Sicherheitswachen | planned |
| `#mission_list_alliance_event` | Großschadenslagen | event |

**Scrape-Loops:**

| Loop | Intervall | Funktion |
|------|-----------|----------|
| Mission Scrape | 1-10s (konfigurierbar) | Einsätze extrahieren |
| Member Tracking | 5-60s (konfigurierbar) | Online-Status prüfen |
| Alliance Stats | 5 min | Verbandsstatistiken |

**Verhalten:**
- Automatischer Login mit konfigurierten Credentials
- Re-Login bei Session-Ablauf
- Retry bei Fehlern (max. 3 Versuche)
- Nur freigegebene eigene Einsätze werden erfasst (`panel-success`)

### 4. PostgreSQL Database

**Technologie:** PostgreSQL 16

**Funktion:** Persistente Datenspeicherung

**Schema:** Siehe [data-model.md](data-model.md)

**Features:**
- JSONB für flexible Rohdaten
- Indizes für performante Abfragen
- Volume für Datenpersistenz
- Automatische Backups (via setup.sh)

---

## Datenfluss

### 1. Scrape Flow

```
1. Scraper startet Chromium
2. Login auf leitstellenspiel.de mit Credentials
3. Navigation zur Hauptseite
4. Loop:
   a. DOM-Extraktion aus allen Mission Lists
   b. Filterung: nur freigegebene eigene Einsätze
   c. Detail-Seiten laden (für Koordinaten/Teilnehmer)
   d. Upsert in PostgreSQL
   e. SSE Broadcast an verbundene Clients
   f. Warten auf nächstes Intervall
```

### 2. Member Tracking Flow

```
1. HTTP Request zu /api/allianceinfo (mit Session-Cookies)
2. Parse JSON Response (Member-Liste mit Online-Status)
3. Vergleich mit DB:
   - Neue Member → INSERT
   - Status geändert → UPDATE + Activity Log
4. SSE Broadcast: members Event
```

### 3. Stats Flow

```
1. HTTP Request zu /api/allianceinfo
2. Parse: rank, credits, users_online, users_total
3. INSERT in alliance_stats
4. Berechne Änderungen (vs. letzter Eintrag)
5. SSE Broadcast: alliance_stats Event
```

### 4. Auth Flow

```
1. User: POST /api/auth/login {lssName, password}
2. Server: Prüfe Credentials (bcrypt.compare)
3. Server: Erstelle Session (random token, 24h TTL)
4. Client: Speichere Token in localStorage
5. Client: Alle Requests mit Header "Authorization: Bearer <token>"
6. Server: Middleware prüft Token bei jedem Request
```

### 5. SSE Flow

```
1. Client: EventSource('/api/stream')
2. Server: Registriert Client
3. Bei Datenänderung:
   - Server: Sendet Event an alle Clients
   - Client: Empfängt Event, updated State
4. Heartbeat alle 30s (Verbindung prüfen)
5. Client disconnect: Automatisch entfernt
```

---

## Sicherheit

### Authentifizierung
- Passwörter mit bcrypt gehasht (Kostenfaktor 10)
- Sessions mit zufälligen Tokens (32 Bytes)
- Token-Ablauf nach 24 Stunden
- Automatische Session-Bereinigung

### Rate Limiting
- 500 Requests/15min allgemein
- 10 Login-Versuche/15min
- Erfolgreiche Logins nicht gezählt

### CORS
- Konfigurierbar via `CORS_ORIGIN`
- Nur angegebene Domains erlaubt
- Credentials erlaubt

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- HSTS via nginx

### Netzwerk
- PostgreSQL nur intern erreichbar (kein Port-Mapping)
- Firewall: nur 22, 80, 443 offen

---

## Skalierung

Das System ist für kleine bis mittlere Verbände optimiert:

| Metrik | Kapazität |
|--------|-----------|
| Benutzer | 10-50 gleichzeitig |
| Einsätze | < 1000 aktiv |
| SSE Clients | < 100 |
| Scrape-Rate | 1 Request/Sekunde |

**Limitierungen:**
- Single-Node (kein Cluster)
- Keine horizontale Skalierung
- Browser-basiertes Scraping (ressourcenintensiv)

**Für größere Installationen:**
- Scrape-Intervall erhöhen
- Data Retention verkürzen
- Mehr RAM für Chromium
