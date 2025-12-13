# Runbook - LSS Verband Tool

Betriebshandbuch für Administratoren.

## Voraussetzungen

### Für lokale Entwicklung
- Docker Desktop oder Docker + Docker Compose
- Leitstellenspiel Account (E-Mail und Passwort)
- Git

### Für Server-Deployment
- VPS/Root-Server mit min. 512MB RAM (2GB empfohlen)
- Debian 12/13 oder Rocky Linux 9
- Domain mit A-Record auf Server-IP
- Root-Zugang

> **Hinweis:** Das Setup verwendet fertige Docker-Images von GitHub Container Registry. Es wird nichts auf dem Server gebaut.

---

## Installation

### Lokal (Entwicklung)

```bash
# 1. Repository klonen
git clone https://github.com/ErNobyl-1/LSS-Verband-Tool.git
cd LSS-Verband-Tool

# 2. Konfiguration erstellen
cp .env.example .env

# 3. .env bearbeiten
nano .env
# Mindestens setzen:
# - LSS_EMAIL
# - LSS_PASSWORD
# - ADMIN_PASSWORD
# - POSTGRES_PASSWORD

# 4. Container starten
docker-compose up -d --build

# 5. Logs prüfen
docker-compose logs -f
```

### Server (Produktion)

```bash
# Als root auf dem Server:
curl -O https://raw.githubusercontent.com/ErNobyl-1/LSS-Verband-Tool/main/setup.sh
chmod +x setup.sh
./setup.sh
```

Das Script fragt interaktiv nach:
- Domain (z.B. `verband.example.de`)
- E-Mail für Let's Encrypt
- LSS-Zugangsdaten
- Admin-Passwort

---

## Täglicher Betrieb

### Services prüfen

```bash
# Status aller Container
docker compose ps

# Sollte zeigen:
# NAME              STATUS
# lss-api           Up (healthy)
# lss-web           Up
# lss-postgres      Up (healthy)
# lss-uptime-kuma   Up (healthy)
```

### Logs anzeigen

```bash
# Alle Logs (live)
docker compose logs -f

# Nur API (inkl. Scraper)
docker compose logs -f api

# Letzte 100 Zeilen
docker compose logs --tail=100 api

# Nach Fehlern suchen
docker compose logs api 2>&1 | grep -i error
```

### Health Check

```bash
# API Health
curl http://localhost:3001/api/health

# Oder von außen (mit Domain)
curl https://verband.example.de/api/health
```

**Gesunde Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {"status": "up"},
    "scraper": {"status": "running", "details": {"browserConnected": true}},
    "memory": {"status": "ok"}
  }
}
```

---

## Services verwalten

### Container-Befehle

```bash
cd /opt/lss-verband-tool  # Server
cd LSS-Verband-Tool       # Lokal

# Alle neustarten
docker compose restart

# Einzelnen Service neustarten
docker compose restart api

# Stoppen (Volumes bleiben)
docker compose down

# Komplett neu bauen
docker compose up -d --build

# Alles löschen (inkl. Datenbank!)
docker compose down -v
```

### Updates

**Server (Produktion):**
```bash
cd /opt/lss-verband-tool
./update.sh
```

**Lokal (Entwicklung):**
```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

---

## Benutzerverwaltung

### Admin-Login

1. Öffne `https://your-domain.de` im Browser
2. Login mit:
   - **Benutzername:** Wert von `ADMIN_USERNAME` (default: `admin`)
   - **Passwort:** Wert von `ADMIN_PASSWORD` aus `.env`

### Neuen Benutzer freischalten

1. Benutzer registriert sich auf der Login-Seite
2. Admin geht zu `/admin`
3. Findet den Benutzer in der Liste
4. Klickt "Bearbeiten"
5. Setzt "Aktiv" auf Ja
6. Optional: Anzeigename und Badge-Farbe setzen
7. Optional: LSS-Mitglied zuordnen (für "Meine Einsätze")
8. Speichern

### Benutzer löschen

1. Admin geht zu `/admin`
2. Findet den Benutzer
3. Klickt "Löschen"
4. Bestätigt

### Passwort zurücksetzen

Aktuell gibt es keine "Passwort vergessen" Funktion. Workaround:

```bash
# Benutzer löschen und neu registrieren lassen
docker compose exec postgres psql -U lss -d lss_tool -c \
  "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE lss_name = 'USERNAME');"
docker compose exec postgres psql -U lss -d lss_tool -c \
  "DELETE FROM users WHERE lss_name = 'USERNAME';"
```

---

## Datenbank

### Zugriff

```bash
# Postgres CLI
docker compose exec postgres psql -U lss -d lss_tool

# Beispiel-Queries:
\dt                              # Tabellen anzeigen
SELECT COUNT(*) FROM incidents;  # Einsätze zählen
SELECT * FROM users;             # Benutzer auflisten
\q                               # Beenden
```

### Backup

```bash
# Manuelles Backup
docker compose exec postgres pg_dump -U lss lss_tool > backup_$(date +%Y%m%d).sql

# Automatische Backups (Server):
# Liegen in /opt/lss-verband-tool/backups/
ls -la /opt/lss-verband-tool/backups/
```

### Restore

```bash
# Achtung: Überschreibt alle Daten!
docker compose exec -T postgres psql -U lss lss_tool < backup.sql
```

### Daten löschen

```bash
# Alle Einsätze löschen
docker compose exec postgres psql -U lss -d lss_tool -c "DELETE FROM incidents;"

# Alle Sessions löschen (loggt alle aus)
docker compose exec postgres psql -U lss -d lss_tool -c "DELETE FROM sessions;"

# Komplette DB zurücksetzen
docker compose down -v
docker compose up -d --build
```

---

## Troubleshooting

### Scraper startet nicht

**Symptom:** Keine "Missions synced" Logs

**Prüfung:**
```bash
docker compose logs api | grep -i scraper
```

**Ursachen & Lösungen:**

| Log-Meldung | Ursache | Lösung |
|-------------|---------|--------|
| "Missing LSS_EMAIL or LSS_PASSWORD" | Credentials fehlen | `.env` prüfen |
| "Login failed" | Falsche Credentials | Passwort prüfen |
| "Max login attempts reached" | Captcha im Spiel | Manuell einloggen |
| "Failed to launch browser" | Chromium-Problem | Container neu bauen |

### Login im Tool funktioniert nicht

**Prüfung:**
```bash
# Session-Cookie prüfen
curl -v https://your-domain.de/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Lösungen:**
- Browser-Cache löschen
- Sessions in DB löschen: `DELETE FROM sessions;`
- Container neustarten

### Keine Live-Updates

**Prüfung:**
```bash
# SSE-Verbindung testen
curl -N https://your-domain.de/api/stream \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ursachen:**
- Proxy-Buffering (nginx)
- Timeout zu kurz
- Firewall blockiert

### "Verbindungsfehler" im Browser

**Prüfung:**
```bash
# CORS prüfen
curl -I https://your-domain.de/api/health \
  -H "Origin: https://your-domain.de"

# Sollte zeigen:
# Access-Control-Allow-Origin: https://your-domain.de
```

**Lösung:** CORS_ORIGIN in `.env` prüfen

### Container crashed

**Prüfung:**
```bash
docker compose ps
docker compose logs api | tail -50
```

**Häufige Ursachen:**
- Out of Memory → Mehr RAM oder weniger Services
- DB-Verbindung fehlgeschlagen → Postgres Status prüfen
- Port bereits belegt → `netstat -tulpn | grep 3001`

### Hohe CPU/RAM

**Prüfung:**
```bash
docker stats
```

**Optimierungen:**
- `LSS_SCRAPE_INTERVAL_MS` erhöhen (z.B. 30000)
- `LSS_MEMBER_TRACKING_INTERVAL_MS` erhöhen (z.B. 60000)
- Alte Daten löschen

---

## Monitoring

### Health-Endpoint

```bash
# Vollständiger Health Check
curl -s http://localhost:3001/api/health | jq .
```

**Metriken:**
- `status`: healthy/unhealthy
- `checks.database`: up/down
- `checks.scraper`: running/stopped
- `checks.memory`: ok/warning/critical
- `stats.sseClients`: Anzahl verbundener Clients

### Uptime Kuma

1. Öffne `https://your-domain.de/status/`
2. Initiales Setup beim ersten Aufruf
3. Monitor hinzufügen:
   - **Type:** HTTP(s)
   - **URL:** `http://api:3001/api/health`
   - **Interval:** 60 Sekunden
4. Benachrichtigungen konfigurieren (Discord, Telegram, etc.)

### Log-Analyse

```bash
# Fehler der letzten Stunde
docker compose logs --since 1h api 2>&1 | grep -i error

# Scraper-Statistiken
docker compose logs api 2>&1 | grep "Missions synced" | tail -20

# Member-Tracking
docker compose logs api 2>&1 | grep "Members synced" | tail -20
```

---

## Wartung

### Automatische Wartung

Das System führt automatisch aus:
- **Stündlich:** Abgelaufene Sessions löschen
- **Täglich 3:00:** Datenbank-Backup (Server)
- **Täglich 4:00:** Data Retention (alte Daten löschen)

### Manuelle Wartung

```bash
# Logs rotieren (Docker macht das automatisch)
docker compose logs api --tail=1000

# Unbenutzte Docker-Ressourcen löschen
docker system prune -f

# Alte Backups löschen (älter als 30 Tage)
find /opt/lss-verband-tool/backups -name "*.sql" -mtime +30 -delete
```

---

## Notfall-Prozeduren

### Scraper hängt

```bash
# API neustarten (Scraper startet mit)
docker compose restart api
```

### Datenbank korrupt

```bash
# Letztes Backup wiederherstellen
docker compose down
docker compose up -d postgres
docker compose exec -T postgres psql -U lss lss_tool < /opt/lss-verband-tool/backups/latest.sql
docker compose up -d
```

### Server-Migration

```bash
# Auf altem Server:
docker compose exec postgres pg_dump -U lss lss_tool > backup.sql
scp backup.sql newserver:/tmp/

# Auf neuem Server:
./setup.sh
docker compose exec -T postgres psql -U lss lss_tool < /tmp/backup.sql
```

### Alles kaputt

```bash
# Kompletter Reset (alle Daten gehen verloren!)
docker compose down -v
docker system prune -af
git pull
docker compose up -d --build
```
