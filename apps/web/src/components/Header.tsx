import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMembers } from '../hooks/useMembers';
import { useAllianceStats } from '../hooks/useAllianceStats';

interface HeaderProps {
  connected: boolean;
  stats: {
    emergency: number;
    planned: number;
    event: number;
  };
}

export function Header({ connected, stats }: HeaderProps) {
  const { members, onlineMembers, counts, loading: membersLoading } = useMembers();
  const { stats: allianceStats } = useAllianceStats();
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();

  // Alphabetisch sortierte Listen
  const sortedOnlineMembers = useMemo(
    () => [...onlineMembers].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [onlineMembers]
  );
  const sortedOfflineMembers = useMemo(
    () => members.filter(m => !m.isOnline).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [members]
  );

  const formatCredits = (credits: number) => {
    return credits.toLocaleString('de-DE');
  };

  const isMapPage = location.pathname === '/map';

  return (
    <header className="bg-slate-900 text-white px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-bold text-red-500 hover:text-red-400 transition-colors">
            LSS Verband Tool
          </Link>
          <nav className="flex items-center gap-1 ml-2">
            <Link
              to="/"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                !isMapPage
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Liste
            </Link>
            <Link
              to="/map"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                isMapPage
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Karte
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {/* Alliance Stats (Rank & Credits) */}
          {allianceStats && (
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <div className="flex items-center gap-1.5" title={`Verband: ${allianceStats.allianceName}`}>
                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium">#{allianceStats.rank}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Gesamt verdiente Credits im Verband">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatCredits(allianceStats.creditsTotal)}</span>
              </div>
            </div>
          )}

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
                          <span className="text-sm truncate">{member.name}</span>
                          {member.roleFlags.owner && (
                            <span className="text-xs bg-amber-500 text-white px-1 rounded ml-auto">Owner</span>
                          )}
                          {member.roleFlags.admin && !member.roleFlags.owner && (
                            <span className="text-xs bg-red-500 text-white px-1 rounded ml-auto">Admin</span>
                          )}
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
                          <span className="text-sm truncate text-gray-600">{member.name}</span>
                          {member.roleFlags.owner && (
                            <span className="text-xs bg-amber-500 text-white px-1 rounded ml-auto">Owner</span>
                          )}
                          {member.roleFlags.admin && !member.roleFlags.owner && (
                            <span className="text-xs bg-red-500 text-white px-1 rounded ml-auto">Admin</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Category Stats */}
          <div className="text-sm text-slate-300">
            <span>Notfälle: </span><span className="font-medium text-red-400">{stats.emergency}</span>
            <span className="text-slate-600 mx-2">·</span>
            <span>Geplant: </span><span className="font-medium text-amber-400">{stats.planned}</span>
            <span className="text-slate-600 mx-2">·</span>
            <span>GSL: </span><span className="font-medium text-purple-400">{stats.event}</span>
          </div>

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
        </div>
      </div>
    </header>
  );
}
