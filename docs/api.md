# API Dokumentation

Base URL: `http://localhost:3001` (lokal) oder `https://your-domain.de` (Produktion)

## Authentifizierung

Die meisten Endpunkte erfordern eine Authentifizierung via Bearer Token.

### Token erhalten

Nach erfolgreichem Login erhältst du einen Token, der bei allen Anfragen im Header mitgesendet werden muss:

```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### POST /api/auth/login

Benutzer einloggen.

**Request Body:**
```json
{
  "lssName": "MeinLSSName",
  "password": "mein-passwort"
}
```

**Response (Erfolg):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "lssName": "MeinLSSName",
      "displayName": "Max",
      "isActive": true,
      "isAdmin": false,
      "allianceMemberId": 123
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Response (Fehler):**
```json
{
  "success": false,
  "error": "InvalidCredentials",
  "message": "Ungültige Anmeldedaten"
}
```

### POST /api/auth/logout

Benutzer ausloggen.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Erfolgreich ausgeloggt"
}
```

### GET /api/auth/me

Aktuelle Benutzerinformationen abrufen.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lssName": "MeinLSSName",
    "displayName": "Max",
    "badgeColor": "#3B82F6",
    "isActive": true,
    "isAdmin": false,
    "allianceMemberId": 123
  }
}
```

---

## Incidents Endpoints

### GET /api/incidents

Einsätze abrufen.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameter:**

| Parameter | Typ    | Beschreibung |
|-----------|--------|--------------|
| category  | string | Filter: `emergency`, `planned`, `event` |
| source    | string | Filter: `own_shared`, `alliance`, `alliance_event` |
| limit     | number | Max. Anzahl (default: 100, max: 1000) |
| offset    | number | Offset für Pagination |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lsId": "mission_123456",
      "title": "Brand in Mehrfamilienhaus",
      "type": "Wohnungsbrand",
      "status": "active",
      "source": "alliance",
      "category": "emergency",
      "lat": 52.5200,
      "lon": 13.4050,
      "address": "Musterstraße 1, 12345 Berlin",
      "startTime": null,
      "endTime": null,
      "participants": ["User1", "User2"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 100,
    "offset": 0
  }
}
```

---

## Members Endpoints

### GET /api/members

Verbandsmitglieder abrufen (mit Online-Status).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 123,
        "name": "Spielername",
        "isOnline": true,
        "lastOnlineAt": "2024-01-15T10:30:00.000Z",
        "lastOfflineAt": "2024-01-15T08:00:00.000Z"
      }
    ],
    "counts": {
      "total": 10,
      "online": 3
    }
  }
}
```

---

## Stats Endpoints

### GET /api/stats/alliance

Verbandsstatistiken abrufen.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameter:**

| Parameter | Typ    | Beschreibung |
|-----------|--------|--------------|
| days      | number | Zeitraum in Tagen (default: 7, max: 90) |

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "rank": 1849,
      "credits": 438194876,
      "usersOnline": 3,
      "usersTotal": 6,
      "recordedAt": "2024-01-15T10:30:00.000Z"
    },
    "history": [
      {
        "rank": 1850,
        "credits": 438000000,
        "usersOnline": 2,
        "usersTotal": 6,
        "recordedAt": "2024-01-14T10:30:00.000Z"
      }
    ],
    "changes": {
      "rankChange": -1,
      "creditsChange": 194876
    }
  }
}
```

---

## Admin Endpoints

Alle Admin-Endpoints erfordern einen Admin-Account.

### GET /api/admin/users

Alle Benutzer auflisten.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lssName": "Admin",
      "displayName": null,
      "isActive": true,
      "isAdmin": true,
      "allianceMemberId": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### PUT /api/admin/users/:id

Benutzer bearbeiten (aktivieren, Anzeigename setzen, etc.).

**Request Body:**
```json
{
  "isActive": true,
  "displayName": "Max",
  "allianceMemberId": 123,
  "badgeColor": "#3B82F6"
}
```

### DELETE /api/admin/users/:id

Benutzer löschen.

---

## SSE Stream

### GET /api/stream

Server-Sent Events Stream für Live-Updates.

**Headers:**
```
Authorization: Bearer <token>
```

**Events:**

1. **connected** - Bei Verbindungsaufbau
```
event: connected
data: {"message":"Connected to SSE stream","timestamp":"2024-01-15T10:30:00.000Z"}
```

2. **incidents** - Bei Einsatz-Updates
```
event: incidents
data: {"incidents":[...],"timestamp":"2024-01-15T10:30:00.000Z"}
```

3. **deleted** - Bei gelöschten Einsätzen
```
event: deleted
data: {"deletedIds":[1,2,3],"timestamp":"2024-01-15T10:30:00.000Z"}
```

4. **members** - Bei Mitglieder-Updates
```
event: members
data: {"members":[...],"counts":{"total":10,"online":3}}
```

5. **alliance_stats** - Bei Statistik-Updates
```
event: alliance_stats
data: {"rank":1849,"credits":438194876,...}
```

6. **heartbeat** - Alle 30 Sekunden
```
event: heartbeat
data: {"timestamp":"2024-01-15T10:31:00.000Z","clients":3}
```

**JavaScript Beispiel:**
```javascript
const token = localStorage.getItem('lss_session_token');
const eventSource = new EventSource(`/api/stream`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

eventSource.addEventListener('incidents', (event) => {
  const data = JSON.parse(event.data);
  console.log('Incidents update:', data.incidents.length);
});

eventSource.addEventListener('members', (event) => {
  const data = JSON.parse(event.data);
  console.log('Online:', data.counts.online, '/', data.counts.total);
});
```

---

## Health Endpoint

### GET /api/health

System-Status prüfen (kein Auth erforderlich).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": "1ms",
  "uptime": "5d 3h 42m",
  "checks": {
    "database": {
      "status": "up",
      "latency": "2ms"
    },
    "scraper": {
      "status": "running",
      "details": {
        "browserConnected": true,
        "scrapeCount": 1234,
        "lastScrapeAt": "2024-01-15T10:30:00.000Z"
      }
    },
    "memory": {
      "status": "ok",
      "details": {
        "usedPercent": 45,
        "totalMB": 2048,
        "freeMB": 1126
      }
    }
  },
  "stats": {
    "sseClients": 2
  }
}
```

---

## Fehlerbehandlung

Alle Fehler folgen diesem Format:

```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Lesbare Fehlerbeschreibung"
}
```

**HTTP Status Codes:**

| Code | Bedeutung |
|------|-----------|
| 200  | Erfolg |
| 400  | Ungültige Anfrage / Validierungsfehler |
| 401  | Nicht authentifiziert |
| 403  | Keine Berechtigung |
| 404  | Nicht gefunden |
| 429  | Rate Limit erreicht |
| 500  | Server-Fehler |

---

## Rate Limiting

- **Allgemein**: 500 Requests pro 15 Minuten pro IP
- **Login**: 10 Versuche pro 15 Minuten pro IP

Bei Überschreitung:
```json
{
  "error": "Zu viele Anfragen, bitte später erneut versuchen."
}
```
