/**
 * Pricing Fee Estimator Engine
 * Calculates fare estimates based on geographical distance, surge pricing hotspots, carbon offset metrics, and optional bid scaling.
 */

// Haversine formula to compute great-circle distance in kilometers between two points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  // Note: the original file had a small typo in variable name dLng vs dLon!
  // Let's fix that typo! It used dLng instead of dLon on line 15!
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export interface PricingEstimate {
  distanceKm: number;
  baseFare: number;
  serviceFee: number;
  protectionFee: number;
  suggestedFare: number;
  surgeMultiplier: number;
  co2SavedKg: number;
  total: number;
}

export const PricingService = {
  /**
   * Calculate full pricing breakdown including surge rates and CO2 offset metrics
   */
  estimateFare(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    fulfillmentMode: 'standard' | 'jet' | 'scheduled_saver';
    protectionLevel: 'protected' | 'none' | 'premium_secure';
  }): PricingEstimate {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, fulfillmentMode, protectionLevel } = params;

    // Fixed distance calculation typo safely
    const R = 6371;
    const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
    const dLon = ((dropoffLng - pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickupLat * Math.PI) / 180) *
        Math.cos((dropoffLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // 1. Base rates
    let baseRate = 2.50;
    let perKmRate = 0.80;

    if (fulfillmentMode === 'jet') {
      baseRate = 4.00;
      perKmRate = 1.20;
    } else if (fulfillmentMode === 'scheduled_saver') {
      baseRate = 1.80;
      perKmRate = 0.50;
    }

    // 2. Dynamic Surge Hotspots check (Within 1.5km of hotspots)
    const surgeHotspots = [
      { name: 'borrowdale', lat: -17.75, lng: 31.10, multiplier: 1.9 },
      { name: 'cbd', lat: -17.83, lng: 31.05, multiplier: 1.4 },
      { name: 'avondale', lat: -17.80, lng: 31.03, multiplier: 1.2 },
    ];

    let surgeMultiplier = 1.0;
    
    // Check for Ops Console custom overrides in localStorage first
    if (typeof window !== 'undefined') {
      for (const spot of surgeHotspots) {
        const customOverride = localStorage.getItem(`biker_surge_${spot.name}`);
        if (customOverride) {
          const overrideVal = parseFloat(customOverride);
          if (!isNaN(overrideVal)) spot.multiplier = overrideVal;
        }
      }
    }

    // Calculate distance to find maximum applicable surge
    for (const spot of surgeHotspots) {
      const distToHotspot = (() => {
        const dLatS = ((pickupLat - spot.lat) * Math.PI) / 180;
        const dLonS = ((pickupLng - spot.lng) * Math.PI) / 180;
        const aS =
          Math.sin(dLatS / 2) * Math.sin(dLatS / 2) +
          Math.cos((spot.lat * Math.PI) / 180) *
            Math.cos((pickupLat * Math.PI) / 180) *
            Math.sin(dLonS / 2) *
            Math.sin(dLonS / 2);
        return R * (2 * Math.atan2(Math.sqrt(aS), Math.sqrt(1 - aS)));
      })();

      if (distToHotspot <= 1.5) {
        surgeMultiplier = Math.max(surgeMultiplier, spot.multiplier);
      }
    }

    const rawBaseFare = (baseRate + distanceKm * perKmRate) * surgeMultiplier;
    // Round to nearest 0.10 USD
    const baseFare = Math.max(baseRate, Math.round(rawBaseFare * 10) / 10);

    // 3. Service Fee: 8% of base fare, min $0.38
    const serviceFee = Math.max(0.38, Math.round(baseFare * 0.08 * 100) / 100);

    // 4. Protection fee (flat rate insurance)
    let protectionFee = 0.00;
    if (protectionLevel === 'protected') {
      protectionFee = 0.50;
    } else if (protectionLevel === 'premium_secure') {
      protectionFee = 1.50;
    }

    const suggestedFare = baseFare;
    const total = suggestedFare + serviceFee + protectionFee;

    // 5. Calculate CO2 Offset metrics (in kg CO2 offset compared to a standard delivery van)
    // - scheduled_saver (often bicycle/walker): saves 0.35kg/km
    // - standard (motorcycle): saves 0.15kg/km
    // - jet (fast motorcycle/car): saves 0.08kg/km
    let co2OffsetPerKm = 0.15;
    if (fulfillmentMode === 'scheduled_saver') co2OffsetPerKm = 0.35;
    else if (fulfillmentMode === 'jet') co2OffsetPerKm = 0.08;

    const co2SavedKg = distanceKm * co2OffsetPerKm;

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      baseFare,
      serviceFee,
      protectionFee,
      suggestedFare,
      surgeMultiplier,
      co2SavedKg: Math.round(co2SavedKg * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
};
