import { Incident } from '../types';

interface IncidentListProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  onSelect: (incident: Incident) => void;
}

function getStatusColor(status: string | null) {
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };
  return colors[status || 'yellow'] || colors.yellow;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function cleanTitle(title: string) {
  return title.replace(/\s*\[Verband\]\s*/g, '').trim();
}

export function IncidentList({ incidents, loading, error, selectedId, onSelect }: IncidentListProps) {
  if (loading && incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Einsätze...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Fehler: {error}</div>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Keine Einsätze gefunden</div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {incidents.map((incident) => {
        const statusColor = getStatusColor(incident.status);
        const isSelected = selectedId === incident.id;

        return (
          <div
            key={incident.id}
            onClick={() => onSelect(incident)}
            className={`flex cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            {/* Status indicator stripe */}
            <div className={`w-2 flex-shrink-0 ${statusColor}`} />

            <div className="flex-1 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {cleanTitle(incident.title)}
                  </h3>
                  {incident.address && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {incident.address}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {formatTime(incident.lastSeenAt)}
                </div>
              </div>

              {(incident.type || (incident.lat && incident.lon)) && (
                <div className="flex items-center gap-2 mt-1">
                  {incident.type && (
                    <span className="text-xs text-gray-500 truncate">
                      {incident.type}
                    </span>
                  )}
                  {incident.lat && incident.lon && (
                    <span className="text-xs text-gray-400" title="Hat Koordinaten">
                      📍
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
