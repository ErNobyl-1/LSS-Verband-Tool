import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { IncidentList } from './components/IncidentList';
import { Map } from './components/Map';
import { useIncidents } from './hooks/useIncidents';

function ListPage() {
  const [showEmergency, setShowEmergency] = useState(true);
  const [showEvent, setShowEvent] = useState(true);

  const { incidents, loading, error, connected } = useIncidents();

  // Separate incidents into two columns
  const emergencyAndEvent = useMemo(() => {
    return incidents.filter((i) => {
      if (i.category === 'emergency' && showEmergency) return true;
      if (i.category === 'event' && showEvent) return true;
      return false;
    });
  }, [incidents, showEmergency, showEvent]);

  const planned = useMemo(() => {
    return incidents.filter((i) => i.category === 'planned');
  }, [incidents]);

  const stats = useMemo(() => {
    return {
      emergency: incidents.filter((i) => i.category === 'emergency').length,
      planned: incidents.filter((i) => i.category === 'planned').length,
      event: incidents.filter((i) => i.category === 'event').length,
    };
  }, [incidents]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header connected={connected} stats={stats} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Notfälle & GSL-Einsätze */}
        <div className="w-1/2 bg-white border-r overflow-auto">
          <div className="sticky top-0 bg-red-600 text-white px-4 py-2 font-medium flex items-center justify-between">
            <span>Notfälle & GSL-Einsätze ({emergencyAndEvent.length})</span>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEmergency}
                  onChange={(e) => setShowEmergency(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Notfälle ({stats.emergency})</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEvent}
                  onChange={(e) => setShowEvent(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>GSL ({stats.event})</span>
              </label>
            </div>
          </div>
          <IncidentList
            incidents={emergencyAndEvent}
            loading={loading}
            error={error}
          />
        </div>

        {/* Right column: Geplante Einsätze */}
        <div className="w-1/2 bg-white overflow-auto">
          <div className="sticky top-0 bg-blue-600 text-white px-4 py-2 font-medium">
            Geplante Einsätze ({planned.length})
          </div>
          <IncidentList
            incidents={planned}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}

function MapPage() {
  const { incidents, connected } = useIncidents();

  const stats = useMemo(() => {
    return {
      emergency: incidents.filter((i) => i.category === 'emergency').length,
      planned: incidents.filter((i) => i.category === 'planned').length,
      event: incidents.filter((i) => i.category === 'event').length,
    };
  }, [incidents]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header connected={connected} stats={stats} />

      <div className="flex-1 overflow-hidden">
        <Map incidents={incidents} />
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
