import { useState } from 'react';

interface RegisterPageProps {
  onRegister: (lssName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onRegister, onSwitchToLogin }: RegisterPageProps) {
  const [lssName, setLssName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lssName.trim() || lssName.trim().length < 2) {
      setError('LSS-Name muss mindestens 2 Zeichen lang sein');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passworter stimmen nicht uberein');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await onRegister(lssName.trim(), password);

    if (!result.success) {
      setError(result.error || 'Registrierung fehlgeschlagen');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">LSS Verband Tool</h1>
          <p className="text-gray-600 mt-2">Account erstellen</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">
            <strong>Hinweis:</strong> Nach der Registrierung muss ein Admin deinen Account freischalten,
            bevor du das Tool nutzen kannst.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="lssName" className="block text-sm font-medium text-gray-700 mb-1">
              LSS-Name
            </label>
            <input
              id="lssName"
              type="text"
              value={lssName}
              onChange={(e) => setLssName(e.target.value)}
              placeholder="Dein LSS-Spielername"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoComplete="username"
            />
            <p className="text-xs text-gray-500 mt-1">
              Verwende deinen echten Spielernamen aus Leitstellenspiel
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort bestatigen
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !lssName.trim() || !password || !confirmPassword}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Registriere...' : 'Registrieren'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Bereits einen Account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Anmelden
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
