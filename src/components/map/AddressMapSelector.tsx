'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/geo';
import { DEFAULT_CENTER } from '@/lib/geo';

interface AddressMapSelectorProps {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  mode: 'pickup' | 'dropoff';
  onSelectPickup: (lat: number, lng: number) => void;
  onSelectDropoff: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
}

const pinSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>` +
  `<circle cx="12" cy="10" r="3" fill="white"/>` +
  `</svg>`;

function createPinIcon(color: string) {
  return L.divIcon({
    className: 'biker-pin-marker',
    html: `<div class="biker-pin" style="--pin-color: ${color}">${pinSvg(color)}</div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  });
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({
  pickup,
  dropoff,
  mode,
}: {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  mode: 'pickup' | 'dropoff';
}) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    // Zoom and center to active pin if exists, or fit both if both exist
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (mode === 'pickup' && pickup) {
      map.setView([pickup.lat, pickup.lng], 14, { animate: true });
    } else if (mode === 'dropoff' && dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14, { animate: true });
    } else if (!hasCentered.current) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
      hasCentered.current = true;
    }
  }, [map, pickup, dropoff, mode]);

  return null;
}

export default function AddressMapSelector({
  pickup,
  dropoff,
  mode,
  onSelectPickup,
  onSelectDropoff,
  height = '100%',
  className = '',
}: AddressMapSelectorProps) {
  const center = useMemo(() => {
    if (mode === 'pickup' && pickup) return [pickup.lat, pickup.lng] as [number, number];
    if (mode === 'dropoff' && dropoff) return [dropoff.lat, dropoff.lng] as [number, number];
    return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng] as [number, number];
  }, [pickup, dropoff, mode]);

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === 'pickup') {
      onSelectPickup(lat, lng);
    } else {
      onSelectDropoff(lat, lng);
    }
  };

  return (
    <div className={`biker-map-selector ${className}`} style={{ height, width: '100%', position: 'relative' }}>
      {/* Active Selection Overlay Instruction Banner */}
      <div className="map-instructions-banner">
        {mode === 'pickup' ? (
          <div className="banner-content banner-content--pickup">
            <span className="banner-icon">📍</span>
            <span className="banner-text">Tap on map to set <strong>Pickup Location</strong> (Blue Pin)</span>
          </div>
        ) : (
          <div className="banner-content banner-content--dropoff">
            <span className="banner-icon">🟢</span>
            <span className="banner-text">Tap on map to set <strong>Drop-off Location</strong> (Green Pin)</span>
          </div>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController pickup={pickup} dropoff={dropoff} mode={mode} />
        <MapClickHandler onClick={handleMapClick} />

        {/* Pickup marker */}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={createPinIcon('#2563eb')}>
            {/* Popups removed to make clicks smoother */}
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={createPinIcon('#16a34a')}>
            {/* Popups removed to make clicks smoother */}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
