import { useEffect } from 'react';

interface PendingPageProps {
  lssName: string;
  onLogout: () => void;
  onRefresh: () => void;
}

export function PendingPage({ lssName, onLogout, onRefresh }: PendingPageProps) {
  // Check for approval every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
    }, 10000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Warte auf Freischaltung</h1>
          <p className="text-gray-600 mt-2">
            Hallo <strong>{lssName}</strong>!
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
          <p className="text-sm">
            Dein Account wurde erfolgreich erstellt. Ein Admin muss deinen Account noch freischalten,
            bevor du das Tool nutzen kannst.
          </p>
          <p className="text-xs mt-2 text-yellow-600">
            Diese Seite aktualisiert sich automatisch...
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onRefresh}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Jetzt prufen
          </button>
          <button
            onClick={onLogout}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
