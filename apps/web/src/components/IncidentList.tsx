import { Incident } from '../types';

interface IncidentListProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  onSelect: (incident: Incident) => void;
}

function getSourceBadge(source: string) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    alliance: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Verband' },
    alliance_event: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Event' },
    own: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Eigene' },
    own_shared: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Freigegeben' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unbekannt' },
  };
  return badges[source] || badges.unknown;
}

function getStatusBadge(status: string | null) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    red: { bg: 'bg-red-100', text: 'text-red-800', label: 'Offen' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Bearbeitung' },
    green: { bg: 'bg-green-100', text: 'text-green-800', label: 'Bereit' },
    active: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Aktiv' },
  };
  return badges[status || 'active'] || badges.active;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
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
        const sourceBadge = getSourceBadge(incident.source);
        const statusBadge = getStatusBadge(incident.status);
        const isSelected = selectedId === incident.id;

        return (
          <div
            key={incident.id}
            onClick={() => onSelect(incident)}
            className={`px-4 py-3 cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {incident.title}
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

            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sourceBadge.bg} ${sourceBadge.text}`}>
                {sourceBadge.label}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
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
          </div>
        );
      })}
    </div>
  );
}
