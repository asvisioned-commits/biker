'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './map-picker.module.css';

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coords: [number, number], address: string, landmarkNote: string) => void;
  title: string;
  initialCoords: [number, number] | null;
}

const POPULAR_LOCATIONS = [
  { name: "Sam Levy's Village, Borrowdale", lat: -17.7502, lng: 31.0858 },
  { name: "Avondale Shops, King George Rd", lat: -17.7994, lng: 31.0378 },
  { name: "Eastgate Mall, Harare CBD", lat: -17.8312, lng: 31.0521 },
  { name: "Borrowdale Brooke Golf Estate", lat: -17.7289, lng: 31.1345 },
  { name: "Arundel Office Park, Mount Pleasant", lat: -17.7812, lng: 31.0531 },
  { name: "Joina City, Harare CBD", lat: -17.8306, lng: 31.0494 },
  { name: "Belgravia Shops, Second Street Extension", lat: -17.7932, lng: 31.0468 },
  { name: "Kensington Shops, Avondale", lat: -17.8015, lng: 31.0298 },
  { name: "Westgate Shopping Mall, Harare", lat: -17.7667, lng: 30.9856 },
  { name: "Harare International Airport (RG Mugabe)", lat: -17.9312, lng: 31.0928 },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export default function MapPickerModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  initialCoords,
}: MapPickerModalProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>(
    initialCoords || [-17.8252, 31.0335] // Default to Harare CBD
  );
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [landmarkNote, setLandmarkNote] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapId = 'leaflet-picker-map';

  // Load Leaflet dynamically
  useEffect(() => {
    if (!isOpen) return;

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, [isOpen]);

  // Handle address/landmark resolution when selected coordinates change
  useEffect(() => {
    let closestLocation = null;
    let minDistance = Infinity;

    for (const loc of POPULAR_LOCATIONS) {
      const dist = calculateDistance(selectedCoords[0], selectedCoords[1], loc.lat, loc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestLocation = loc;
      }
    }

    // Radius detection threshold: 400 meters
    if (closestLocation && minDistance <= 400) {
      setResolvedAddress(closestLocation.name);
      setIsCustomLocation(false);
    } else {
      setResolvedAddress(`Custom Location (${selectedCoords[0].toFixed(6)}, ${selectedCoords[1].toFixed(6)})`);
      setIsCustomLocation(true);
    }
  }, [selectedCoords]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapId);
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }

    const map = L.map(mapId).setView(selectedCoords, 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    const createCustomIcon = () => {
      return L.divIcon({
        html: `<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform-origin: bottom center; animation: bounce 0.5s ease-out;">📍</div>`,
        className: 'custom-picker-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      });
    };

    const marker = L.marker(selectedCoords, {
      icon: createCustomIcon(),
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    // Listen to drag event
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setSelectedCoords([position.lat, position.lng]);
    });

    // Listen to click on map to move marker
    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng);
      setSelectedCoords([e.latlng.lat, e.latlng.lng]);
    });

    // Request client geolocation if available and not set
    if (!initialCoords && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        marker.setLatLng([latitude, longitude]);
        setSelectedCoords([latitude, longitude]);
      }, () => {});
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, leafletLoaded]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedCoords, resolvedAddress, landmarkNote);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div className={styles.mapContainerWrapper}>
          <div className={styles.floatingInstructions}>
            👈 Drag marker or tap map to adjust location
          </div>
          <div id={mapId} className={styles.mapContainer} />
          {!leafletLoaded && <div className={styles.mapLabel}>Loading map engine...</div>}
        </div>

        <div className={styles.footer}>
          <div className={styles.resolvedCard}>
            <span className={styles.resolvedLabel}>Selected Point</span>
            <span className={styles.resolvedName}>{resolvedAddress}</span>
            {isCustomLocation && (
              <div className={styles.customNoteWrapper}>
                <input
                  type="text"
                  placeholder="Enter landmark note (e.g., Brown gate, opposite shops)"
                  className={styles.customNoteInput}
                  value={landmarkNote}
                  onChange={(e) => setLandmarkNote(e.target.value.slice(0, 120))}
                />
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className="btn btn--secondary btn--lg" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary btn--lg btn--full" onClick={handleConfirm}>
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
