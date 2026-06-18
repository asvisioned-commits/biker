/**
 * Geocoding and Reverse Geocoding utilities using OpenStreetMap Nominatim
 */

import { cleanAddress } from './geo';

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

// Cache to prevent duplicate requests for the exact same coordinate rounded to 5 decimals
const reverseCache = new Map<string, string>();

/**
 * Reverse geocodes coordinates to a human-readable address.
 * Uses Nominatim with a fallback to coordinates and Harare popular spots if it fails.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BikerOG-App/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.display_name) {
      // Clean up overly long Nominatim addresses
      const parts = data.display_name.split(',');
      // Take the first 3-4 parts for a concise display name (e.g. "Shop 21, Sam Levy's Village, Borrowdale")
      const conciseAddress = parts.slice(0, 4).map((p: string) => p.trim()).join(', ');
      const cleanedAddress = cleanAddress(conciseAddress);
      reverseCache.set(cacheKey, cleanedAddress);
      return cleanedAddress;
    }
  } catch (error) {
    console.warn('Reverse geocoding failed, using fallback:', error);
  }

  // Fallback: Coordinates format
  return `Location at ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

import { searchLocalPlaces } from './geocoding-dictionary';

/**
 * Forward geocodes an address query to coordinates using OpenStreetMap Nominatim.
 * Prioritizes local dictionary spots before calling OpenStreetMap.
 */
export async function searchAddress(query: string, country: 'ZW' | 'ZM' = 'ZW'): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];

  // 1. First lookup in our local fast dictionary
  const localMatches = searchLocalPlaces(query, country);
  const localResults: GeocodeResult[] = localMatches.map(place => ({
    address: cleanAddress(place.name),
    lat: place.lat,
    lng: place.lng
  }));

  // 2. Fetch from OpenStreetMap Nominatim for custom queries
  try {
    const countryCode = country.toLowerCase();
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${countryCode}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BikerOG-App/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim search failed: ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      const osmResults: GeocodeResult[] = data.map((item: any) => {
        const parts = item.display_name.split(',');
        const conciseAddress = parts.slice(0, 4).map((p: string) => p.trim()).join(', ');
        return {
          address: cleanAddress(conciseAddress),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
      });

      // Merge results, filtering out near-duplicates and prioritizing local dictionary
      const merged = [...localResults];
      for (const osm of osmResults) {
        const isDuplicate = merged.some(
          r => Math.abs(r.lat - osm.lat) < 0.0005 && Math.abs(r.lng - osm.lng) < 0.0005
        );
        if (!isDuplicate) {
          merged.push(osm);
        }
      }
      return merged.slice(0, 6);
    }
  } catch (error) {
    console.warn('Forward geocoding search failed:', error);
  }

  return localResults;
}
