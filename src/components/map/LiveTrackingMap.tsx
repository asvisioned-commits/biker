'use client';

import { useEffect, useState, useRef } from 'react';
import styles from './live-tracking-map.module.css';

interface LiveTrackingMapProps {
  pickupCoords: [number, number];
  dropoffCoords: [number, number];
  riderCoords?: [number, number] | null;
  riderHeading?: number | null;
  riderName?: string;
  className?: string;
}

export default function LiveTrackingMap({
  pickupCoords,
  dropoffCoords,
  riderCoords = null,
  riderHeading = null,
  riderName = 'Rider',
  className = '',
}: LiveTrackingMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const mapId = useRef(`live-tracking-map-${Math.random().toString(36).substr(2, 9)}`);

  // Load Leaflet dynamically
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

  // Fetch OSRM Route
  useEffect(() => {
    let active = true;
    const fetchRoute = async () => {
      setIsRoutingLoading(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropoffCoords[1]},${dropoffCoords[0]}?geometries=geojson&overview=full`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM API returned error status');
        const data = await res.json();
        
        if (active && data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          setRouteCoords(coords);
          setIsRoutingLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch street route from OSRM, falling back to direct line:', err);
      }
      
      if (active) {
        // Fallback to straight line
        setRouteCoords([pickupCoords, dropoffCoords]);
        setIsRoutingLoading(false);
      }
    };

    fetchRoute();
    return () => {
      active = false;
    };
  }, [pickupCoords[0], pickupCoords[1], dropoffCoords[0], dropoffCoords[1]]);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapId.current);
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }

    // Determine initial center and bounds
    const center: [number, number] = [
      (pickupCoords[0] + dropoffCoords[0]) / 2,
      (pickupCoords[1] + dropoffCoords[1]) / 2,
    ];

    const map = L.map(mapId.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(center, 13);
    
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Create Markers
    const pickupIcon = L.divIcon({
      html: `<div class="${styles.pickupIcon}">🏪</div>`,
      className: 'leaflet-pickup-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const dropoffIcon = L.divIcon({
      html: `<div class="${styles.dropoffIcon}">🏠</div>`,
      className: 'leaflet-dropoff-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    pickupMarkerRef.current = L.marker(pickupCoords, { icon: pickupIcon })
      .addTo(map)
      .bindPopup('<b>Pickup Point</b>');

    dropoffMarkerRef.current = L.marker(dropoffCoords, { icon: dropoffIcon })
      .addTo(map)
      .bindPopup('<b>Dropoff Point</b>');

    // Create Polyline (initially empty or fallback/fetched coords)
    const polylineCoords = routeCoords.length > 0 ? routeCoords : [pickupCoords, dropoffCoords];
    routePolylineRef.current = L.polyline(polylineCoords, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      className: 'movingRouteLine',
    }).addTo(map);

    // Fit map bounds to contain pickup and dropoff
    const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
    if (riderCoords) {
      bounds.extend(riderCoords);
    }
    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Update map features when props/state change
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Update pickup/dropoff marker positions if changed
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng(pickupCoords);
    }
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setLatLng(dropoffCoords);
    }

    // Update route polyline path
    if (routePolylineRef.current) {
      const polylineCoords = routeCoords.length > 0 ? routeCoords : [pickupCoords, dropoffCoords];
      routePolylineRef.current.setLatLngs(polylineCoords);
    }

    // Update or create Rider Marker
    if (riderCoords) {
      const riderHeadingStyle = riderHeading !== null ? `transform: rotate(${riderHeading}deg);` : '';
      const riderIcon = L.divIcon({
        html: `
          <div class="${styles.riderIconContainer}">
            <div class="${styles.pulsingRadar}"></div>
            <div class="${styles.riderIcon}" style="${riderHeadingStyle}">🏍️</div>
            ${riderHeading !== null ? `<div class="${styles.riderDirectionArrow}" style="${riderHeadingStyle}"></div>` : ''}
          </div>
        `,
        className: 'leaflet-rider-icon',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng(riderCoords);
        riderMarkerRef.current.setIcon(riderIcon);
      } else {
        riderMarkerRef.current = L.marker(riderCoords, { icon: riderIcon })
          .addTo(mapRef.current)
          .bindPopup(`<b>${riderName}</b> (Active Rider)`);
      }
    } else {
      // Remove rider marker if it was active but is no longer provided
      if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
      }
    }

    // Adjust bounds if coordinates update
    const boundsPoints = [pickupCoords, dropoffCoords];
    if (riderCoords) {
      boundsPoints.push(riderCoords);
    }
    const bounds = L.latLngBounds(boundsPoints);
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

  }, [pickupCoords, dropoffCoords, riderCoords, riderHeading, routeCoords, leafletLoaded, riderName]);

  return (
    <div className={`${styles.mapWrapper} ${className}`}>
      <div id={mapId.current} className={styles.mapContainer} />
      {(!leafletLoaded || isRoutingLoading) && (
        <div className={styles.loadingOverlay}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span>{!leafletLoaded ? 'Loading Map Engine...' : 'Fetching optimal street route...'}</span>
        </div>
      )}
    </div>
  );
}
