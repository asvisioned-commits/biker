'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/geo';
import { DEFAULT_CENTER } from '@/lib/geo';

interface MatchingMapProps {
  pickup: LatLng;
  dropoff?: LatLng;
  className?: string;
}

interface GhostRider {
  id: string;
  lat: number;
  lng: number;
  status: 'searching' | 'evaluating' | 'accepted' | 'declined';
}

const bikeSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="5.5" cy="17.5" r="3.5"/>` +
  `<circle cx="18.5" cy="17.5" r="3.5"/>` +
  `<path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>` +
  `</svg>`;

function createGhostRiderIcon(status: GhostRider['status']) {
  const colors = {
    searching: '#3b82f6',
    evaluating: '#f59e0b',
    accepted: '#22c55e',
    declined: '#94a3b8',
  };

  return L.divIcon({
    className: 'biker-ghost-marker',
    html: `<div class="biker-ghost-pin" style="--ghost-color: ${colors[status]}">${bikeSvg}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createPulseIcon() {
  return L.divIcon({
    className: 'biker-pulse-marker',
    html: `<div class="biker-match-pulse-ring"></div>`,
    iconSize: [120, 120],
    iconAnchor: [60, 60],
  });
}

function MapController({ pickup }: { pickup: LatLng }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (!hasFitted.current) {
      map.setView([pickup.lat, pickup.lng], 14);
      hasFitted.current = true;
    }
  }, [map, pickup]);

  return null;
}

/**
 * Animated map used during the rider matching phase.
 * Shows a pulsing pickup zone and ghost riders that appear to be evaluating the offer.
 */
export default function MatchingMap({ pickup, dropoff, className = '' }: MatchingMapProps) {
  const [ghostRiders, setGhostRiders] = useState<GhostRider[]>([]);

  const center = useMemo(() => [pickup.lat, pickup.lng] as [number, number], [pickup]);

  useEffect(() => {
    // Spawn ghost riders around the pickup point
    const spawnRider = () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.002 + Math.random() * 0.006; // ~200-800m
      const rider: GhostRider = {
        id: Math.random().toString(36).slice(2),
        lat: pickup.lat + Math.sin(angle) * distance,
        lng: pickup.lng + Math.cos(angle) * distance,
        status: 'searching',
      };

      setGhostRiders((prev) => [...prev.slice(-7), rider]);

      // Progress through statuses
      setTimeout(() => {
        setGhostRiders((prev) =>
          prev.map((r) => (r.id === rider.id ? { ...r, status: 'evaluating' } : r))
        );
      }, 1200);

      setTimeout(() => {
        setGhostRiders((prev) =>
          prev.map((r) =>
            r.id === rider.id ? { ...r, status: Math.random() > 0.7 ? 'accepted' : 'declined' } : r
          )
        );
      }, 2800);

      setTimeout(() => {
        setGhostRiders((prev) => prev.filter((r) => r.id !== rider.id));
      }, 4200);
    };

    // Initial batch
    for (let i = 0; i < 5; i++) {
      setTimeout(spawnRider, i * 300);
    }

    const interval = setInterval(spawnRider, 1400);
    return () => clearInterval(interval);
  }, [pickup.lat, pickup.lng]);

  return (
    <div className={`biker-matching-map ${className}`}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapController pickup={pickup} />

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]}>
            <span />
          </Marker>
        )}

        {/* Pulsing pickup zone */}
        <Marker position={[pickup.lat, pickup.lng]} icon={createPulseIcon()} interactive={false} />

        {/* Ghost riders */}
        {ghostRiders.map((rider) => (
          <Marker
            key={rider.id}
            position={[rider.lat, rider.lng]}
            icon={createGhostRiderIcon(rider.status)}
            interactive={false}
          />
        ))}
      </MapContainer>
    </div>
  );
}

export { DEFAULT_CENTER };
