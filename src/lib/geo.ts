/**
 * Geospatial utilities for Biker
 * Geocoding, routing, distance calculation, and coordinate helpers.
 */

import { Capacitor } from '@capacitor/core';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  points: LatLng[];
  distanceKm: number;
  durationMinutes: number;
}

/**
 * Calculate straight-line distance between two coordinates in km (Haversine).
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2)),
      Math.sqrt(1 - (sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2)))
    );

  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Decode an OSRM polyline into lat/lng points.
 * Polyline encoding algorithm (Google variant).
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Fetch a driving route from OSRM demo server.
 * Falls back to straight line if OSRM fails.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  profile: 'car' | 'bike' | 'foot' = 'car'
): Promise<RouteResult> {
  if (Capacitor.isNativePlatform() && !IS_DEV && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ from, to, profile }),
      });
      if (response.ok) {
        return (await response.json()) as RouteResult;
      }
    } catch (e) {
      console.warn('Proxy routing failed, falling back:', e);
    }
  }

  // OSRM demo only supports 'driving' reliably; use it for all profiles
  const profileSlug = 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profileSlug}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('OSRM request failed');

    const data = (await response.json()) as {
      code: string;
      routes?: Array<{
        geometry: string;
        distance: number;
        duration: number;
      }>;
    };

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    return {
      points: decodePolyline(route.geometry),
      distanceKm: route.distance / 1000,
      durationMinutes: Math.round(route.duration / 60),
    };
  } catch (error) {
    console.warn('OSRM route failed, falling back to straight line:', error);
    // Fallback: straight line with estimated duration (avg 25 km/h)
    const distanceKm = haversineDistance(from, to);
    return {
      points: [from, to],
      distanceKm,
      durationMinutes: Math.round((distanceKm / 25) * 60),
    };
  }
}

/**
 * Geocode an address string to lat/lng using Nominatim.
 * Zimbabwe-biased via viewbox or country filter when possible.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!address.trim()) return null;

  if (Capacitor.isNativePlatform() && !IS_DEV && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ address }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.location as LatLng;
      }
    } catch (e) {
      console.warn('Proxy geocoding failed, falling back:', e);
    }
  }

  const query = encodeURIComponent(`${address}, Zimbabwe`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Geocoding request failed');

    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!data || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.warn('Geocoding failed:', error);
    return null;
  }
}

/**
 * Format a duration in minutes to a human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format distance in km to a human-readable string.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Get a rough ETA string given current rider position, destination, and speed.
 */
export function estimateEtaMinutes(
  rider: LatLng,
  destination: LatLng,
  speedKmh = 25
): number {
  const distanceKm = haversineDistance(rider, destination);
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

/**
 * Default Harare coordinates for fallback / demo.
 */
export const DEFAULT_CENTER: LatLng = { lat: -17.8292, lng: 31.0522 };

/**
 * Reverse geocode lat/lng coordinates to an address using Nominatim.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (Capacitor.isNativePlatform() && !IS_DEV && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ lat, lng }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.address as string;
      }
    } catch (e) {
      console.warn('Proxy reverse geocoding failed, falling back:', e);
    }
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

  try {
    const response = await fetch(url, {
      headers: { 
        'Accept-Language': 'en',
        'User-Agent': 'BikerOG-Routing-Agent'
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Reverse geocoding request failed');

    const data = await response.json();
    if (!data || !data.display_name) return null;

    return data.display_name;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Clean up address string to fix dictation and geocoding boundary quirks.
 */
export function cleanAddress(address: string): string {
  if (!address) return '';

  let cleaned = address;

  // 1. Fix dictation voice-to-text error "Bayside" -> "Braeside"
  cleaned = cleaned.replace(/\bBayside\b/gi, 'Braeside');

  // 2. Fix OpenStreetMap / Nominatim boundary bug where streets in Harare CBD 
  // (like First Street, Josiah Tongogara, Josiah Chinamano, Robert Mugabe, Samora Machel) 
  // are incorrectly mapped/labeled as being in "Braeside".
  const cbdStreets = [
    'First Street',
    '1st Street',
    'Josiah Chinamano',
    'Josiah Tongogara',
    'Robert Mugabe',
    'Samora Machel',
    'Jason Moyo',
    'Nelson Mandela',
    'Leopold Takawira',
    'Julius Nyerere',
    'Herbert Chitepo',
    'Second Street',
    '2nd Street'
  ];

  const hasCbdStreet = cbdStreets.some(street => cleaned.toLowerCase().includes(street.toLowerCase()));
  if (hasCbdStreet && cleaned.toLowerCase().includes('braeside')) {
    cleaned = cleaned.replace(/Braeside/i, 'CBD');
  }

  // 3. Shorten overly verbose Nominatim results (keep street/building, suburb/CBD, city)
  const parts = cleaned.split(', ');
  if (parts.length >= 4) {
    // Usually parts format: [Street/Building, Suburb/Area, City, Province, Country]
    // We want to keep up to City/Harare, and remove Province + Country.
    const filteredParts = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.toLowerCase().includes('province') || part.toLowerCase() === 'zimbabwe') {
        continue;
      }
      filteredParts.push(part);
    }
    return filteredParts.slice(0, 3).join(', ');
  }

  return cleaned;
}

