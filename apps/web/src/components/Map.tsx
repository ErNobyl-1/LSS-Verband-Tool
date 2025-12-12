import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Incident } from '../types';

interface MapProps {
  incidents: Incident[];
}

function getMarkerColor(source: string): string {
  const colors: Record<string, string> = {
    alliance: '#3b82f6', // blue
    alliance_event: '#8b5cf6', // purple
    own: '#64748b', // slate
    own_shared: '#06b6d4', // cyan
    unknown: '#6b7280', // gray
  };
  return colors[source] || colors.unknown;
}

function cleanTitle(title: string) {
  return title.replace(/\s*\[Verband\]\s*/g, '').trim();
}

export function Map({ incidents }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<number, maplibregl.Marker>>(new globalThis.Map());

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

    // Remove markers for incidents that no longer exist
    currentMarkers.forEach((marker, id) => {
      if (!incidentIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });

    // Add or update markers for current incidents
    incidents.forEach((incident) => {
      if (!incident.lat || !incident.lon) return;

      let marker = currentMarkers.get(incident.id);

      if (!marker) {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'incident-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.backgroundColor = getMarkerColor(incident.source);

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.lon, incident.lat])
          .addTo(map.current!);

        // Create popup
        const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
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
      } else {
        // Update existing marker position
        marker.setLngLat([incident.lon, incident.lat]);
      }
    });
  }, [incidents]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
