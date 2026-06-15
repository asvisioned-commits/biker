'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from './route-bundle-visualizer.module.css';

export interface RouteStop {
  id: string;
  type: 'pickup' | 'dropoff';
  address: string;
  lat: number;
  lng: number;
  sequence: number;
  jobRef: string;
}

interface RouteBundleVisualizerProps {
  stops: RouteStop[];
  totalEarnings: number;
  totalDistanceKm: number;
  estimatedTimeMins: number;
  onAccept: () => void;
  isAccepting?: boolean;
}

export default function RouteBundleVisualizer({
  stops,
  totalEarnings,
  totalDistanceKm,
  estimatedTimeMins,
  onAccept,
  isAccepting = false,
}: RouteBundleVisualizerProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const mapId = useRef(`bundle-map-${Math.random().toString(36).substr(2, 9)}`);

  // Dynamically load Leaflet
  useEffect(() => {
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
  }, []);

  // Initialize Map and Render route
  useEffect(() => {
    if (!leafletLoaded || stops.length === 0) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapId.current);
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Sort stops by sequence
    const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

    // Initial center on first stop
    const firstStop = sortedStops[0];
    const map = L.map(mapId.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([firstStop.lat, firstStop.lng], 13);
    
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add markers with custom sequence labels
    const bounds = L.latLngBounds([]);
    
    sortedStops.forEach((stop) => {
      const stopLatLng: [number, number] = [stop.lat, stop.lng];
      bounds.extend(stopLatLng);

      const isPickup = stop.type === 'pickup';
      const labelText = `${isPickup ? '↑' : '↓'}${stop.sequence}`;
      const markerHtml = `
        <div class="${styles.markerPin} ${isPickup ? styles.pickupMarker : styles.dropoffMarker}">
          <span class="${styles.markerLabel}">${labelText}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'leaflet-bundle-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupContent = `
        <div style="font-family: var(--font-sans); font-size: 11px;">
          <b>Stop #${stop.sequence} (${isPickup ? 'Pickup' : 'Dropoff'})</b><br/>
          Ref: ${stop.jobRef}<br/>
          Addr: ${stop.address}
        </div>
      `;

      const marker = L.marker(stopLatLng, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);
        
      markersRef.current.push(marker);
    });

    // Draw route polyline linking stops in order
    const points = sortedStops.map(s => [s.lat, s.lng] as [number, number]);
    polylineRef.current = L.polyline(points, {
      color: '#CCFF00',
      weight: 4,
      opacity: 0.8,
      dashArray: '8, 8',
      className: 'bundleRouteLine'
    }).addTo(map);

    // Fit map bounds
    map.fitBounds(bounds, { padding: [30, 30] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, stops]);

  return (
    <div className={styles.container}>
      <div className={styles.metricsBar}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Payout bundle</span>
          <span className={styles.metricVal} style={{ color: 'var(--color-primary-500)' }}>
            +${totalEarnings.toFixed(2)}
          </span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Distance</span>
          <span className={styles.metricVal}>{totalDistanceKm.toFixed(1)} km</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Time Est.</span>
          <span className={styles.metricVal}>{estimatedTimeMins} mins</span>
        </div>
      </div>

      <div className={styles.mapWrapper}>
        <div id={mapId.current} className={styles.mapContainer} />
        {!leafletLoaded && (
          <div className={styles.loadingOverlay}>
            <div className="spinner" />
            <span>Loading Dispatch Map...</span>
          </div>
        )}
        
        {/* Floating Route Checklist Card overlay on map */}
        <div className={styles.floatingCard}>
          <h4 className={styles.cardTitle}>Optimized Trajectory ({stops.length} stops)</h4>
          <div className={styles.stopList}>
            {stops.sort((a,b)=> a.sequence - b.sequence).map((stop) => (
              <div key={stop.id} className={styles.stopRow}>
                <span className={`${styles.stopSeq} ${stop.type === 'pickup' ? styles.seqPickup : styles.seqDropoff}`}>
                  {stop.sequence}
                </span>
                <div className={styles.stopInfo}>
                  <span className={styles.stopType}>
                    {stop.type === 'pickup' ? 'PICKUP' : 'DROPOFF'} • {stop.jobRef}
                  </span>
                  <span className={styles.stopAddr}>{stop.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actionsBar}>
        <button
          type="button"
          className="btn btn--primary btn--full"
          disabled={isAccepting}
          onClick={onAccept}
        >
          {isAccepting ? 'Locking Bundle Route...' : '⚡ Accept Bundle Jobs'}
        </button>
      </div>
    </div>
  );
}
