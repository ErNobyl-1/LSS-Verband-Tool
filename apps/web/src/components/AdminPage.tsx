import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../hooks/useAuth';
import { AllianceMember } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UserData {
  id: number;
  lssName: string;
  displayName: string | null;
  allianceMemberId: number | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface ActivateDialogProps {
  user: UserData;
  members: AllianceMember[];
  onClose: () => void;
  onActivate: (userId: number, allianceMemberId: number | null, displayName: string | null) => Promise<void>;
}

function ActivateDialog({ user, members, onClose, onActivate }: ActivateDialogProps) {
  const [allianceMemberId, setAllianceMemberId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onActivate(user.id, allianceMemberId, displayName || null);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Benutzer freischalten</h2>
        <p className="text-gray-600 mb-4">
          <strong>{user.lssName}</strong> freischalten
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allianz-Mitglied zuordnen
            </label>
            <select
              value={allianceMemberId || ''}
              onChange={(e) => setAllianceMemberId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Nicht zuordnen --</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzeigename (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="z.B. echter Vorname"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Wird anstelle des LSS-Namens angezeigt
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Speichere...' : 'Freischalten'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activateUser, setActivateUser] = useState<UserData | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/members`, { headers: getAuthHeaders() }),
      ]);

      if (!usersRes.ok || !membersRes.ok) {
        throw new Error('Fehler beim Laden');
      }

      const usersData = await usersRes.json();
      const membersData = await membersRes.json();

      setUsers(usersData.data);
      setMembers(membersData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivate = async (userId: number, allianceMemberId: number | null, displayName: string | null) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/activate`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ allianceMemberId, displayName }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Freischalten');
      }

      setActivateUser(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleDelete = async (userId: number, lssName: string) => {
    if (!confirm(`Benutzer "${lssName}" wirklich loschen?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Loschen');
      }

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const pendingUsers = users.filter(u => !u.isActive && !u.isAdmin);
  const activeUsers = users.filter(u => u.isActive);
  const displayUsers = showAll ? users : pendingUsers;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        Fehler: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Benutzerverwaltung</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {pendingUsers.length} wartend, {activeUsers.length} aktiv
          </span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Alle anzeigen
          </label>
        </div>
      </div>

      {pendingUsers.length > 0 && !showAll && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded mb-4">
          {pendingUsers.length} Benutzer warten auf Freischaltung
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">LSS-Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Anzeigename</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Registriert</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {showAll ? 'Keine Benutzer vorhanden' : 'Keine wartenden Benutzer'}
                </td>
              </tr>
            ) : (
              displayUsers.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{user.lssName}</span>
                    {user.isAdmin && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.displayName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Aktiv
                      </span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Wartend
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!user.isActive && !user.isAdmin && (
                      <button
                        onClick={() => setActivateUser(user)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium mr-3"
                      >
                        Freischalten
                      </button>
                    )}
                    {!user.isAdmin && (
                      <button
                        onClick={() => handleDelete(user.id, user.lssName)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Loschen
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activateUser && (
        <ActivateDialog
          user={activateUser}
          members={members}
          onClose={() => setActivateUser(null)}
          onActivate={handleActivate}
        />
      )}
    </div>
  );
}
