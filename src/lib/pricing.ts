/**
 * Pricing Fee Estimator Engine
 * Calculates fare estimates based on geographical distance, vehicle/fulfillment tier, protection level, and optional bid scaling.
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export interface PricingEstimate {
  distanceKm: number;
  baseFare: number;
  serviceFee: number;
  protectionFee: number;
  suggestedFare: number;
  total: number;
}

export const PricingService = {
  /**
   * Calculate full pricing breakdown
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

    const distanceKm = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

    // 1. Base distance-based fare calculation
    // - standard: $2.50 base + $0.80 per km
    // - jet: $4.00 base + $1.20 per km
    // - scheduled_saver: $1.80 base + $0.50 per km
    let baseRate = 2.50;
    let perKmRate = 0.80;

    if (fulfillmentMode === 'jet') {
      baseRate = 4.00;
      perKmRate = 1.20;
    } else if (fulfillmentMode === 'scheduled_saver') {
      baseRate = 1.80;
      perKmRate = 0.50;
    }

    const rawBaseFare = baseRate + distanceKm * perKmRate;
    // Round to nearest 0.10 USD for clean Zimbabwe pricing convenience
    const baseFare = Math.max(baseRate, Math.round(rawBaseFare * 10) / 10);

    // 2. Standard Biker Service Fee: 8% of base fare, min $0.38
    const serviceFee = Math.max(0.38, Math.round(baseFare * 0.08 * 100) / 100);

    // 3. Biker Protect fee (insurance): standard flat $0.50, premium_secure flat $1.50 if enabled
    let protectionFee = 0.00;
    if (protectionLevel === 'protected') {
      protectionFee = 0.50;
    } else if (protectionLevel === 'premium_secure') {
      protectionFee = 1.50;
    }

    const suggestedFare = baseFare;
    const total = suggestedFare + serviceFee + protectionFee;

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      baseFare,
      serviceFee,
      protectionFee,
      suggestedFare,
      total,
    };
  }
};
