/**
 * Proximity Matchmaking & Broadcast Dispatch Engine
 */

import { createClient } from '@/lib/supabase/client';
import { updateOrderStatus } from '@/lib/database';

// ─── Haversine Distance Helper ──────────────────────────────────────
export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Core Matching & Dispatch ───────────────────────────────────────
export async function matchAndDispatchOrder(orderId: string) {
  const supabase = createClient();

  // 1. Fetch order details
  const { data: order, error: orderError } = await supabase
    .from('delivery_requests')
    .select('id, pickup_lat, pickup_lng, status')
    .eq('id', orderId)
    .single();

  if (orderError || !order || order.status !== 'payment_held') {
    console.error('Match Engine: Order not found or not in payment_held state.', orderError);
    return { success: false, error: 'Order not ready' };
  }

  const { pickup_lat, pickup_lng } = order;
  if (!pickup_lat || !pickup_lng) {
    return { success: false, error: 'Order is missing pickup coordinates' };
  }

  // 2. Fetch all online, available riders
  const { data: onlineRiders, error: ridersError } = await supabase
    .from('rider_profiles')
    .select('user_id, avg_rating, vehicle_type')
    .eq('is_available', true);

  if (ridersError || !onlineRiders || onlineRiders.length === 0) {
    return { success: false, matchedCount: 0, message: 'No online riders available' };
  }

  // 3. Fetch latest checkpoints for these riders
  const riderIds = onlineRiders.map((r) => r.user_id);
  const { data: checkpoints, error: checkpointsError } = await supabase
    .from('rider_location_checkpoints')
    .select('rider_id, lat, lng, created_at')
    .in('rider_id', riderIds)
    .order('created_at', { ascending: false });

  if (checkpointsError || !checkpoints) {
    return { success: false, error: 'Could not retrieve rider locations' };
  }

  // Get only the single latest checkpoint per rider
  const latestCheckpointsMap = new Map<string, { lat: number; lng: number }>();
  checkpoints.forEach((cp) => {
    if (!latestCheckpointsMap.has(cp.rider_id)) {
      latestCheckpointsMap.set(cp.rider_id, { lat: cp.lat, lng: cp.lng });
    }
  });

  // 4. Calculate distances and filter matching riders within starting radius (5km)
  // We expand this radius to 10km, 15km, 20km sequentially in active matcher tasks
  const matchedRiders: { riderId: string; distance: number }[] = [];
  onlineRiders.forEach((rider) => {
    const cp = latestCheckpointsMap.get(rider.user_id);
    if (cp) {
      const distance = getDistanceKm(pickup_lat, pickup_lng, cp.lat, cp.lng);
      matchedRiders.push({ riderId: rider.user_id, distance });
    }
  });

  // Sort riders by proximity
  matchedRiders.sort((a, b) => a.distance - b.distance);

  // 5. Create lease-based Order Offers for riders within range (e.g. up to 10km initially)
  const offersToCreate = matchedRiders
    .filter((mr) => mr.distance <= 10.0) // Start matching within 10km
    .map((mr) => ({
      order_id: orderId,
      rider_id: mr.riderId,
      status: 'pending',
      distance_km: mr.distance,
      expires_at: new Date(Date.now() + 30000).toISOString(), // 30-second accept lease
      created_at: new Date().toISOString(),
    }));

  if (offersToCreate.length === 0) {
    return { success: true, matchedCount: 0, message: 'No riders found within 10km' };
  }

  // Insert offers in database
  const { error: insertError } = await supabase.from('order_offers').insert(offersToCreate);
  if (insertError) {
    console.error('Match Engine: Failed to insert order offers:', insertError);
    return { success: false, error: 'Failed to create job offers' };
  }

  return {
    success: true,
    matchedCount: offersToCreate.length,
    message: `Dispatched order offers to ${offersToCreate.length} riders.`,
  };
}

// ─── Polling / Lease Expirator ──────────────────────────────────────
export async function cleanExpiredOffersAndExpandRadius(orderId: string, currentRadiusBand: number) {
  const supabase = createClient();

  // 1. Mark any expired pending offers for this order as timed_out
  await supabase
    .from('order_offers')
    .update({ status: 'timed_out' })
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  // 2. Check if the order has been accepted/assigned already
  const { data: order } = await supabase
    .from('delivery_requests')
    .select('assigned_rider_id, status, pickup_lat, pickup_lng')
    .eq('id', orderId)
    .single();

  if (!order || order.assigned_rider_id || order.status !== 'payment_held') {
    return { status: 'resolved' };
  }

  // 3. Expand radius band (e.g., from 10km to 20km)
  const nextRadius = currentRadiusBand + 5;
  if (nextRadius > 20) {
    return { status: 'no_riders_found' };
  }

  // Fetch online riders and check coordinates again for the wider band
  const { data: onlineRiders } = await supabase
    .from('rider_profiles')
    .select('user_id')
    .eq('is_available', true);

  if (!onlineRiders || onlineRiders.length === 0) return { status: 'no_online_riders' };

  const { data: checkpoints } = await supabase
    .from('rider_location_checkpoints')
    .select('rider_id, lat, lng')
    .in('rider_id', onlineRiders.map((r) => r.user_id))
    .order('created_at', { ascending: false });

  if (!checkpoints) return { status: 'no_locations' };

  const latestCheckpointsMap = new Map<string, { lat: number; lng: number }>();
  checkpoints.forEach((cp) => {
    if (!latestCheckpointsMap.has(cp.rider_id)) {
      latestCheckpointsMap.set(cp.rider_id, { lat: cp.lat, lng: cp.lng });
    }
  });

  const newlyMatched: any[] = [];
  onlineRiders.forEach((rider) => {
    const cp = latestCheckpointsMap.get(rider.user_id);
    if (cp && order.pickup_lat && order.pickup_lng) {
      const distance = getDistanceKm(order.pickup_lat, order.pickup_lng, cp.lat, cp.lng);
      // Ensure they are in the new expanded band (e.g., between previous and next radius)
      if (distance > currentRadiusBand && distance <= nextRadius) {
        newlyMatched.push({
          order_id: orderId,
          rider_id: rider.user_id,
          status: 'pending',
          distance_km: distance,
          expires_at: new Date(Date.now() + 30000).toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    }
  });

  if (newlyMatched.length > 0) {
    await supabase.from('order_offers').insert(newlyMatched);
  }

  return { status: 'expanded', newOffersCount: newlyMatched.length, nextRadius };
}
