import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { IncidentList } from './components/IncidentList';
import { Map } from './components/Map';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { PendingPage } from './components/PendingPage';
import { AdminPage } from './components/AdminPage';
import { useIncidents } from './hooks/useIncidents';
import { useAuth, User } from './hooks/useAuth';

interface PageProps {
  user: User;
  onLogout: () => void;
}

function ListPage({ user, onLogout }: PageProps) {
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
      <Header connected={connected} stats={stats} user={user} onLogout={onLogout} />

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

function MapPage({ user, onLogout }: PageProps) {
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
      <Header connected={connected} stats={stats} user={user} onLogout={onLogout} />

      <div className="flex-1 overflow-hidden">
        <Map incidents={incidents} />
      </div>
    </div>
  );
}

function App() {
  const [showRegister, setShowRegister] = useState(false);
  const { user, isAuthenticated, isPending, isLoading, error, login, register, logout, refreshUser } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade...</p>
        </div>
      </div>
    );
  }

  // Show pending page if user is registered but not approved
  if (isPending && user) {
    return (
      <PendingPage
        lssName={user.lssName}
        onLogout={logout}
        onRefresh={refreshUser}
      />
    );
  }

  // Show login or register page if not authenticated
  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <RegisterPage
          onRegister={register}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }
    return (
      <LoginPage
        error={error}
        onLogin={login}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  // Show main app if authenticated
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListPage user={user!} onLogout={logout} />} />
        <Route path="/map" element={<MapPage user={user!} onLogout={logout} />} />
        {user?.isAdmin && (
          <Route path="/admin" element={<AdminPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
