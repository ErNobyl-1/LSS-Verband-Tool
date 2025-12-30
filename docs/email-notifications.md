# E-Mail-Benachrichtigungen

Das LSS-Verband-Tool kann automatisch E-Mails bei kritischen Fehlern und Problemen senden.

## Funktionen

Die E-Mail-Benachrichtigungen werden automatisch versendet bei:

- **Kritischen Fehlern**: Server-Abstürze, Scraper-Fehler, Datenbank-Probleme
- **Login-Problemen**: Fehlgeschlagene LSS-Login-Versuche (ab 2. Versuch)
- **Wartungsproblemen**: Fehler bei Session-Cleanup oder Data-Retention-Jobs
- **API-Fehlern**: Unbehandelte Fehler in API-Requests

## SMTP-Konfiguration

### 1. Umgebungsvariablen

Füge die folgenden Variablen zu deiner `.env`-Datei hinzu:

```env
# Email Notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=LSS Verband Tool <your-email@gmail.com>
ALERT_EMAIL=admin@example.com
```

### 2. SMTP-Anbieter Beispiele

#### Gmail

1. Aktiviere 2-Faktor-Authentifizierung in deinem Google-Konto
2. Erstelle ein App-Passwort: https://myaccount.google.com/apppasswords
3. Verwende das App-Passwort als `SMTP_PASSWORD`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=deine-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_FROM=LSS Verband Tool <deine-email@gmail.com>
ALERT_EMAIL=admin@example.com
```

#### Outlook/Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=deine-email@outlook.com
SMTP_PASSWORD=dein-passwort
SMTP_FROM=LSS Verband Tool <deine-email@outlook.com>
ALERT_EMAIL=admin@example.com
```

#### Custom SMTP Server

```env
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASSWORD=secure-password
SMTP_FROM=LSS Verband Tool <noreply@example.com>
ALERT_EMAIL=admin@example.com
```

### 3. Port-Erklärung

- **Port 587**: STARTTLS (empfohlen) - `SMTP_SECURE=false`
- **Port 465**: SSL/TLS - `SMTP_SECURE=true`
- **Port 25**: Unverschlüsselt (nicht empfohlen) - `SMTP_SECURE=false`

## Benachrichtigungstypen

### Kritische Fehler (Priority: High)

Werden gesendet bei:
- Server-Start-Fehlern
- Scraper-Crashes
- Maximale Login-Versuche erreicht
- Datenbank-Migrationsfehlern

Beispiel-E-Mail:
```
Subject: 🚨 Critical Error - LSS Verband Tool

A critical error occurred in the LSS Verband Tool:

Error: Max login attempts reached

Context:
  component: LSS Scraper
  loginAttempts: 3
  maxAttempts: 3
```

### Warnungen (Priority: Normal)

Werden gesendet bei:
- Login-Fehlern (ab 2. Versuch)
- Session-Cleanup-Problemen
- Data-Retention-Fehlern

Beispiel-E-Mail:
```
Subject: ⚠️ Warning - LSS Verband Tool

Warning from LSS Verband Tool:

LSS Login failed

Details:
  attempt: 2
  maxAttempts: 3
  reason: Invalid credentials
```

### Informationen (Priority: Low)

Werden gesendet bei:
- Geplanten Wartungsarbeiten
- Erfolgreichen wichtigen Operationen

## Testen der E-Mail-Konfiguration

Beim Server-Start wird automatisch die SMTP-Verbindung getestet. Überprüfe die Logs:

```bash
# Erfolgreiche Konfiguration
[INFO] Email notifications enabled
[INFO] SMTP connection verified successfully
[INFO] Email service verified and ready

# Fehlerhafte Konfiguration
[WARN] Email service configured but connection verification failed
```

## Deaktivierung

Lasse die SMTP-Variablen einfach leer oder entferne sie aus der `.env`-Datei:

```env
# Email Notifications disabled
# SMTP_HOST=
# SMTP_PORT=
# ...
```

Der Server läuft normal weiter, E-Mail-Benachrichtigungen werden nur nicht gesendet.

## Logging

Alle E-Mail-Versandversuche werden im Server-Log festgehalten:

```bash
# Erfolgreicher Versand
[INFO] Email notification sent { messageId: '...' }

# Fehlgeschlagener Versand
[ERROR] Failed to send email notification { error: '...' }
```

## Sicherheitshinweise

- Verwende **nie** dein Haupt-E-Mail-Passwort direkt
- Nutze App-Passwörter (Gmail) oder dedizierte SMTP-Accounts
- Stelle sicher, dass die `.env`-Datei **nicht** ins Git-Repository committed wird
- Verwende verschlüsselte Verbindungen (STARTTLS oder SSL/TLS)
- Setze `ALERT_EMAIL` auf eine überwachte E-Mail-Adresse

## Troubleshooting

### E-Mails werden nicht versendet

1. Überprüfe die SMTP-Zugangsdaten
2. Prüfe die Server-Logs auf Fehler
3. Teste die Verbindung mit einem SMTP-Client (z.B. `telnet smtp.gmail.com 587`)
4. Stelle sicher, dass der Server ausgehende SMTP-Verbindungen erlaubt

### Gmail: "Less secure app access"

Gmail blockiert standardmäßig App-Passwörter ohne 2FA:
1. Aktiviere 2-Faktor-Authentifizierung
2. Erstelle ein App-Passwort unter https://myaccount.google.com/apppasswords

### Outlook: "Authentication failed"

Stelle sicher, dass:
1. SMTP-Authentifizierung aktiviert ist
2. Der Account keine Zwei-Faktor-Authentifizierung ohne App-Passwort hat
3. Der Port 587 verwendet wird

## Beispiel: Docker Compose Integration

```yaml
services:
  api:
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_SECURE=false
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
      - SMTP_FROM=LSS Tool <${SMTP_USER}>
      - ALERT_EMAIL=${ADMIN_EMAIL}
```

Dann in der `.env`-Datei:
```env
SMTP_USER=deine-email@gmail.com
SMTP_PASSWORD=app-password
ADMIN_EMAIL=admin@example.com
```
