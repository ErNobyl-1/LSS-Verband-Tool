import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMembers } from '../hooks/useMembers';
import { User } from '../hooks/useAuth';

interface HeaderProps {
  connected: boolean;
  stats: {
    emergency: number;
    planned: number;
    event: number;
  };
  user: User;
  onLogout: () => void;
}

export function Header({ connected, stats, user, onLogout }: HeaderProps) {
  const { members, onlineMembers, counts, loading: membersLoading } = useMembers();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  // Alphabetisch sortierte Listen (prefer displayName over name)
  const sortedOnlineMembers = useMemo(
    () => [...onlineMembers].sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name, 'de')
    ),
    [onlineMembers]
  );
  const sortedOfflineMembers = useMemo(
    () => members.filter(m => !m.isOnline).sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name, 'de')
    ),
    [members]
  );

  return (
    <header className="bg-slate-900 text-white px-6 py-4 shadow-lg">
      <div className="flex items-center">
        {/* Left: Title + Navigation + Connection Status */}
        <div className="flex items-center gap-4 flex-1">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <div className="text-xl font-bold text-red-500">
              LSS Verband Tool
            </div>
          </Link>
          <nav className="flex items-center gap-1 ml-2">
            <Link
              to="/"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                location.pathname === '/'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Statistik
            </Link>
            <Link
              to="/incidents"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                location.pathname === '/incidents'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Liste
            </Link>
            <Link
              to="/map"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                location.pathname === '/map'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Karte
            </Link>
            {user.isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  location.pathname === '/admin'
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Center: Category Stats */}
        <div className="flex items-center">
          <div className="text-sm text-slate-300">
            <span>Notfalle: </span><span className="font-medium text-red-400">{stats.emergency}</span>
            <span className="text-slate-600 mx-2">·</span>
            <span>Geplant: </span><span className="font-medium text-amber-400">{stats.planned}</span>
            <span className="text-slate-600 mx-2">·</span>
            <span>GSL: </span><span className="font-medium text-purple-400">{stats.event}</span>
          </div>
        </div>

        {/* Right: Connection Status + Online Members + User Menu */}
        <div className="flex items-center gap-6 flex-1 justify-end">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-slate-300">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Online Members Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 hover:bg-slate-800 px-2 py-1 rounded transition-colors text-sm text-slate-300"
              title="Online Mitglieder anzeigen"
            >
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {membersLoading ? (
                <span>...</span>
              ) : (
                <span>
                  <span className="text-green-400 font-medium">{counts.online}</span>
                  <span className="text-slate-500">/{counts.total}</span>
                </span>
              )}
              <svg
                className={`w-3 h-3 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-20 max-h-80 overflow-auto scrollbar-thin">
                  {/* Online Members Section */}
                  <div className="p-2 border-b bg-gray-50">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Online ({sortedOnlineMembers.length})
                    </span>
                  </div>
                  {sortedOnlineMembers.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Niemand online
                    </div>
                  ) : (
                    <ul className="py-1">
                      {sortedOnlineMembers.map((member) => (
                        <li
                          key={member.id}
                          className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-900"
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-sm truncate">{member.displayName || member.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Offline Members Section */}
                  <div className="p-2 border-b border-t bg-gray-50">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Offline ({sortedOfflineMembers.length})
                    </span>
                  </div>
                  {sortedOfflineMembers.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Alle online
                    </div>
                  ) : (
                    <ul className="py-1">
                      {sortedOfflineMembers.map((member) => (
                        <li
                          key={member.id}
                          className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-900"
                        >
                          <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                          <span className="text-sm truncate text-gray-600">{member.displayName || member.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded transition-colors"
            >
              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-xs font-medium">
                {(user.displayName || user.lssName).charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-slate-300">
                {user.displayName || user.lssName}
              </span>
              <svg
                className={`w-3 h-3 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-900">{user.displayName || user.lssName}</p>
                    {user.displayName && (
                      <p className="text-xs text-gray-500">{user.lssName}</p>
                    )}
                    {user.isAdmin && (
                      <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Einstellungen
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Abmelden
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
