/**
 * Geocoding and Reverse Geocoding utilities using OpenStreetMap Nominatim
 */

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
      reverseCache.set(cacheKey, conciseAddress);
      return conciseAddress;
    }
  } catch (error) {
    console.warn('Reverse geocoding failed, using fallback:', error);
  }

  // Fallback: Coordinates format
  return `Location at ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
