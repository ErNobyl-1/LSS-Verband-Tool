# Runbook - LSS Verband Tool

## Voraussetzungen

- Docker & Docker Compose installiert
- Leitstellenspiel Account (E-Mail und Passwort)
- Node.js 20+ (nur für lokale Entwicklung ohne Docker)

## Quickstart

### 1. Repository klonen

```bash
git clone <repo-url>
cd LSS-Verband-Tool
```

### 2. Environment konfigurieren

```bash
# .env erstellen
cp .env.example .env

# LSS Login-Daten eintragen (PFLICHT!)
# nano .env
```

**Wichtige Einstellungen in `.env`:**

```env
# Leitstellenspiel Login (PFLICHT)
LSS_EMAIL=deine-email@example.com
LSS_PASSWORD=dein-passwort

# Optional: Scrape-Intervall anpassen (Standard: 10 Sekunden)
LSS_SCRAPE_INTERVAL_MS=10000

# Optional: Headless deaktivieren zum Debuggen
LSS_HEADLESS=true
```

### 3. Docker Container starten

```bash
# Alle Services starten (mit Build)
docker-compose up -d --build

# Logs verfolgen
docker-compose logs -f

# Nur API Logs (zeigt Scraper-Status)
docker-compose logs -f api
```

### 4. Services aufrufen

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001

## Betrieb

### Services verwalten

```bash
# Status prüfen
docker-compose ps

# Stoppen
docker-compose stop

# Starten
docker-compose start

# Komplett herunterfahren (behält Volumes)
docker-compose down

# Komplett herunterfahren + Volumes löschen
docker-compose down -v

# Einzelnen Service neustarten
docker-compose restart api
```

### Logs

```bash
# Alle Logs
docker-compose logs -f

# Nur API (inkl. Scraper)
docker-compose logs -f api

# Nur Web
docker-compose logs -f web

# Letzte 100 Zeilen
docker-compose logs --tail=100 api
```

### Scraper Status

Der Scraper loggt seinen Status:

```
[LSS-Scraper] Starting...
[LSS-Scraper] Scrape interval: 10000ms
[LSS-Scraper] Headless mode: true
[LSS-Scraper] Launching browser...
[LSS-Scraper] Using Chromium at: /usr/bin/chromium
[LSS-Scraper] Browser launched
[LSS-Scraper] Navigating to LSS...
[LSS-Scraper] Login attempt 1/3
[LSS-Scraper] Login successful
[LSS-Scraper] Starting scrape loop
[LSS-Scraper] Synced 42 missions (10 new, 32 updated)
[LSS-Scraper] Stats: Notfälle(E:5/V:25) Geplant(E:2/V:8) GSL:2 | Total:42 Skipped:15
```

### Datenbank

**Via psql:**
```bash
docker-compose exec postgres psql -U lss -d lss_tool

# Beispiel-Queries
\dt                           # Tabellen anzeigen
SELECT COUNT(*) FROM incidents;
SELECT * FROM incidents LIMIT 10;
\q                           # Beenden
```

### Backup & Restore

```bash
# Backup
docker-compose exec postgres pg_dump -U lss lss_tool > backup.sql

# Restore
docker-compose exec -T postgres psql -U lss lss_tool < backup.sql
```

## Debugging

### Scraper debuggen

**Headless deaktivieren (für visuelles Debugging):**
```env
# In .env
LSS_HEADLESS=false
```

Dann Container neu starten - der Browser wird sichtbar gestartet (funktioniert nur auf Systemen mit GUI).

**Häufige Probleme:**

| Problem | Log-Meldung | Lösung |
|---------|-------------|--------|
| Login fehlgeschlagen | "Login failed" | LSS_EMAIL/LSS_PASSWORD in .env prüfen |
| Max Login versucht | "Max login attempts reached" | Credentials prüfen, evtl. Captcha im Spiel |
| Scraper startet nicht | "Missing LSS_EMAIL or LSS_PASSWORD" | .env Datei prüfen |
| Session abgelaufen | "Session expired, re-logging in..." | Normal, Scraper loggt sich automatisch neu ein |
| Browser-Fehler | "Failed to launch browser" | Container neu starten, shm_size prüfen |

### API debuggen

```bash
# Health Check
curl http://localhost:3001/api/health

# Incidents abrufen
curl "http://localhost:3001/api/incidents?limit=5"

# Nach Kategorie filtern
curl "http://localhost:3001/api/incidents?category=emergency"

# Nach Quelle filtern
curl "http://localhost:3001/api/incidents?source=alliance"
```

### Web UI debuggen

1. Browser Developer Tools (F12)
2. Network Tab → Filter auf `/api/`
3. Console für JavaScript Fehler

## Entwicklung

### Ohne Docker (für schnelleres Iterieren)

**Backend:**
```bash
cd apps/api
npm install

# Lokale DB erforderlich oder Docker nur für Postgres
docker-compose up -d postgres

# Environment setzen
export DATABASE_URL="postgresql://lss:lss_secret_password@localhost:5432/lss_tool"
export LSS_EMAIL="deine-email@example.com"
export LSS_PASSWORD="dein-passwort"

# Migration & Start
npm run db:migrate
npm run dev
```

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

### Hot Reload

- **API**: Änderungen in `/apps/api/src` werden automatisch erkannt (tsx watch)
- **Web**: Vite HMR für instant updates

### Datenbank-Schema ändern

```bash
cd apps/api

# Schema in src/db/schema.ts bearbeiten

# Migration generieren (Drizzle Kit)
npm run db:generate

# Migration ausführen
npm run db:migrate

# Oder direkt pushen (Dev only!)
npm run db:push
```

## Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker-compose logs api

# Container manuell starten für Fehlerausgabe
docker-compose up api
```

### "Cannot connect to database"

```bash
# Postgres läuft?
docker-compose ps postgres

# Postgres Logs
docker-compose logs postgres

# Connection testen
docker-compose exec postgres pg_isready -U lss
```

### Browser/Chromium Fehler

```bash
# Container hat genug Shared Memory?
# In docker-compose.yml sollte sein: shm_size: '2gb'

# Container komplett neu bauen
docker-compose down
docker-compose build --no-cache api
docker-compose up -d
```

### "Port already in use"

```bash
# Welcher Prozess nutzt den Port?
netstat -tulpn | grep 3001

# Anderen Port verwenden
# In .env: API_PORT=3002
```

### Login funktioniert nicht

1. Credentials in `.env` prüfen
2. Manuell im Browser bei Leitstellenspiel einloggen (evtl. Captcha)
3. Container neu starten

### Daten zurücksetzen

```bash
# Nur incidents löschen
docker-compose exec postgres psql -U lss -d lss_tool -c "DELETE FROM incidents;"

# Komplette DB neu aufsetzen
docker-compose down -v
docker-compose up -d --build
```

## Performance Tipps

- Bei vielen Einsätzen: Filter in der Web UI nutzen
- Scrape-Intervall erhöhen wenn weniger Aktualität benötigt: `LSS_SCRAPE_INTERVAL_MS=30000`
- Alte Daten gelegentlich bereinigen:
  ```sql
  DELETE FROM incidents WHERE last_seen_at < NOW() - INTERVAL '7 days';
  ```
