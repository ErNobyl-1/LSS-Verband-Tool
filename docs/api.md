# API Dokumentation

Base URL: `http://localhost:3001`

## Authentifizierung

Alle `/ingest/*` Endpoints erfordern den `X-API-Key` Header:

```
X-API-Key: your-secret-api-key-change-me
```

Der Key muss mit der `API_KEY` Environment Variable übereinstimmen.

---

## Endpoints

### POST /ingest/incidents

Nimmt einen oder mehrere Einsätze entgegen und speichert sie (Upsert nach `ls_id`).

**Headers:**
```
Content-Type: application/json
X-API-Key: <api-key>
```

**Request Body (einzelner Einsatz):**
```json
{
  "ls_id": "alliance_12345",
  "title": "Brennendes Haus",
  "type": "Brandeinsatz",
  "status": "active",
  "source": "alliance",
  "lat": 52.5200,
  "lon": 13.4050,
  "address": "Musterstraße 1, 12345 Berlin",
  "raw_json": {
    "original_id": "12345",
    "extracted_at": "2024-01-15T10:30:00Z"
  }
}
```

**Request Body (Array):**
```json
[
  {
    "ls_id": "alliance_12345",
    "title": "Brennendes Haus",
    "source": "alliance"
  },
  {
    "ls_id": "alliance_event_67890",
    "title": "Großeinsatz Stadion",
    "source": "alliance_event"
  }
]
```

**Pflichtfelder:**
- `ls_id` (string) - Eindeutige ID des Einsatzes
- `title` (string) - Titel/Name des Einsatzes

**Optionale Felder:**
- `type` (string) - Einsatztyp
- `status` (string) - Status (default: "active")
- `source` (enum) - "alliance" | "alliance_event" | "own" | "unknown"
- `lat` (number) - Breitengrad (-90 bis 90)
- `lon` (number) - Längengrad (-180 bis 180)
- `address` (string) - Adresse
- `raw_json` (object) - Beliebige Zusatzdaten

**Response (Erfolg - einzeln):**
```json
{
  "success": true,
  "message": "Incident created",
  "incident": {
    "id": 1,
    "lsId": "alliance_12345",
    "title": "Brennendes Haus",
    "type": "Brandeinsatz",
    "status": "active",
    "source": "alliance",
    "lat": 52.52,
    "lon": 13.405,
    "address": "Musterstraße 1, 12345 Berlin",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "lastSeenAt": "2024-01-15T10:30:00.000Z",
    "rawJson": { ... }
  }
}
```

**Response (Erfolg - Array):**
```json
{
  "success": true,
  "message": "Processed 2 incidents",
  "created": 1,
  "updated": 1,
  "incidents": [ ... ]
}
```

**Response (Fehler - 400):**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "path": ["ls_id"],
      "message": "ls_id is required"
    }
  ]
}
```

**Response (Fehler - 401/403):**
```json
{
  "error": "Unauthorized",
  "message": "Missing X-API-Key header"
}
```

---

### GET /api/incidents

Listet Einsätze mit optionalen Filtern.

**Query Parameter:**
| Parameter | Typ    | Default | Beschreibung                                |
|-----------|--------|---------|---------------------------------------------|
| source    | string | -       | Filter nach Quelle (alliance, alliance_event, own) |
| status    | string | -       | Filter nach Status                          |
| q         | string | -       | Volltextsuche (Titel, ID, Adresse)         |
| limit     | number | 100     | Maximale Anzahl (1-1000)                   |
| offset    | number | 0       | Offset für Pagination                       |

**Beispiel:**
```
GET /api/incidents?source=alliance&status=active&q=brand&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lsId": "alliance_12345",
      "title": "Brennendes Haus",
      "type": "Brandeinsatz",
      "status": "active",
      "source": "alliance",
      "lat": 52.52,
      "lon": 13.405,
      "address": "Musterstraße 1, 12345 Berlin",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "lastSeenAt": "2024-01-15T10:35:00.000Z",
      "rawJson": null
    }
  ],
  "meta": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

### GET /api/incidents/:id

Einzelnen Einsatz abrufen.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lsId": "alliance_12345",
    ...
  }
}
```

**Response (404):**
```json
{
  "error": "Not Found",
  "message": "Incident not found"
}
```

---

### GET /api/stream

Server-Sent Events (SSE) Stream für Live-Updates.

**Headers (Response):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Events:**

1. **connected** - Initial bei Verbindung
```
event: connected
data: {"message":"Connected to SSE stream","timestamp":"2024-01-15T10:30:00.000Z"}
```

2. **incident** - Bei einzelnem Incident Update
```
event: incident
data: {"type":"created","incident":{...},"timestamp":"2024-01-15T10:30:00.000Z"}
```

3. **batch** - Bei Batch-Updates
```
event: batch
data: {"type":"batch_upsert","incidents":[...],"count":5,"timestamp":"2024-01-15T10:30:00.000Z"}
```

4. **heartbeat** - Alle 30 Sekunden
```
event: heartbeat
data: {"timestamp":"2024-01-15T10:31:00.000Z","clients":3}
```

**JavaScript Beispiel:**
```javascript
const eventSource = new EventSource('http://localhost:3001/api/stream');

eventSource.addEventListener('incident', (event) => {
  const data = JSON.parse(event.data);
  console.log('Incident update:', data.type, data.incident);
});

eventSource.addEventListener('batch', (event) => {
  const data = JSON.parse(event.data);
  console.log('Batch update:', data.count, 'incidents');
});
```

---

### GET /api/health

Health Check Endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sseClients": 2
}
```

---

### GET /

API Info.

**Response:**
```json
{
  "name": "LSS Verband Tool API",
  "version": "1.0.0",
  "endpoints": {
    "ingest": "/ingest/incidents",
    "incidents": "/api/incidents",
    "stream": "/api/stream",
    "health": "/api/health"
  }
}
```

---

## Fehlerbehandlung

Alle Fehler folgen dem Format:

```json
{
  "error": "Error Type",
  "message": "Human readable message",
  "details": [ ... ]  // Optional, bei Validierungsfehlern
}
```

**HTTP Status Codes:**
- `200` - Erfolg
- `201` - Erstellt (neuer Einsatz)
- `400` - Validierungsfehler
- `401` - Nicht authentifiziert
- `403` - Falscher API Key
- `404` - Nicht gefunden
- `500` - Server-Fehler
