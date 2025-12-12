import { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { IncidentList } from './components/IncidentList';
import { IncidentDetails } from './components/IncidentDetails';
import { Map } from './components/Map';
import { useIncidents } from './hooks/useIncidents';
import { Incident, FilterState } from './types';

type View = 'list' | 'map';

function App() {
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    status: 'all',
    search: '',
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [view, setView] = useState<View>('list');

  const { incidents, loading, error, connected, refresh } = useIncidents(filters);

  // Filter incidents client-side for search (debounced API call handles server-side)
  const filteredIncidents = useMemo(() => {
    if (!filters.search) return incidents;

    const searchLower = filters.search.toLowerCase();
    return incidents.filter(
      (i) =>
        i.title.toLowerCase().includes(searchLower) ||
        i.lsId.toLowerCase().includes(searchLower) ||
        (i.address && i.address.toLowerCase().includes(searchLower))
    );
  }, [incidents, filters.search]);

  // Stats by category
  const stats = useMemo(() => {
    return {
      emergency: incidents.filter((i) => i.category === 'emergency').length,
      planned: incidents.filter((i) => i.category === 'planned').length,
      event: incidents.filter((i) => i.category === 'event').length,
    };
  }, [incidents]);

  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncident(incident);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header connected={connected} incidentCount={filteredIncidents.length} />

      <Filters filters={filters} onChange={setFilters} />

      {/* Quick Stats */}
      <div className="bg-white border-b px-6 py-2 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>Notfälle: {stats.emergency}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Geplant: {stats.planned}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          <span>GSL: {stats.event}</span>
        </div>

        <div className="ml-auto flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 text-sm ${
              view === 'list' ? 'bg-slate-800 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1 text-sm ${
              view === 'map' ? 'bg-slate-800 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Karte
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'list' ? (
          <>
            {/* Incident List */}
            <div className="w-1/2 bg-white border-r overflow-auto">
              <IncidentList
                incidents={filteredIncidents}
                loading={loading}
                error={error}
                selectedId={selectedIncident?.id ?? null}
                onSelect={handleSelectIncident}
              />
            </div>

            {/* Incident Details */}
            <div className="w-1/2 bg-gray-50">
              <IncidentDetails
                incident={selectedIncident}
                onClose={() => setSelectedIncident(null)}
              />
            </div>
          </>
        ) : (
          <>
            {/* Map View */}
            <div className="flex-1 relative">
              <Map
                incidents={filteredIncidents}
                selectedId={selectedIncident?.id ?? null}
                onSelect={handleSelectIncident}
              />
            </div>

            {/* Side Panel on Map View */}
            {selectedIncident && (
              <div className="w-96 bg-white border-l shadow-lg overflow-auto">
                <IncidentDetails
                  incident={selectedIncident}
                  onClose={() => setSelectedIncident(null)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
