import { useState } from 'react';

interface LoginPageProps {
  error?: string | null;
  onLogin: (lssName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onSwitchToRegister?: () => void;
}

export function LoginPage({ error: externalError, onLogin, onSwitchToRegister }: LoginPageProps) {
  const [lssName, setLssName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lssName.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    const result = await onLogin(lssName.trim(), password);

    if (!result.success) {
      setError(result.error || 'Login fehlgeschlagen');
    }
    setIsLoading(false);
  };

  const displayError = error || externalError;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">LSS Verband Tool</h1>
          <p className="text-gray-600 mt-2">Anmelden</p>
        </div>

        {displayError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {displayError}
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
              placeholder="Dein Passwort"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !lssName.trim() || !password}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        {onSwitchToRegister && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Noch kein Account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Registrieren
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
