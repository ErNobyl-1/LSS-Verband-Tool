# LSS-Verband-Tool

Ein lokales Tool zur Extraktion und Visualisierung von Daten aus dem Browsergame "Leitstellenspiel".

## Features

- **Automatische Datenextraktion** via Headless Browser (Puppeteer)
- **REST API** mit SSE-Support für Live-Updates
- **Web Dashboard** mit Filterfunktionen und Kartenansicht
- **Docker-basiert** fur einfaches Setup
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

## Lizenz

MIT
