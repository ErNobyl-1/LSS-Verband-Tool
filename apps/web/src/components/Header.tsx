interface HeaderProps {
  connected: boolean;
  incidentCount: number;
}

export function Header({ connected, incidentCount }: HeaderProps) {
  return (
    <header className="bg-slate-900 text-white px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-red-500">LSS Verband Tool</h1>
          <span className="text-slate-400 text-sm">
            Einsatz-Dashboard
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-sm text-slate-300">
            <span className="font-medium">{incidentCount}</span> Einsätze
          </div>

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
