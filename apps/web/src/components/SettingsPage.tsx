import { useState } from 'react';
import { User, getAuthHeaders } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SettingsPageProps {
  user: User;
  onUserUpdate: () => void;
}

const COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

export function SettingsPage({ user, onUserUpdate }: SettingsPageProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [badgeColor, setBadgeColor] = useState(user.badgeColor || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName || null,
          badgeColor: badgeColor || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSettingsMessage({ type: 'success', text: 'Einstellungen gespeichert' });
        onUserUpdate();
      } else {
        setSettingsMessage({ type: 'error', text: data.message || 'Fehler beim Speichern' });
      }
    } catch {
      setSettingsMessage({ type: 'error', text: 'Verbindungsfehler' });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passworter stimmen nicht uberein' });
      return;
    }

    // Password validation (must match backend requirements)
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Passwort muss mindestens 8 Zeichen lang sein' });
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      setPasswordMessage({ type: 'error', text: 'Passwort muss mindestens einen Buchstaben enthalten' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordMessage({ type: 'error', text: 'Passwort muss mindestens eine Zahl enthalten' });
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      setPasswordMessage({ type: 'error', text: 'Passwort muss mindestens ein Sonderzeichen enthalten' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPasswordMessage({ type: 'success', text: 'Passwort geandert' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: data.message || 'Fehler beim Andern' });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Verbindungsfehler' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profil</h2>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LSS-Name
            </label>
            <input
              type="text"
              value={user.lssName}
              disabled
              className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Kann nicht geandert werden</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzeigename
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="z.B. dein Vorname"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Wird anstelle des LSS-Namens angezeigt</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Badge-Farbe
            </label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBadgeColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      badgeColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="text"
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
                placeholder="#3b82f6"
                className="w-24 px-2 py-1 border rounded text-sm"
              />
              {badgeColor && (
                <button
                  type="button"
                  onClick={() => setBadgeColor('')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Loschen
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Farbe fur deinen Namen in Badges</p>

            {/* Preview */}
            {(displayName || user.lssName) && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-600">Vorschau:</span>
                <span
                  className="px-2 py-0.5 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: badgeColor || '#6b7280' }}
                >
                  {displayName || user.lssName}
                </span>
              </div>
            )}
          </div>

          {settingsMessage && (
            <div className={`p-3 rounded ${
              settingsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {settingsMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={settingsLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {settingsLoading ? 'Speichere...' : 'Einstellungen speichern'}
          </button>
        </form>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Passwort andern</h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>

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
              Neues Passwort bestatigen
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>

          {passwordMessage && (
            <div className={`p-3 rounded ${
              passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {passwordLoading ? 'Andere...' : 'Passwort andern'}
          </button>
        </form>
      </div>
    </div>
  );
}
