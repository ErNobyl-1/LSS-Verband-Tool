import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Incident } from '../types';
import { User } from '../hooks/useAuth';

interface MapProps {
  incidents: Incident[];
  user?: User | null;
}

function getMarkerColor(status: string | null): string {
  switch (status) {
    case 'red':
      return '#ef4444'; // red - unbearbeitet
    case 'yellow':
      return '#eab308'; // yellow - Anfahrt
    case 'green':
      return '#22c55e'; // green - In Durchführung
    default:
      return '#6b7280'; // gray - unknown
  }
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

function createRoundMarker(color: string, hasOwnVehicles: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'incident-marker incident-marker-round';
  el.style.width = '20px';
  el.style.height = '20px';
  el.style.borderRadius = '50%';
  el.style.border = hasOwnVehicles ? '3px solid #22c55e' : '3px solid white';
  el.style.boxShadow = hasOwnVehicles ? '0 2px 6px rgba(34,197,94,0.5)' : '0 2px 4px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';
  el.style.backgroundColor = color;
  return el;
}

function createPinMarker(color: string, hasOwnVehicles: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'incident-marker incident-marker-pin';
  el.style.cursor = 'pointer';

  const strokeColor = hasOwnVehicles ? '#22c55e' : 'white';
  const strokeWidth = hasOwnVehicles ? '3' : '2';
  const shadowStyle = hasOwnVehicles
    ? 'filter: drop-shadow(0 2px 4px rgba(34,197,94,0.5));'
    : 'filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));';

  // SVG pin marker - tip points to exact coordinates
  el.innerHTML = `
    <svg width="24" height="36" viewBox="0 0 24 36" style="${shadowStyle}">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z"
            fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>
  `;

  return el;
}

function cleanTitle(title: string) {
  return title.replace(/\s*\[Verband\]\s*/g, '').trim();
}

export function Map({ incidents, user }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<number, maplibregl.Marker>>(new globalThis.Map());
  // Track marker metadata for live updates
  const markerDataRef = useRef<globalThis.Map<number, { status: string | null; category: string; hasOwnVehicles: boolean }>>(new globalThis.Map());

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.de/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [10.4515, 51.1657], // Germany center
      zoom: 6,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when incidents change
  useEffect(() => {
    if (!map.current) return;

    const currentMarkers = markersRef.current;
    const incidentIds = new Set(incidents.map((i) => i.id));

    const markerData = markerDataRef.current;
    const userName = user?.allianceMemberId ? user.lssName : undefined;

    // Remove markers for incidents that no longer exist
    currentMarkers.forEach((marker, id) => {
      if (!incidentIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
        markerData.delete(id);
      }
    });

    // Add or update markers for current incidents
    incidents.forEach((incident) => {
      if (!incident.lat || !incident.lon) return;

      let marker = currentMarkers.get(incident.id);
      const hasOwnVehicles = userHasVehiclesAtIncident(incident, userName);

      const existingData = markerData.get(incident.id);
      const needsRecreate = marker && existingData && (
        existingData.status !== incident.status ||
        existingData.category !== incident.category ||
        existingData.hasOwnVehicles !== hasOwnVehicles
      );

      // Remove old marker if status/category/ownership changed
      if (needsRecreate && marker) {
        marker.remove();
        currentMarkers.delete(incident.id);
        marker = undefined;
      }

      if (!marker) {
        // Create new marker based on category and status
        const color = getMarkerColor(incident.status);
        const isPlanned = incident.category === 'planned';
        const el = isPlanned ? createRoundMarker(color, hasOwnVehicles) : createPinMarker(color, hasOwnVehicles);

        // Pin markers need anchor at bottom tip; round markers centered
        const anchor = isPlanned ? 'center' : 'bottom';

        marker = new maplibregl.Marker({ element: el, anchor })
          .setLngLat([incident.lon, incident.lat])
          .addTo(map.current!);

        // Create popup with appropriate offset based on marker type
        const popupOffset = isPlanned ? 12 : 36;
        const popup = new maplibregl.Popup({ offset: popupOffset, closeButton: false })
          .setHTML(`
            <div style="padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${cleanTitle(incident.title)}</div>
              ${incident.address ? `<div style="font-size: 12px; color: #666;">${incident.address}</div>` : ''}
              <div style="font-size: 11px; color: #888; margin-top: 4px;">
                ${incident.status === 'red' ? 'Unbearbeitet' : incident.status === 'yellow' ? 'Anfahrt' : incident.status === 'green' ? 'In Durchführung' : 'Unbekannt'}
              </div>
            </div>
          `);

        marker.setPopup(popup);
        currentMarkers.set(incident.id, marker);
        markerData.set(incident.id, { status: incident.status, category: incident.category, hasOwnVehicles });
      } else {
        // Update existing marker position only
        marker.setLngLat([incident.lon, incident.lat]);
      }
    });
  }, [incidents, user]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
