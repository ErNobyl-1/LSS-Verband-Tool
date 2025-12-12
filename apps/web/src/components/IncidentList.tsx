import { useState, useEffect } from 'react';
import { Incident } from '../types';
import { useMissionCredits } from '../hooks/useMissionCredits';

interface IncidentListProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
}

// Parse timeleft from rawJson (MILLISECONDS until mission STARTS)
// timeleft > 0: mission hasn't started yet, countdown to start
// timeleft = 0 or null: mission has started
// Returns seconds for consistency with other functions
function getTimeleft(incident: Incident): number | null {
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson || rawJson.timeleft === null || rawJson.timeleft === undefined) {
    return null;
  }
  const timeleftMs = parseInt(String(rawJson.timeleft), 10);
  if (isNaN(timeleftMs) || timeleftMs <= 0) return null;
  // Convert milliseconds to seconds
  return Math.floor(timeleftMs / 1000);
}

// Parse remaining_seconds from rawJson (exact seconds remaining from detail page)
// This is fetched from the mission detail page and is more accurate
function getRemainingSeconds(incident: Incident): { seconds: number; at: Date } | null {
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson || rawJson.remaining_seconds === null || rawJson.remaining_seconds === undefined) {
    return null;
  }
  const seconds = parseInt(String(rawJson.remaining_seconds), 10);
  if (isNaN(seconds) || seconds < 0) return null;

  const atStr = rawJson.remaining_at as string | undefined;
  const at = atStr ? new Date(atStr) : new Date(incident.lastSeenAt);

  return { seconds, at };
}

// Parse progress_percent from rawJson (percentage of time REMAINING)
// 94% = 94% of time remaining (just started), 6% = only 6% left (almost done)
function getProgressPercent(incident: Incident): number | null {
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson || rawJson.progress_percent === null || rawJson.progress_percent === undefined) {
    return null;
  }
  const percent = parseFloat(String(rawJson.progress_percent));
  return isNaN(percent) ? null : percent;
}

// Get participating players from rawJson
function getParticipatingPlayers(incident: Incident): { driving: string[]; atMission: string[] } | null {
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson) return null;

  const driving = Array.isArray(rawJson.players_driving) ? rawJson.players_driving as string[] : [];
  const atMission = Array.isArray(rawJson.players_at_mission) ? rawJson.players_at_mission as string[] : [];

  if (driving.length === 0 && atMission.length === 0) return null;
  return { driving, atMission };
}

// Calculate start time based on timeleft and lastSeenAt
function calculateStartTime(incident: Incident): Date | null {
  const timeleft = getTimeleft(incident);
  if (timeleft === null) return null;

  const lastSeen = new Date(incident.lastSeenAt);
  return new Date(lastSeen.getTime() + timeleft * 1000);
}

// Calculate end time based on remaining_seconds
function calculateEndTime(incident: Incident): Date | null {
  const remaining = getRemainingSeconds(incident);
  if (!remaining) return null;

  return new Date(remaining.at.getTime() + remaining.seconds * 1000);
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Hook to update countdown every second
function useLiveCountdown(incident: Incident): { toStart: number | null; remaining: number | null } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for countdown to start (timeleft > 0)
  const timeleft = getTimeleft(incident);
  let toStart: number | null = null;
  if (timeleft !== null) {
    const lastSeen = new Date(incident.lastSeenAt).getTime();
    const elapsedSince = Math.floor((now - lastSeen) / 1000);
    toStart = Math.max(0, timeleft - elapsedSince);
  }

  // Check for remaining time (from mission detail page)
  const remainingData = getRemainingSeconds(incident);
  let remaining: number | null = null;
  if (remainingData) {
    const elapsedSince = Math.floor((now - remainingData.at.getTime()) / 1000);
    remaining = Math.max(0, remainingData.seconds - elapsedSince);
  }

  return { toStart, remaining };
}

// Component for planned mission time display
function PlannedMissionTimer({ incident }: { incident: Incident }) {
  const { toStart, remaining } = useLiveCountdown(incident);
  const progressPercent = getProgressPercent(incident);
  const startTime = calculateStartTime(incident);
  const endTime = calculateEndTime(incident);
  const players = getParticipatingPlayers(incident);

  // Combine all unique players
  const allPlayers = players
    ? [...new Set([...players.atMission, ...players.driving])]
    : [];

  // Mission hasn't started yet - show countdown to start
  if (toStart !== null && toStart > 0) {
    return (
      <div className="mt-2 px-2 py-1 rounded border text-xs bg-blue-50 border-blue-200 text-blue-700">
        <div className="flex justify-between">
          <span>Beginn in:</span>
          <span className="font-mono font-medium">
            {formatTimeRemaining(toStart)}
            {startTime && ` (${formatTime(startTime)})`}
          </span>
        </div>
        {allPlayers.length > 0 && (
          <div className="mt-1 text-gray-600">
            <span>Spieler: </span>
            <span>{allPlayers.join(', ')}</span>
          </div>
        )}
      </div>
    );
  }

  // Mission is running - show exact remaining time if available
  if (remaining !== null) {
    // Warning thresholds: <=30 min = orange, <=10 min = red
    const isWarning = remaining <= 30 * 60;
    const isCritical = remaining <= 10 * 60;

    let bgColor = 'bg-green-50 border-green-200';
    let textColor = 'text-green-700';

    if (isCritical) {
      bgColor = 'bg-red-100 border-red-300';
      textColor = 'text-red-700';
    } else if (isWarning) {
      bgColor = 'bg-orange-100 border-orange-300';
      textColor = 'text-orange-700';
    }

    return (
      <div className={`mt-2 px-2 py-1 rounded border text-xs ${bgColor} ${textColor}`}>
        <div className="flex justify-between">
          <span>{isCritical ? '⚠️ Endet in:' : isWarning ? '⏰ Endet in:' : 'Restzeit:'}</span>
          <span className="font-mono font-medium">
            {formatTimeRemaining(remaining)}
            {endTime && ` (${formatTime(endTime)})`}
          </span>
        </div>
        {allPlayers.length > 0 && (
          <div className="mt-1 text-gray-600">
            <span>Spieler: </span>
            <span>{allPlayers.join(', ')}</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback: show progress bar percentage if no exact time available
  if (progressPercent !== null) {
    // progressPercent = remaining time percentage
    // Warning: <=30% remaining = orange, <=10% = red
    const isWarning = progressPercent <= 30;
    const isCritical = progressPercent <= 10;

    let bgColor = 'bg-green-50 border-green-200';
    let textColor = 'text-green-700';
    let barColor = 'bg-green-500';

    if (isCritical) {
      bgColor = 'bg-red-100 border-red-300';
      textColor = 'text-red-700';
      barColor = 'bg-red-500';
    } else if (isWarning) {
      bgColor = 'bg-orange-100 border-orange-300';
      textColor = 'text-orange-700';
      barColor = 'bg-orange-500';
    }

    return (
      <div className={`mt-2 px-2 py-1 rounded border text-xs ${bgColor} ${textColor}`}>
        <div className="flex justify-between mb-1">
          <span>{isCritical ? '⚠️ Fast vorbei!' : isWarning ? '⏰ Bald vorbei' : 'Läuft'}</span>
          <span className="font-mono font-medium">{Math.round(progressPercent)}% übrig</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${progressPercent}%` }} />
        </div>
        {allPlayers.length > 0 && (
          <div className="mt-1 text-gray-600">
            <span>Spieler: </span>
            <span>{allPlayers.join(', ')}</span>
          </div>
        )}
      </div>
    );
  }

  // No data available
  return null;
}

function getStatusColor(status: string | null) {
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };
  return colors[status || 'yellow'] || colors.yellow;
}

function formatCredits(credits: number | null): string {
  if (credits === null) return '';
  return `⌀ ${credits.toLocaleString('de-DE')} ¢`;
}

function cleanTitle(title: string) {
  return title.replace(/\s*\[Verband\]\s*/g, '').trim();
}

export function IncidentList({ incidents, loading, error }: IncidentListProps) {
  const { getCredits } = useMissionCredits();

  if (loading && incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Einsätze...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Fehler: {error}</div>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Keine Einsätze gefunden</div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {incidents.map((incident) => {
        const statusColor = getStatusColor(incident.status);
        const avgCredits = getCredits(incident.type);

        return (
          <div
            key={incident.id}
            className="flex hover:bg-gray-50 transition-colors"
          >
            {/* Status indicator stripe */}
            <div className={`w-2 flex-shrink-0 ${statusColor}`} />

            <div className="flex-1 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {cleanTitle(incident.title)}
                  </h3>
                  {incident.address && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {incident.address}
                    </p>
                  )}
                </div>
                {avgCredits !== null && (
                  <div className="text-sm font-medium text-gray-600 whitespace-nowrap">
                    {formatCredits(avgCredits)}
                  </div>
                )}
              </div>

              {/* Show timer for planned missions */}
              {incident.category === 'planned' && (
                <PlannedMissionTimer incident={incident} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
