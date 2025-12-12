import { useState } from 'react';
import { useMembers } from '../hooks/useMembers';

function formatLastOnline(lastOnlineAt: string | null) {
  if (!lastOnlineAt) return 'Nie';

  const date = new Date(lastOnlineAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

interface MemberListProps {
  showOffline?: boolean;
}

export function MemberList({ showOffline = true }: MemberListProps) {
  const { members, onlineMembers, counts, loading, error } = useMembers();
  const [filter, setFilter] = useState<'all' | 'online'>('online');

  const displayMembers = filter === 'online' ? onlineMembers : members;

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Lade Mitglieder...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Fehler: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mitglieder</h2>
          <span className="text-sm text-gray-500">
            <span className="text-green-600 font-medium">{counts.online}</span>
            <span className="text-gray-400"> / {counts.total}</span>
          </span>
        </div>

        {showOffline && (
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setFilter('online')}
              className={`flex-1 px-3 py-1.5 text-sm ${
                filter === 'online' ? 'bg-slate-800 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Online ({counts.online})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-3 py-1.5 text-sm ${
                filter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Alle ({counts.total})
            </button>
          </div>
        )}
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-auto">
        {displayMembers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {filter === 'online' ? 'Keine Mitglieder online' : 'Keine Mitglieder gefunden'}
          </div>
        ) : (
          <ul className="divide-y">
            {displayMembers.map((member) => (
              <li key={member.id} className="p-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {/* Online indicator */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      member.isOnline ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{member.name}</span>
                  </div>

                  {/* Last online */}
                  {!member.isOnline && (
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {formatLastOnline(member.lastOnlineAt)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
