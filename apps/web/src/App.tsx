import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { IncidentList } from './components/IncidentList';
import { IncidentDetails } from './components/IncidentDetails';
import { Map } from './components/Map';
import { useIncidents } from './hooks/useIncidents';
import { Incident, FilterState } from './types';

function ListPage() {
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    status: 'all',
    search: '',
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const { incidents, loading, error, connected } = useIncidents(filters);

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
      <Header connected={connected} stats={stats} />
      <Filters filters={filters} onChange={setFilters} />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 bg-white border-r overflow-auto">
          <IncidentList
            incidents={filteredIncidents}
            loading={loading}
            error={error}
            selectedId={selectedIncident?.id ?? null}
            onSelect={handleSelectIncident}
          />
        </div>

        <div className="w-1/2 bg-gray-50">
          <IncidentDetails
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        </div>
      </div>
    </div>
  );
}

function MapPage() {
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    status: 'all',
    search: '',
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const { incidents, connected } = useIncidents(filters);

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
      <Header connected={connected} stats={stats} />
      <Filters filters={filters} onChange={setFilters} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Map
            incidents={filteredIncidents}
            selectedId={selectedIncident?.id ?? null}
            onSelect={handleSelectIncident}
          />
        </div>

        {selectedIncident && (
          <div className="w-96 bg-white border-l shadow-lg overflow-auto">
            <IncidentDetails
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
