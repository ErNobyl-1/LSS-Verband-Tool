# LSS-Verband-Tool

Ein selbst gehostetes Tool zur Echtzeit-Übersicht und Verwaltung von Verbandseinsätzen im Browsergame [Leitstellenspiel.de](https://www.leitstellenspiel.de).

> **Hinweis:** Dies ist ein unabhängiges Fan-Projekt und steht in keiner Verbindung zum Entwickler des Leitstellenspiels.

## Was macht dieses Tool?

Das Tool extrahiert automatisch Verbandseinsätze aus dem Leitstellenspiel und stellt sie in einem übersichtlichen Dashboard dar - mit Live-Updates, Kartenansicht und Statistiken.

**Hauptfunktionen:**
- **Live-Dashboard** mit allen Verbandseinsätzen (Notfälle, geplante Einsätze, Großschadenslagen)
- **Kartenansicht** mit allen Einsatzorten auf einer interaktiven Karte
- **Statistik-Seite** mit Verbandsstatistiken und Credits-Verlauf
- **Mitglieder-Status** - Wer ist gerade online? (Echtzeit-Updates alle 5 Sekunden)
- **Benutzerverwaltung** - Nur freigeschaltete Verbandsmitglieder haben Zugriff
- **Mobile-optimiert** - Funktioniert auf Smartphone und Tablet

## Screenshots

*(Hier könnten Screenshots eingefügt werden)*

## Quickstart (Lokal)

```bash
# 1. Repository klonen
git clone https://github.com/ErNobyl-1/LSS-Verband-Tool.git
cd LSS-Verband-Tool

# 2. Konfiguration erstellen
cp .env.example .env

# 3. In .env die Pflichtfelder ausfüllen:
#    - LSS_EMAIL und LSS_PASSWORD (Leitstellenspiel-Login)
#    - ADMIN_PASSWORD (für den Admin-Account)
#    - POSTGRES_PASSWORD (Datenbank-Passwort)

# 4. Starten
docker-compose up -d --build

# 5. Öffnen
# Dashboard: http://localhost:3000
# API: http://localhost:3001
```

## Server-Deployment (Produktion)

Für den Betrieb auf einem öffentlichen Server steht ein automatisches Setup-Script bereit.

### Voraussetzungen
- **Server**: VPS oder Root-Server mit min. 512MB RAM (2GB empfohlen)
- **OS**: Debian 12/13 (empfohlen) oder Rocky Linux 9
- **Domain**: Eine Domain mit A-Record auf die Server-IP

> **Hinweis:** Das Setup verwendet fertige Docker-Images von GitHub Container Registry. Es wird nichts auf dem Server gebaut, daher reicht auch ein kleiner Server mit wenig RAM.

### Installation

```bash
# 1. Als root auf dem Server einloggen
ssh root@<server-ip>

# 2. Setup-Script herunterladen und ausführen
curl -O https://raw.githubusercontent.com/ErNobyl-1/LSS-Verband-Tool/main/setup.sh
chmod +x setup.sh
./setup.sh
```

Das Script richtet automatisch ein:
- System-Hardening (Firewall, fail2ban, SSH-Härtung)
- Docker + Docker Compose
- nginx als Reverse Proxy mit Let's Encrypt SSL
- Uptime Kuma für Status-Monitoring (`/status/`)
- Automatische Sicherheitsupdates
- Tägliche Datenbank-Backups (3:00 Uhr)

### Nach dem Setup

1. **Passwörter notieren** - werden am Ende des Scripts angezeigt
2. **LSS-Zugangsdaten** in `/opt/lss-verband-tool/.env` eintragen
3. **Container neustarten**: `docker compose restart`
4. **Zukünftig** als `deploy` User einloggen (hat sudo + Docker Rechte)

## Konfiguration

Alle Einstellungen erfolgen über die `.env` Datei:

### Pflichtfelder

| Variable | Beschreibung |
|----------|--------------|
| `LSS_EMAIL` | Deine Leitstellenspiel E-Mail-Adresse |
| `LSS_PASSWORD` | Dein Leitstellenspiel Passwort |
| `ADMIN_PASSWORD` | Passwort für den Admin-Account |
| `POSTGRES_PASSWORD` | Datenbank-Passwort (mindestens 32 Zeichen empfohlen) |
| `CORS_ORIGIN` | Erlaubte Domain(s) für API-Zugriff, z.B. `https://verband.example.de` |

### Optionale Einstellungen

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `LSS_SCRAPE_INTERVAL_MS` | 10000 | Wie oft Einsätze abgerufen werden (in ms) |
| `LSS_MEMBER_TRACKING_INTERVAL_MS` | 60000 | Wie oft Online-Status aktualisiert wird (in ms) |
| `LSS_ALLIANCE_STATS_INTERVAL_MS` | 300000 | Wie oft Verbandsstatistiken abgerufen werden (5 min) |
| `LSS_HEADLESS` | true | Browser ohne GUI starten |
| `LSS_EXCLUDED_MEMBERS` | - | Kommaseparierte Liste von auszuschließenden Mitgliedern |
| `ADMIN_USERNAME` | admin | Benutzername des Admin-Accounts |
| `LOG_LEVEL` | info | Log-Level (fatal/error/warn/info/debug/trace) |

### Datenaufbewahrung

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `DATA_RETENTION_INCIDENTS_DAYS` | 4 | Einsätze werden nach X Tagen gelöscht |
| `DATA_RETENTION_ACTIVITY_DAYS` | 30 | Online/Offline-Logs nach X Tagen gelöscht |
| `DATA_RETENTION_STATS_AGGREGATE_DAYS` | 30 | Stats werden nach X Tagen aggregiert (1/Tag) |

## Benutzerverwaltung

Das Tool verwendet ein eigenes Authentifizierungssystem:

### Admin-Account
- Wird automatisch beim Start erstellt/aktualisiert
- Benutzername: `ADMIN_USERNAME` (default: "admin")
- Passwort: `ADMIN_PASSWORD` aus der `.env`

### Verbandsmitglieder
1. Mitglied ruft die Seite auf und gibt LSS-Name + selbstgewähltes Passwort ein
2. Account wird erstellt, ist aber **nicht aktiv**
3. Admin geht auf `/admin` und schaltet den Account frei
4. Admin kann optional einen Anzeigenamen vergeben (z.B. echter Vorname)
5. Admin kann das Mitglied einem LSS-Mitglied zuordnen (für "Meine Einsätze" Hervorhebung)

### Passwort-Anforderungen
- Mindestens 8 Zeichen
- Mindestens ein Buchstabe
- Mindestens eine Zahl
- Mindestens ein Sonderzeichen

## Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Environment                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 API Service (Node.js)                     │   │
│  │                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │   LSS Scraper   │  │      REST API + SSE         │    │   │
│  │  │   (Puppeteer)   │  │   - /api/incidents          │    │   │
│  │  │                 │  │   - /api/members            │    │   │
│  │  │  Extrahiert:    │  │   - /api/stats              │    │   │
│  │  │  - Einsätze     │  │   - /api/stream (Live)      │    │   │
│  │  │  - Mitglieder   │  │   - /api/auth               │    │   │
│  │  │  - Statistiken  │  │   - /api/admin              │    │   │
│  │  └─────────────────┘  └─────────────────────────────┘    │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                                │
│  ┌──────────────────────────────┴───────────────────────────┐   │
│  │                   PostgreSQL Database                     │   │
│  │  - incidents, users, sessions                             │   │
│  │  - alliance_members, member_activity_log                  │   │
│  │  - alliance_stats                                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                 │                                │
│  ┌──────────────────────────────┴───────────────────────────┐   │
│  │                 Web Frontend (React + Vite)               │   │
│  │  - Dashboard mit Filtern                                  │   │
│  │  - Kartenansicht (MapLibre GL)                           │   │
│  │  - Statistiken (Chart.js)                                 │   │
│  │  - Live-Updates via SSE                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Uptime Kuma (Status-Monitoring)              │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Dokumentation

Detaillierte Dokumentation findest du im `/docs` Ordner:

- [Architektur](docs/architecture.md) - Technische Details zur Systemarchitektur
- [API Referenz](docs/api.md) - Alle API-Endpunkte mit Beispielen
- [Datenmodell](docs/data-model.md) - Datenbankschema und Tabellen
- [Runbook](docs/runbook.md) - Betriebshandbuch für Admins

## Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Scraping**: Puppeteer + Chromium
- **Logging**: Pino

### Frontend
- **Framework**: React 18
- **Build**: Vite
- **Styling**: TailwindCSS
- **Maps**: MapLibre GL JS
- **Charts**: Chart.js

### Infrastructure
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: nginx
- **SSL**: Let's Encrypt (Certbot)
- **Monitoring**: Uptime Kuma

## Sicherheit

- **Passwörter** werden mit bcrypt gehasht (nicht im Klartext gespeichert)
- **Sessions** sind zeitlich begrenzt und werden automatisch bereinigt
- **Rate Limiting** schützt gegen Brute-Force (500 Req/15min allgemein, 10 Login-Versuche/15min)
- **CORS** ist auf konfigurierte Domains beschränkt
- **Security Headers** (X-Frame-Options, CSP, HSTS via nginx)
- **Firewall** lässt nur Ports 22, 80, 443 durch
- **fail2ban** sperrt IPs nach fehlgeschlagenen Login-Versuchen

## Troubleshooting

### Scraper startet nicht
```bash
# Logs prüfen
docker-compose logs api

# Häufigste Ursachen:
# - LSS_EMAIL oder LSS_PASSWORD nicht gesetzt
# - Falsches Passwort
# - Captcha im Spiel erforderlich (einmal manuell einloggen)
```

### Login im Tool fehlgeschlagen
```bash
# Container neustarten
docker-compose restart

# Session manuell löschen (falls nötig)
docker-compose exec postgres psql -U lss -d lss_tool -c "DELETE FROM sessions;"
```

### Browser-Fehler im Container
```bash
# Container benötigt ausreichend Shared Memory
# In docker-compose.yml: shm_size: '2gb'

# Komplett neu bauen
docker-compose down
docker-compose up -d --build
```

### Weitere Hilfe
Detaillierte Troubleshooting-Schritte findest du im [Runbook](docs/runbook.md).

## Updates

### Server (Produktion)

```bash
cd /opt/lss-verband-tool
./update.sh
```

Das Update-Script:
- Holt die neueste Version von GitHub
- Lädt die aktuellen Docker-Images
- Startet die Container neu
- Räumt alte Images auf

### Lokal (Entwicklung)

```bash
cd LSS-Verband-Tool
git pull
docker compose up -d --build
```

## Datenschutz (DSGVO)

Das Tool enthält eine integrierte Datenschutzerklärung unter `/datenschutz`:

- **Gespeicherte Daten**: LSS-Name, Passwort (gehasht), Online-Status, Einsatzdaten
- **Speicherdauer**: Einsätze 4 Tage, Aktivitätslogs 30 Tage
- **Keine Weitergabe** an Dritte
- **Nur technisch notwendige Cookies** (Session)

> **Wichtig für Betreiber**: Informiere deine Verbandsmitglieder über die Datenverarbeitung!

## Rechtliche Hinweise

- Dies ist ein **nicht-kommerzielles Fan-Projekt**
- **Kein offizielles Tool** des Leitstellenspiel-Entwicklers
- Die Nutzung erfolgt auf **eigene Verantwortung**
- Der Betreiber dieses Tools ist für die **DSGVO-konforme Nutzung** selbst verantwortlich

## Lizenz

MIT License - siehe [LICENSE](LICENSE)

## Danksagungen

### Open-Source-Bibliotheken

Dieses Projekt nutzt zahlreiche Open-Source-Bibliotheken, darunter:
- [Express.js](https://expressjs.com/) - MIT License
- [React](https://reactjs.org/) - MIT License
- [Puppeteer](https://pptr.dev/) - Apache 2.0 License
- [Drizzle ORM](https://orm.drizzle.team/) - Apache 2.0 License
- [MapLibre GL JS](https://maplibre.org/) - BSD 3-Clause License
- [TailwindCSS](https://tailwindcss.com/) - MIT License
- [Chart.js](https://www.chartjs.org/) - MIT License
- [PostgreSQL](https://www.postgresql.org/) - PostgreSQL License
- [Pino](https://getpino.io/) - MIT License

### Entwicklung

Dieses Projekt wurde größtenteils im Dialog mit **Claude** (Anthropic) entwickelt - quasi ein Pair-Programming mit einem KI-Assistenten, der nie Kaffee braucht und nie müde wird. Allerdings hat Claude auch mehrfach versucht, Features einzubauen, die niemand wollte, und musste regelmäßig daran erinnert werden, dass "einfach" wirklich einfach bedeutet.

Falls du Bugs findest: Das war wahrscheinlich Claude. Falls etwas gut funktioniert: Das war definitiv der menschliche Entwickler.

---

**Made with ~~AI~~ ❤️ in Germany**
