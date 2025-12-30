import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../hooks/useAuth';
import { AllianceMember } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UserData {
  id: number;
  lssName: string;
  displayName: string | null;
  badgeColor: string | null;
  allianceMemberId: number | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

interface UserDialogProps {
  user?: UserData | null;
  members: AllianceMember[];
  onClose: () => void;
  onSave: (data: {
    lssName?: string;
    password?: string;
    displayName: string | null;
    badgeColor: string | null;
    allianceMemberId: number | null;
    isActive?: boolean;
  }) => Promise<void>;
  isCreate?: boolean;
}

function UserDialog({ user, members, onClose, onSave, isCreate }: UserDialogProps) {
  const [lssName, setLssName] = useState(user?.lssName || '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [badgeColor, setBadgeColor] = useState(user?.badgeColor || '');
  const [allianceMemberId, setAllianceMemberId] = useState<number | null>(user?.allianceMemberId || null);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSave({
        ...(isCreate && { lssName, password }),
        displayName: displayName || null,
        badgeColor: badgeColor || null,
        allianceMemberId,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isCreate ? 'Neuen Benutzer anlegen' : `Benutzer bearbeiten: ${user?.lssName}`}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCreate && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LSS-Name *
                </label>
                <input
                  type="text"
                  value={lssName}
                  onChange={(e) => setLssName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Mindestens 6 Zeichen</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzeigename
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="z.B. Vorname"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Badge-Farbe
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBadgeColor(color)}
                  className={`w-6 h-6 rounded-full border-2 ${
                    badgeColor === color ? 'border-gray-800' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="text"
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
                placeholder="#hex"
                className="w-20 px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

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

          {!isCreate && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Benutzer ist aktiv
              </label>
            </div>
          )}

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
              disabled={isLoading || (isCreate && (!lssName || !password))}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Speichere...' : isCreate ? 'Anlegen' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PasswordDialogProps {
  user: UserData;
  onClose: () => void;
  onReset: (newPassword: string) => Promise<void>;
}

function PasswordDialog({ user, onClose, onReset }: PasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passworter stimmen nicht uberein');
      return;
    }

    // Password validation (must match backend requirements)
    if (newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      setError('Passwort muss mindestens einen Buchstaben enthalten');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Passwort muss mindestens eine Zahl enthalten');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      setError('Passwort muss mindestens ein Sonderzeichen enthalten');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onReset(newPassword);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Zurucksetzen');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Passwort zurucksetzen</h2>
        <p className="text-gray-600 mb-4">
          Neues Passwort fur <strong>{user.lssName}</strong> setzen:
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neues Passwort
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort bestatigen
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
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
              disabled={isLoading || !newPassword || !confirmPassword}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Speichere...' : 'Zurucksetzen'}
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
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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

  const handleCreateUser = async (data: {
    lssName?: string;
    password?: string;
    displayName: string | null;
    badgeColor: string | null;
    allianceMemberId: number | null;
  }) => {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Anlegen');
    }

    fetchData();
  };

  const handleUpdateUser = async (userId: number, data: {
    displayName: string | null;
    badgeColor: string | null;
    allianceMemberId: number | null;
    isActive?: boolean;
  }) => {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Speichern');
    }

    fetchData();
  };

  const handleResetPassword = async (userId: number, newPassword: string) => {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/password`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newPassword }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Zurucksetzen');
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

  const activeUsers = users.filter(u => u.isActive);
  const inactiveUsers = users.filter(u => !u.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Fehler: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Benutzerverwaltung</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {activeUsers.length} aktiv, {inactiveUsers.length} inaktiv
          </span>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neuer Benutzer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">LSS-Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Anzeigename</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Farbe</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Registriert</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Keine Benutzer vorhanden
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
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
                    {user.badgeColor ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: user.badgeColor }}
                        />
                        <span className="text-xs text-gray-500">{user.badgeColor}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Aktiv
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        Inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditUser(user)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Bearbeiten
                      </button>
                      {!user.isAdmin && (
                        <>
                          <button
                            onClick={() => setPasswordUser(user)}
                            className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                          >
                            Passwort
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.lssName)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Loschen
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateDialog && (
        <UserDialog
          members={members}
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreateUser}
          isCreate
        />
      )}

      {editUser && (
        <UserDialog
          user={editUser}
          members={members}
          onClose={() => setEditUser(null)}
          onSave={(data) => handleUpdateUser(editUser.id, data)}
        />
      )}

      {passwordUser && (
        <PasswordDialog
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onReset={(newPassword) => handleResetPassword(passwordUser.id, newPassword)}
        />
      )}
    </div>
  );
}
