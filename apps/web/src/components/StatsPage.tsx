import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAllianceStatsFull, fetchAllianceStatsHistory } from '../api';
import { AllianceStatsFull, PeriodChange, AllianceStats } from '../types';

type TimePeriod = '24h' | '7d' | '1mo' | '12mo';

const PERIOD_LABELS: Record<TimePeriod, string> = {
  '24h': '24 Stunden',
  '7d': '7 Tage',
  '1mo': '30 Tage',
  '12mo': '12 Monate',
};

const HISTORY_PERIODS: { label: string; period: 'hour' | 'day' | 'week' | 'month'; limit: number }[] = [
  { label: '24h', period: 'hour', limit: 24 },
  { label: '7 Tage', period: 'day', limit: 7 },
  { label: '30 Tage', period: 'day', limit: 30 },
  { label: '12 Monate', period: 'month', limit: 12 },
];

export function StatsPage() {
  const [stats, setStats] = useState<AllianceStatsFull | null>(null);
  const [history, setHistory] = useState<AllianceStats[]>([]);
  const [selectedHistoryPeriod, setSelectedHistoryPeriod] = useState(2); // Default: 30 Tage
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetchAllianceStatsFull();
        if (response.success && response.data) {
          setStats(response.data);
        } else {
          setError('Keine Statistiken verfugbar');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const { period, limit } = HISTORY_PERIODS[selectedHistoryPeriod];
        const response = await fetchAllianceStatsHistory(period, limit);
        if (response.success && response.data) {
          // Sort by date ascending for chart
          setHistory([...response.data].reverse());
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, [selectedHistoryPeriod]);

  const formatCredits = (credits: number) => {
    return credits.toLocaleString('de-DE');
  };

  const formatCreditsShort = (credits: number) => {
    if (credits >= 1000000000) {
      return `${(credits / 1000000000).toFixed(1)}B`;
    }
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(1)}M`;
    }
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(0)}K`;
    }
    return credits.toString();
  };

  const formatChange = (value: number, isRank = false) => {
    const prefix = value > 0 ? '+' : '';
    if (isRank) {
      return `${prefix}${value}`;
    }
    return `${prefix}${value.toLocaleString('de-DE')}`;
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    if (days < 30) {
      return `${days}d`;
    }
    const months = Math.floor(days / 30);
    return `${months}mo`;
  };

  const renderChangeCard = (period: TimePeriod, change: PeriodChange | null) => {
    const hasData = change !== null;

    return (
      <div key={period} className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500">{PERIOD_LABELS[period]}</h3>
          {hasData && change.isPartial && (
            <span
              className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"
              title={`Nur ${formatDuration(change.actualHours)} Daten verfugbar`}
            >
              ~{formatDuration(change.actualHours)}
            </span>
          )}
        </div>

        {hasData ? (
          <div className="space-y-4">
            {/* Rank Change */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Platzierung</div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    change.rankChange > 0
                      ? 'text-green-600'
                      : change.rankChange < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {formatChange(change.rankChange, true)}
                </span>
                <span className="text-sm text-gray-500">
                  (#{change.oldRank} → #{stats?.rank})
                </span>
              </div>
            </div>

            {/* Credits Change */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Credits</div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    change.creditsChange > 0
                      ? 'text-green-600'
                      : change.creditsChange < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {formatChange(change.creditsChange)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {formatCredits(change.oldCredits)} → {formatCredits(stats?.creditsTotal ?? 0)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm">Keine Daten verfugbar</div>
        )}
      </div>
    );
  };

  // Prepare chart data with timestamps for proper time-based axis
  const chartData = history
    .map((stat) => ({
      timestamp: new Date(stat.recordedAt).getTime(),
      rank: stat.rank,
      credits: Number(stat.creditsTotal),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Format timestamp for X-axis display
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    const period = HISTORY_PERIODS[selectedHistoryPeriod];

    if (period.period === 'hour') {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    if (period.period === 'month') {
      return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Format timestamp for tooltip
  const formatTooltipLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error || 'Keine Statistiken verfugbar'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Current Stats Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-6">{stats.allianceName}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Rank */}
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-sm text-amber-600 mb-1">Aktuelle Platzierung</div>
            <div className="text-4xl font-bold text-amber-700">#{stats.rank}</div>
          </div>

          {/* Total Credits */}
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 mb-1">Gesamt Credits</div>
            <div className="text-4xl font-bold text-green-700">{formatCredits(stats.creditsTotal)}</div>
          </div>
        </div>
      </div>

      {/* Change Cards */}
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Veranderungen</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(['24h', '7d', '1mo', '12mo'] as TimePeriod[]).map((period) =>
          renderChangeCard(period, stats.changes[period])
        )}
      </div>

      {/* Charts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-700">Verlauf</h2>
          <div className="flex gap-2">
            {HISTORY_PERIODS.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => setSelectedHistoryPeriod(idx)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedHistoryPeriod === idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            Keine Verlaufsdaten verfugbar
          </div>
        ) : (
          <div className="space-y-8">
            {/* Rank Chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Platzierung</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxis}
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      reversed
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickFormatter={(value) => `#${value}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`#${value}`, 'Platzierung']}
                      labelFormatter={formatTooltipLabel}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rank"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: '#d97706' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Credits Chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Credits</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxis}
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      tickFormatter={formatCreditsShort}
                      domain={[(dataMin: number) => dataMin * 0.999, (dataMax: number) => dataMax * 1.001]}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCredits(value), 'Credits']}
                      labelFormatter={formatTooltipLabel}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="credits"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: '#16a34a' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="mt-6 text-center text-sm text-gray-400">
        Zuletzt aktualisiert: {new Date(stats.recordedAt).toLocaleString('de-DE')}
      </div>
    </div>
  );
}
