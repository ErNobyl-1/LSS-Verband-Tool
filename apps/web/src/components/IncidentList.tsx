import { useState, useEffect } from 'react';
import { Incident } from '../types';
import { useMissionCredits } from '../hooks/useMissionCredits';
import { usePlayerNames } from '../hooks/usePlayerNames';
import { User } from '../hooks/useAuth';

interface IncidentListProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  user?: User | null;
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

// Parse duration_seconds from rawJson (mission duration from detail page)
// Used to calculate end time for planned missions that haven't started yet
function getDurationSeconds(incident: Incident): number | null {
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson || rawJson.duration_seconds === null || rawJson.duration_seconds === undefined) {
    return null;
  }
  const seconds = parseInt(String(rawJson.duration_seconds), 10);
  if (isNaN(seconds) || seconds <= 0) return null;
  return seconds;
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

// Generate a consistent color based on player name using a hash function
function getPlayerColor(name: string): { bg: string; text: string; border: string } {
  // Color palette with good contrast - tailwind color classes
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  ];

  // Simple hash function to get consistent index from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Player badge component
function PlayerBadge({ name, displayName }: { name: string; displayName: string }) {
  const color = getPlayerColor(name);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
    >
      {displayName}
    </span>
  );
}

// Player badges list component
function PlayerBadges({ players, getDisplayName }: { players: { driving: string[]; atMission: string[] }; getDisplayName: (name: string) => string }) {
  const atMissionOnly = players.atMission.filter(p => !players.driving.includes(p));
  const allPlayers = [...players.driving, ...atMissionOnly];

  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {allPlayers.map(name => (
        <PlayerBadge key={name} name={name} displayName={getDisplayName(name)} />
      ))}
    </div>
  );
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

// Calculate end time for missions that haven't started yet (startTime + duration)
function calculatePlannedEndTime(incident: Incident): Date | null {
  const startTime = calculateStartTime(incident);
  const duration = getDurationSeconds(incident);
  if (!startTime || !duration) return null;
  return new Date(startTime.getTime() + duration * 1000);
}

// Format duration in hours and minutes (e.g., "2 Std." or "1 Std. 30 Min.")
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} Std. ${minutes} Min.`;
  } else if (hours > 0) {
    return `${hours} Std.`;
  } else {
    return `${minutes} Min.`;
  }
}

// Component for planned mission time display (timer only, no players)
function PlannedMissionTimer({ incident }: { incident: Incident }) {
  const { toStart, remaining } = useLiveCountdown(incident);
  const progressPercent = getProgressPercent(incident);
  const startTime = calculateStartTime(incident);
  const endTime = calculateEndTime(incident);
  const plannedEndTime = calculatePlannedEndTime(incident);
  const duration = getDurationSeconds(incident);

  // Mission hasn't started yet - show countdown to start AND end time if duration is known
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
        {plannedEndTime && duration && (
          <div className="flex justify-between mt-1 text-blue-600">
            <span>Ende ({formatDuration(duration)}):</span>
            <span className="font-mono font-medium">
              {formatTime(plannedEndTime)}
            </span>
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
      </div>
    );
  }

  // No data available
  return null;
}

// Component for displaying participating players
function MissionPlayers({ incident, getDisplayName }: { incident: Incident; getDisplayName: (name: string) => string }) {
  const players = getParticipatingPlayers(incident);
  if (!players) return null;

  return <PlayerBadges players={players} getDisplayName={getDisplayName} />;
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

// Check if user has vehicles at this incident
function userHasVehiclesAtIncident(incident: Incident, userName: string | undefined): boolean {
  if (!userName) return false;
  const rawJson = incident.rawJson as Record<string, unknown> | null;
  if (!rawJson) return false;

  const driving = Array.isArray(rawJson.players_driving) ? rawJson.players_driving as string[] : [];
  const atMission = Array.isArray(rawJson.players_at_mission) ? rawJson.players_at_mission as string[] : [];

  return driving.includes(userName) || atMission.includes(userName);
}

export function IncidentList({ incidents, loading, error, user }: IncidentListProps) {
  const { getCredits } = useMissionCredits();
  const { getDisplayName } = usePlayerNames();
  const userName = user?.allianceMemberId ? user.lssName : undefined;

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
    <div className="space-y-2 p-2">
      {incidents.map((incident) => {
        const statusColor = getStatusColor(incident.status);
        const avgCredits = getCredits(incident.type);
        const hasOwnVehicles = userHasVehiclesAtIncident(incident, userName);

        return (
          <div
            key={incident.id}
            className={`flex rounded-lg border shadow-sm hover:shadow-md transition-all overflow-hidden ${
              hasOwnVehicles
                ? 'bg-green-50 border-green-300 hover:border-green-400'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Status indicator stripe */}
            <div className={`w-2 flex-shrink-0 ${statusColor}`} />

            <div className="flex-1 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {cleanTitle(incident.title)}
                  </h3>
                  {incident.address && (
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {incident.address}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {avgCredits !== null && (
                    <div className="text-sm font-medium text-gray-600 whitespace-nowrap">
                      {formatCredits(avgCredits)}
                    </div>
                  )}
                  {(incident.category === 'planned' || incident.category === 'emergency') && (
                    <MissionPlayers incident={incident} getDisplayName={getDisplayName} />
                  )}
                </div>
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
