import { FilterState, SourceFilter, CategoryFilter, StatusFilter } from '../types';

interface FiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onRefresh: () => void;
}

export function Filters({ filters, onChange, onRefresh }: FiltersProps) {
  const handleSourceChange = (source: SourceFilter) => {
    onChange({ ...filters, source });
  };

  const handleCategoryChange = (category: CategoryFilter) => {
    onChange({ ...filters, category });
  };

  const handleStatusChange = (status: StatusFilter) => {
    onChange({ ...filters, status });
  };

  const handleSearchChange = (search: string) => {
    onChange({ ...filters, search });
  };

  return (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="Suche nach Titel, ID oder Adresse..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Kategorie:</span>
          <div className="flex rounded-lg border overflow-hidden">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'emergency', label: 'Notfälle' },
              { value: 'planned', label: 'Geplant' },
              { value: 'event', label: 'GSL' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleCategoryChange(option.value as CategoryFilter)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  filters.category === option.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Quelle:</span>
          <div className="flex rounded-lg border overflow-hidden">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'own_shared', label: 'Eigene' },
              { value: 'alliance', label: 'Verband' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleSourceChange(option.value as SourceFilter)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  filters.source === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <div className="flex rounded-lg border overflow-hidden">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'red', label: 'Offen' },
              { value: 'yellow', label: 'Läuft' },
              { value: 'green', label: 'Bereit' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value as StatusFilter)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  filters.status === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          Aktualisieren
        </button>
      </div>
    </div>
  );
}
