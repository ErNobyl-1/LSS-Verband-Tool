import { Incident } from '../types';

interface IncidentDetailsProps {
  incident: Incident | null;
  onClose: () => void;
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE');
}

function cleanTitle(title: string) {
  return title.replace(/\s*\[Verband\]\s*/g, '').trim();
}

export function IncidentDetails({ incident, onClose }: IncidentDetailsProps) {
  if (!incident) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Wähle einen Einsatz aus der Liste
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{cleanTitle(incident.title)}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          &times;
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase">LSS ID</label>
            <p className="font-mono text-sm">{incident.lsId}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Quelle</label>
            <p className="text-sm capitalize">{incident.source.replace('_', ' ')}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Status</label>
            <p className="text-sm">{incident.status === 'red' ? 'Unbearbeitet' : incident.status === 'yellow' ? 'Anfahrt' : incident.status === 'green' ? 'In Durchführung' : 'Unbekannt'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Typ</label>
            <p className="text-sm">{incident.type || '-'}</p>
          </div>
        </div>

        {/* Address */}
        {incident.address && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Adresse</label>
            <p className="text-sm">{incident.address}</p>
          </div>
        )}

        {/* Coordinates */}
        {incident.lat && incident.lon && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Koordinaten</label>
            <p className="text-sm font-mono">
              {incident.lat.toFixed(6)}, {incident.lon.toFixed(6)}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lon}&zoom=15`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              Auf OpenStreetMap öffnen
            </a>
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Erstellt:</span>
              <span>{formatDateTime(incident.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Aktualisiert:</span>
              <span>{formatDateTime(incident.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Zuletzt gesehen:</span>
              <span>{formatDateTime(incident.lastSeenAt)}</span>
            </div>
          </div>
        </div>

        {/* Raw JSON */}
        {incident.rawJson && (
          <div className="pt-4 border-t">
            <label className="text-xs text-gray-500 uppercase">Raw Data</label>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-48">
              {JSON.stringify(incident.rawJson, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
