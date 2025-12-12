# LSS-Verband-Tool

Ein lokales Tool zur Extraktion und Visualisierung von Daten aus dem Browsergame "Leitstellenspiel".

## Features

- **Automatische Datenextraktion** via Headless Browser (Puppeteer)
- **REST API** mit SSE-Support für Live-Updates
- **Web Dashboard** mit Filterfunktionen und Kartenansicht
- **Docker-basiert** für einfaches Setup
- **Benutzerverwaltung** - Registrierung mit Admin-Freischaltung

## Quickstart

```bash
# 1. Repository klonen (falls noch nicht geschehen)
git clone <repo-url>
cd LSS-Verband-Tool

# 2. Environment-Datei erstellen und konfigurieren
cp .env.example .env

# 3. LSS Login-Daten und Admin-Passwort in .env eintragen
# LSS_EMAIL=deine-email@example.com
# LSS_PASSWORD=dein-passwort
# ADMIN_PASSWORD=sicheres-admin-passwort

# 4. Docker Container starten
docker-compose up -d --build

# 5. Services aufrufen
# - Web UI: http://localhost:3000
# - API: http://localhost:3001
```

## Authentifizierung

Das Tool verwendet ein Benutzer-System mit Admin-Freischaltung:

1. **Admin-Account**: Wird beim Start automatisch erstellt/aktualisiert
   - Username: aus `ADMIN_USERNAME` (default: "admin")
   - Passwort: aus `ADMIN_PASSWORD`

2. **Benutzer-Registrierung**:
   - Verbandsmitglieder registrieren sich mit LSS-Name und Passwort
   - Nach Registrierung ist der Account NICHT aktiv
   - Admin muss den Account erst freischalten

3. **Admin-Freischaltung** (unter `/admin`):
   - Admin sieht wartende Benutzer
   - Admin kann Benutzer einem Allianz-Mitglied zuordnen
   - Admin kann einen Anzeigenamen setzen (z.B. echter Vorname)

## Konfiguration

Die Konfiguration erfolgt über die `.env` Datei:

| Variable | Beschreibung | Default |
|----------|--------------|---------|
| `LSS_EMAIL` | Leitstellenspiel Login E-Mail | - |
| `LSS_PASSWORD` | Leitstellenspiel Passwort | - |
| `LSS_SCRAPE_INTERVAL_MS` | Intervall der Datenabfrage in ms | 10000 |
| `LSS_HEADLESS` | Headless Browser Modus | true |
| `ADMIN_USERNAME` | Admin-Benutzername | admin |
| `ADMIN_PASSWORD` | Admin-Passwort (erforderlich!) | - |
| `CORS_ORIGIN` | Erlaubte Origins (kommasepariert) | * |
| `LOG_LEVEL` | Log-Level (fatal/error/warn/info/debug/trace) | info |

## Projektstruktur

```
/apps
  /api          # Backend API (Node.js/Express) + LSS Scraper
  /web          # Frontend (React + Vite)
/docs           # Dokumentation
```

## Funktionsweise

1. Der Server startet einen Headless Chromium Browser
2. Der Browser loggt sich automatisch bei Leitstellenspiel ein
3. Alle 10 Sekunden (konfigurierbar) werden die Einsatzdaten extrahiert
4. Die Daten werden in PostgreSQL gespeichert
5. Änderungen werden via SSE live an das Web-Dashboard gestreamt

### Extrahierte Einsätze

- **Notfälle (emergency)**: Eigene freigegebene Einsätze, Verbands-Einsätze, Krankentransporte
- **Geplant (planned)**: Sicherheitswachen
- **Großschadenslagen (event)**: Verbands-Events

## Dokumentation

- [Architektur](docs/architecture.md)
- [API Referenz](docs/api.md)
- [Datenmodell](docs/data-model.md)
- [Runbook](docs/runbook.md)

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL, Drizzle ORM, Puppeteer
- **Frontend**: React, Vite, TailwindCSS, MapLibre GL
- **Infrastructure**: Docker, Docker Compose

## Server Deployment

### Voraussetzungen
- Frischer Server mit **Debian 13** (empfohlen) oder Rocky Linux 9
- Root-Zugang
- Domain die auf den Server zeigt (A-Record)

### Automatisches Setup

```bash
# 1. Als root auf dem Server einloggen
ssh root@<server-ip>

# 2. Setup-Script herunterladen und ausführen
curl -O https://raw.githubusercontent.com/ernobyl/LSS-Verband-Tool/main/setup.sh
chmod +x setup.sh
./setup.sh
```

Das Script installiert und konfiguriert automatisch:
- **System**: Timezone (Europe/Berlin), 2GB Swap, System-Updates
- **Sicherheit**: Firewall (ufw), fail2ban, SSH-Härtung, Deploy-User
- **Docker**: Docker CE + Compose Plugin
- **Web**: nginx Reverse Proxy, Let's Encrypt SSL (Auto-Renewal)
- **Monitoring**: Uptime Kuma unter `/status/` (Status-Page & Alerting)
- **Updates**: Automatische Sicherheitsupdates
- **Backups**: Tägliches DB-Backup (3:00 Uhr), 7 Tage Retention

### Nach dem Setup

1. **Alle Passwörter sicher speichern** (werden am Ende angezeigt):
   - Web-Admin Passwort
   - SSH Deploy-User Passwort
2. LSS-Zugangsdaten in `.env` eintragen falls noch nicht geschehen
3. Container neu starten: `docker compose restart`
4. Zukünftig als `deploy` User einloggen (hat sudo + Docker Rechte)

### Updates

```bash
cd /opt/lss-verband-tool
git pull
docker compose up -d --build
```

### Nützliche Befehle

```bash
cd /opt/lss-verband-tool

# Logs anzeigen
docker compose logs -f

# Nur API Logs
docker compose logs -f api

# Container neustarten
docker compose restart

# Alles stoppen
docker compose down

# Neu bauen und starten
docker compose up -d --build
```

## Troubleshooting

### Scraper startet nicht
- Prüfe ob `LSS_EMAIL` und `LSS_PASSWORD` in `.env` gesetzt sind
- Prüfe die Container-Logs: `docker-compose logs api`

### Login fehlgeschlagen
- Prüfe deine Login-Daten
- Das Spiel könnte ein Captcha verlangen - in dem Fall einmal manuell einloggen

### Browser-Fehler im Container
- Der Container benötigt ausreichend Shared Memory (`shm_size: '2gb'` ist in docker-compose gesetzt)
- Bei Problemen: `docker-compose down && docker-compose up -d --build`

## Production Deployment TODO

Checkliste für das Deployment auf einem echten Server.

### Kritisch (vor Go-Live)

- [x] **CORS einschränken** - `origin: '*'` auf eigene Domain beschränken
  - Konfigurierbar via `CORS_ORIGIN` in `.env`
  - Beispiel: `CORS_ORIGIN=https://verband.ernobyl.de`
  - Mehrere Domains: `CORS_ORIGIN=https://domain1.de,https://domain2.de`

- [ ] **Starke Passwörter setzen** (Nutzer-Aufgabe beim Deployment)
  - `ADMIN_PASSWORD` - min. 16 Zeichen, zufällig generiert
  - `POSTGRES_PASSWORD` - min. 32 Zeichen, zufällig generiert
  - Generieren: `openssl rand -base64 32`

- [x] **Rate Limiting einbauen** - Schutz gegen Brute-Force
  - Allgemein: 500 Requests/15min pro IP
  - Login: 10 Versuche/15min pro IP (erfolgreiche Logins nicht gezählt)

- [x] **Passwort-Anforderungen verschärft**
  - Mindestens 8 Zeichen
  - Mindestens ein Buchstabe
  - Mindestens eine Zahl
  - Mindestens ein Sonderzeichen

### Hoch (sollte gefixt werden)

- [x] **HTTPS einrichten** - Via `setup.sh`
  - nginx + Let's Encrypt (Auto-Renewal)

- [x] **Security Headers hinzufügen**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (keine Kamera/Mikrofon/Geolocation)
  - HSTS wird von nginx gesetzt

- [x] **Firewall konfigurieren** - Via `setup.sh`
  - ufw/firewalld - nur 22, 80, 443 offen

- [x] **Session-Bereinigung automatisieren**
  - Läuft automatisch beim Server-Start
  - Wiederholt sich stündlich

### Mittel (Best Practices)

- [x] **Datenaufbewahrung definieren**
  - Incidents: Löschen nach 4 Tagen
  - Activity-Logs: Löschen nach 30 Tagen
  - Alliance-Stats: Aggregieren nach 30 Tagen (1/Tag), nie löschen
  - Läuft täglich um 4:00 Uhr (nach Backup)

- [x] **Backup-Strategie**
  - Automatisches tägliches Backup (3:00 Uhr)
  - 7 Tage Retention
  - Manuell: `./backup.sh`

- [x] **Monitoring einrichten**
  - Erweiterter Health-Endpoint: `GET /api/health`
  - Prüft: Database, Scraper, Memory, CPU
  - Uptime Kuma integriert unter `/status/`

- [x] **Logging verbessert**
  - Strukturierte JSON-Logs via pino
  - Log-Level steuerbar via `LOG_LEVEL` (fatal, error, warn, info, debug, trace)
  - Request-Logging für HTTP-Endpunkte
  - Docker Log-Rotation (max 50MB für API, max 10MB für andere Services)

### Rechtlich/DSGVO

- [ ] **Verbandsmitglieder informieren** (Nutzer-Aufgabe)
  - Welche Daten werden gespeichert
  - Wer hat Zugriff
  - Wie lange werden Daten aufbewahrt

- [x] **Disclaimer auf Login-Seite**
  - Hinweis auf nicht-kommerzielle Nutzung
  - Klarstellung: Unabhängiges Fan-Projekt, keine Verbindung zum Spielentwickler

- [x] **Datenschutzerklärung**
  - Erreichbar unter `/datenschutz` (auch ohne Login)
  - DSGVO-konform: Datenarten, Zweck, Speicherdauer, Rechte

### Server-Setup

- [x] **Betriebssystem wählen**
  - **Debian 13** (empfohlen) - minimal, sicher, kostenlos

- [x] **Server einrichten** - Alles via `setup.sh`
  - System: Timezone, Swap, Updates
  - Sicherheit: SSH-Härtung, Firewall, fail2ban
  - Docker + Docker Compose
  - nginx + Let's Encrypt SSL
  - Automatische Updates + Backups
  - Uptime Kuma Status-Monitoring

## Lizenz

MIT
