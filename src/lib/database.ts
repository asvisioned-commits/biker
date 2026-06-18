/**
 * Supabase database query utilities
 * Clean data access layer for all CRUD operations
 */

import { createClient } from '@/lib/supabase/client';
import type { ServiceType, FulfillmentMode, ProtectionLevel, UserRole, VehicleType } from '@/types';

const supabase = createClient();

// ─── Profiles ──────────────────────────────────────────────────────

export async function getProfile(userId: string) { 
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { data, error };
}

export async function updateProfile(
  userId: string, 
  updates: { 
    full_name?: string; 
    avatar_url?: string; 
    phone?: string; 
    email?: string;
    national_id_number?: string | null;
    active_role?: string;
    national_id_verified?: boolean;
  }
) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  return { data, error };
}

export async function getUserRoles(userId: string) {
  const { data, error } = await supabase.from('user_roles').select('role, is_active, verified_at, created_at').eq('user_id', userId);
  return { data, error };
}

export async function setActiveRole(userId: string, role: UserRole) {
  const { error } = await supabase.from('profiles').update({ active_role: role }).eq('id', userId);
  return { error };
}

// ─── Delivery Requests (Orders) ──────────────────────────────────────

export async function createOrder(order: {
  customer_id: string;
  service_type: ServiceType;
  fulfillment_mode?: FulfillmentMode;
  protection_level?: ProtectionLevel;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  dropoff_address: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_contact_name?: string;
  dropoff_contact_phone?: string;
  dropoff_gate_color?: string;
  item_description?: string;
  item_category?: string;
  special_instructions?: string;
  shopping_list?: Record<string, unknown>[];
  estimated_item_cost?: number;
  estimated_distance_km?: number;
  estimated_duration_minutes?: number;
  payment_method?: string;
  cod_amount_expected?: number;
  status?: string;
  service_fee?: number;
  protection_fee?: number;
  total_amount?: number;
  delivery_fee?: number;
}) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const reference = 'BKR-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  // Generate a random 4-digit PIN
  const plaintextPin = Math.floor(1000 + Math.random() * 9000).toString();
  
  // Calculate SHA-256 hash using the Web Crypto API
  let pinHash = '';
  try {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
    if (cryptoObj && cryptoObj.subtle) {
      // In JS environments, crypto.subtle.digest is standard and asynchronous.
      // Wait, we need to run it synchronously or await it? We can await it since createOrder is async!
      // But wait! Is next encoder/decoder available? Yes, standard.
      // We will perform the hash inline.
    }
  } catch (err) {
    console.error('Crypto hashing failed:', err);
  }

  // To be safe and fast, let's write a simple helper or use standard crypto:
  // Since we are running in an async function, we can await:
  // const msgBuffer = new TextEncoder().encode(plaintextPin);
  // const hashBuffer = await cryptoObj.subtle.digest('SHA-256', msgBuffer);
  // ...
  // Let's implement this!
  
  const { data, error } = await (async () => {
    let computedHash = '';
    try {
      const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
      if (cryptoObj && cryptoObj.subtle) {
        const msgBuffer = new TextEncoder().encode(plaintextPin);
        const hashBuffer = await cryptoObj.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        throw new Error('Web Crypto API unavailable — cannot hash delivery PIN securely.');
      }
    } catch (e) {
      throw new Error('Web Crypto API unavailable — cannot hash delivery PIN securely.');
    }

    return supabase.from('delivery_requests').insert({ 
      status: 'draft',
      ...order, 
      delivery_pin_hash: computedHash,
      reference_code: reference 
    }).select().single();
  })();
  
  if (!error && data) {
    // Attach the plaintext PIN for the customer's initial view
    (data as any).plaintext_pin = plaintextPin;
    try {
      await createNotification({
        recipient_id: data.customer_id,
        type: 'order',
        title: 'Order Placed 📦',
        body: `Your delivery request ${data.reference_code} has been successfully submitted!`,
        data: { order_id: data.id, reference_code: data.reference_code }
      });
    } catch (err) {
      console.error('Failed to create order notification', err);
    }
  }
  
  return { data, error };
}

export async function updateOrderPurchaseDetails(orderId: string, purchaseAmount: number, shoppingList?: any[]) {
  const { data, error } = await supabase
    .from('delivery_requests')
    .update({ 
      purchase_amount: purchaseAmount,
      shopping_list: shoppingList,
    })
    .eq('id', orderId)
    .select()
    .single();
  return { data, error };
}

export async function getOrders(userId: string, role: UserRole, filters?: { status?: string; limit?: number; offset?: number; }) {
  let query = supabase.from('delivery_requests').select(`*, rider:profiles!delivery_requests_assigned_rider_id_fkey(full_name, avatar_url), customer:profiles!delivery_requests_customer_id_fkey(full_name, avatar_url)`).order('created_at', { ascending: false });
  if (role === 'customer') query = query.eq('customer_id', userId);
  else if (role === 'rider') query = query.eq('assigned_rider_id', userId);
  if (filters?.status) {
    if (filters.status === 'active') query = query.not('status', 'in', '("completed","cancelled","disputed")');
    else if (filters.status === 'completed') query = query.eq('status', 'completed');
    else if (filters.status === 'disputed') query = query.eq('status', 'disputed');
    else query = query.eq('status', filters.status);
  }
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  const { data, error } = await query;
  return { data, error };
}

export async function getOrderById(orderId: string) {
  const { data, error } = await supabase.from('delivery_requests').select(`*, rider:profiles!delivery_requests_assigned_rider_id_fkey(id, full_name, avatar_url, phone, trust_tier), customer:profiles!delivery_requests_customer_id_fkey(id, full_name, avatar_url, phone), proofs:delivery_proofs(proof_type, file_url, notes, created_at), status_log:delivery_status_log(from_status, to_status, changed_by, notes, created_at)`).eq('id', orderId).single();
  return { data, error };
}

export async function updateOrderStatus(orderId: string, status: string, notes?: string) {
  const { data, error } = await supabase.from('delivery_requests').update({ status }).eq('id', orderId).select().single();
  if (!error && data) {
    await supabase.from('delivery_status_log').insert({ request_id: orderId, to_status: status, notes });
    try {
      await createStatusNotifications(data);
    } catch (err) {
      console.error('Failed to create status notification', err);
    }
  }
  return { data, error };
}

export async function completeCodDelivery(params: {
  orderId: string;
  riderId: string;
  pin: string;
  cashCollected: number;
  hasDiscrepancy: boolean;
}) {
  const { data, error } = await supabase.rpc('complete_cod_delivery', {
    p_order_id: params.orderId,
    p_rider_id: params.riderId,
    p_pin: params.pin,
    p_cash_collected: params.cashCollected,
    p_has_discrepancy: params.hasDiscrepancy,
  });
  
  if (!error && data && data.success) {
    try {
      const { data: order } = await supabase.from('delivery_requests').select('*').eq('id', params.orderId).single();
      if (order) {
        await createStatusNotifications(order);
      }
    } catch (err) {
      console.error('Failed to create COD status notifications:', err);
    }
  }
  
  return { data, error };
}

export async function verifyDeliveryPin(orderId: string, pin: string) {
  const { data, error } = await supabase.rpc('verify_delivery_pin', {
    p_order_id: orderId,
    p_pin_code: pin
  });

  if (!error && data && data.success) {
    try {
      const { data: order } = await supabase.from('delivery_requests').select('*').eq('id', orderId).single();
      if (order) {
        await createStatusNotifications(order);
      }
    } catch (err) {
      console.error('Failed to create status notifications for verify_delivery_pin:', err);
    }
  }

  return { 
    success: data?.success ?? false, 
    message: data?.message || 'Verification failed', 
    error 
  };
}

// ─── Addresses ─────────────────────────────────────────────────────

export async function getSavedAddresses(userId: string) {
  const { data, error } = await supabase.from('saved_addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false });
  return { data, error };
}

export async function createAddress(address: {
  user_id: string; label: string; address_line: string; area_suburb?: string; city?: string;
  lat?: number; lng?: number; landmark?: string; gate_color?: string;
  contact_name?: string; contact_phone?: string; is_default?: boolean;
}) {
  const { data, error } = await supabase.from('saved_addresses').insert(address).select().single();
  return { data, error };
}

export async function deleteAddress(addressId: string) {
  const { error } = await supabase.from('saved_addresses').delete().eq('id', addressId);
  return { error };
}

export async function setDefaultAddress(userId: string, addressId: string) {
  await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', userId);
  const { error } = await supabase.from('saved_addresses').update({ is_default: true }).eq('id', addressId);
  return { error };
}

// ─── Disputes ──────────────────────────────────────────────────────

export async function createDispute(dispute: { request_id: string; initiated_by: string; dispute_type: string; description: string; against_user_id?: string; }) {
  const { data, error } = await supabase.from('disputes').insert({ ...dispute, status: 'open' }).select().single();
  return { data, error };
}

export async function getDisputes(userId: string) {
  const { data, error } = await supabase.from('disputes').select(`*, request:delivery_requests(reference_code, service_type), initiator:profiles!disputes_initiated_by_fkey(full_name), against:profiles!disputes_against_user_id_fkey(full_name)`).or(`initiated_by.eq.${userId},against_user_id.eq.${userId}`).order('created_at', { ascending: false });
  return { data, error };
}

export async function getDisputeById(disputeId: string) {
  const { data, error } = await supabase
    .from('disputes')
    .select(`*, request:delivery_requests(*), initiator:profiles!disputes_initiated_by_fkey(full_name, email), against:profiles!disputes_against_user_id_fkey(full_name, email)`)
    .eq('id', disputeId)
    .single();
  return { data, error };
}

export async function getAllDisputes() {
  const { data, error } = await supabase
    .from('disputes')
    .select(`*, request:delivery_requests(reference_code, service_type, status), initiator:profiles!disputes_initiated_by_fkey(full_name), against:profiles!disputes_against_user_id_fkey(full_name)`)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function addDisputeEvidence(disputeId: string, fileUrl: string) {
  const { data: dispute } = await supabase.from('disputes').select('evidence').eq('id', disputeId).single();
  const currentEvidence = dispute?.evidence || [];
  const updatedEvidence = [...currentEvidence, fileUrl];
  
  const { data, error } = await supabase
    .from('disputes')
    .update({ evidence: updatedEvidence })
    .eq('id', disputeId)
    .select()
    .single();
  return { data, error };
}

export async function withdrawDisputeInDb(disputeId: string) {
  const { data: dispute } = await supabase.from('disputes').select('request_id, original_status').eq('id', disputeId).single();
  if (!dispute) return { error: new Error('Dispute not found') };
  
  const originalStatus = dispute.original_status || 'completed';
  
  await supabase.from('delivery_requests').update({ status: originalStatus }).eq('id', dispute.request_id);
  
  const { data, error } = await supabase
    .from('disputes')
    .update({ status: 'closed', resolution_notes: 'Dispute withdrawn by claimant.' })
    .eq('id', disputeId)
    .select()
    .single();
    
  return { data, error };
}

export async function resolveDisputeInDb(disputeId: string, action: 'approve' | 'deny', resolvedBy: string, notes: string) {
  const { data, error } = await supabase.rpc('resolve_dispute_transactional', {
    p_dispute_id: disputeId,
    p_action: action,
    p_notes: notes
  });
  return { data, error };
}

// ─── Safety Alerts ──────────────────────────────────────────────────

export async function createSafetyAlert(alert: {
  order_id: string;
  user_id: string;
  type: 'sos_alert' | 'missed_checkin';
  gps_lat?: number;
  gps_lng?: number;
}) {
  if (alert.type === 'sos_alert' && alert.gps_lat && alert.gps_lng) {
    try {
      await supabase.from('rider_location_checkpoints').insert({
        rider_id: alert.user_id,
        order_id: alert.order_id,
        event_type: 'sos_triggered',
        lat: alert.gps_lat,
        lng: alert.gps_lng
      });
    } catch (e) {
      console.error('Failed to log location checkpoint for SOS:', e);
    }
  }

  const { data, error } = await supabase
    .from('safety_alerts')
    .insert({ ...alert, status: 'active' })
    .select()
    .single();
  return { data, error };
}

export async function getSafetyAlerts() {
  const { data, error } = await supabase
    .from('safety_alerts')
    .select(`*, order:delivery_requests(reference_code, status), user:profiles(full_name, phone)`)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function resolveSafetyAlert(alertId: string, resolvedBy: string, opsNotes: string) {
  const { data, error } = await supabase
    .from('safety_alerts')
    .update({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      ops_notes: opsNotes
    })
    .eq('id', alertId)
    .select()
    .single();
  return { data, error };
}

// ─── Fraud Prevention ───────────────────────────────────────────────

export async function logDeviceFingerprint(userId: string | null, fingerprint: string, ipAddress?: string, userAgent?: string) {
  const { data, error } = await supabase
    .from('device_fingerprints')
    .insert({ user_id: userId, fingerprint, ip_address: ipAddress, user_agent: userAgent })
    .select()
    .single();
  return { data, error };
}

export async function checkOrderVelocity(userId: string | null, fingerprint: string): Promise<{ allowed: boolean; details?: string }> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  let recentCount = 0;
  
  try {
    if (userId) {
      const { count } = await supabase
        .from('delivery_requests')
        .select('id', { count: 'exact' })
        .eq('customer_id', userId)
        .gte('created_at', tenMinutesAgo);
      recentCount = count || 0;
    } else if (fingerprint) {
      const { count } = await supabase
        .from('fraud_prevention_logs')
        .select('id', { count: 'exact' })
        .eq('fingerprint', fingerprint)
        .eq('action_type', 'order_creation')
        .eq('status', 'allowed')
        .gte('created_at', tenMinutesAgo);
      recentCount = count || 0;
    }
  } catch (e) {
    console.error('Error checking velocity counts:', e);
  }
  
  const allowed = recentCount < 3;
  
  try {
    await supabase.from('fraud_prevention_logs').insert({
      user_id: userId,
      fingerprint,
      action_type: 'order_creation',
      status: allowed ? 'allowed' : 'blocked',
      details: allowed ? `Placed ${recentCount} orders in 10 mins.` : `Velocity limit breached: attempted 4th order in 10 mins.`
    });
  } catch (e) {
    console.error('Failed to log fraud prevention log:', e);
  }
  
  return {
    allowed,
    details: allowed ? undefined : 'Dispatch limit exceeded. You can only place up to 3 orders every 10 minutes.'
  };
}

// ─── Rider ─────────────────────────────────────────────────────────

export async function getRiderProfile(userId: string) { 
  const { data, error } = await supabase.from('rider_profiles').select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function updateRiderProfile(
  userId: string, 
  updates: { 
    vehicle_type?: VehicleType; 
    vehicle_registration?: string; 
    license_number?: string; 
    operating_zone?: string; 
    is_available?: boolean;
    national_id_card_url?: string | null;
    vehicle_registration_url?: string | null;
    license_card_url?: string | null;
    selfie_url?: string | null;
    kyc_status?: 'unverified' | 'pending_face_scan' | 'pending_ops_approval' | 'approved' | 'rejected';
    kyc_rejection_reason?: string | null;
    vehicle_verified?: boolean;
    license_verified?: boolean;
    selfie_verified?: boolean;
  }
) {
  const { data, error } = await supabase.from('rider_profiles').update(updates).eq('user_id', userId).select().single();
  return { data, error };
}

export async function getRiderEarnings(riderId: string, period: 'today' | 'week' | 'month') {
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
  }
  const { data, error } = await supabase.from('journal_entries').select('amount, entry_type, description, created_at').eq('account_id', riderId).gte('created_at', startDate.toISOString()).order('created_at', { ascending: false });
  return { data, error };
}

// ─── Merchant ─────────────────────────────────────────────────────

export async function getMerchantProfile(userId: string) {
  const { data, error } = await supabase.from('merchant_profiles').select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function getMerchantOrders(merchantId: string, limit = 20) {
  const { data, error } = await supabase.from('delivery_requests').select(`*, rider:profiles!delivery_requests_assigned_rider_id_fkey(full_name, avatar_url), customer:profiles!delivery_requests_customer_id_fkey(full_name)`).eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(limit);
  return { data, error };
}

// ─── Delivery Proofs ──────────────────────────────────────────────

export async function uploadProof(proof: { request_id: string; uploaded_by: string; proof_type: 'pickup_photo' | 'delivery_photo' | 'receipt_photo' | 'signature' | 'condition_note'; file_url: string; notes?: string; }) { 
  const { data, error } = await supabase.from('delivery_proofs').insert(proof).select().single();
  return { data, error };
}

// ─── Trust / Ratings ───────────────────────────────────────────────

export async function submitRating(rating: { request_id: string; from_user_id: string; to_user_id: string; rating: number; comment?: string; }) {
  const { data, error } = await supabase.from('ratings').insert(rating).select().single();
  return { data, error };
}

// ─── Rider Profile ────────────────────────────────────────────────

export async function createRiderProfile(profile: {
  user_id: string;
  vehicle_type?: 'bicycle' | 'motorcycle' | 'car' | 'van';
  vehicle_registration?: string;
  license_number?: string;
  operating_zone?: string;
  national_id_card_url?: string | null;
  vehicle_registration_url?: string | null;
  license_card_url?: string | null;
  selfie_url?: string | null;
  kyc_status?: string;
  kyc_rejection_reason?: string | null;
}) {
  const { data, error } = await supabase.from('rider_profiles').insert(profile).select().single();
  if (!error) { await supabase.from('user_roles').upsert({ user_id: profile.user_id, role: 'rider', is_active: true }, { onConflict: 'user_id,role' }); }
  return { data, error };
}

export async function toggleRiderOnline(userId: string, isAvailable: boolean) {
  const { data, error } = await supabase.from('rider_profiles').update({ is_available: isAvailable }).eq('user_id', userId).select().single();
  return { data, error };
}

export async function completeSafetyQuiz(riderId: string) {
  const { data, error } = await supabase.from('rider_profiles').update({ safety_quiz_completed: true }).eq('user_id', riderId).select().single();
  return { data, error };
}

export async function createCounterOffer(orderId: string, riderId: string, amount: number) {
  const { data, error } = await supabase.from('order_offers').insert({
    order_id: orderId,
    rider_id: riderId,
    status: 'counter_offered',
    counter_offer_amount: amount,
    estimated_rider_payout: amount,
    expires_at: new Date(Date.now() + 120 * 1000).toISOString() // 2 minutes expiry
  }).select().single();

  return { data, error };
}

export async function respondToCounterOffer(offerId: string, action: 'accept' | 'decline') {
  if (action === 'decline') {
    const { data, error } = await supabase
      .from('order_offers')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', offerId)
      .select()
      .single();
    return { data, error };
  }

  // Accept flow
  const { data: offer, error: offerError } = await supabase
    .from('order_offers')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', offerId)
    .select('*')
    .single();

  if (offerError || !offer) return { data: null, error: offerError };

  const { data: order, error: orderError } = await supabase
    .from('delivery_requests')
    .select('*')
    .eq('id', offer.order_id)
    .single();

  if (orderError || !order) return { data: null, error: orderError };

  const counterAmount = Number(offer.counter_offer_amount || offer.estimated_rider_payout || 0);
  const serviceFee = Number(order.service_fee || 0);
  const protectionFee = Number(order.protection_fee || 0);
  const purchaseAmount = Number(order.purchase_amount || 0);
  const newTotal = counterAmount + serviceFee + protectionFee + purchaseAmount;

  const { data: updatedOrder, error: updateError } = await supabase
    .from('delivery_requests')
    .update({
      assigned_rider_id: offer.rider_id,
      status: 'rider_assigned',
      rider_payout: counterAmount,
      delivery_fee: counterAmount,
      total_amount: newTotal,
      accepted_at: new Date().toISOString()
    })
    .eq('id', offer.order_id)
    .select()
    .single();

  if (updateError) return { data: null, error: updateError };

  await supabase
    .from('order_offers')
    .update({ status: 'cancelled' })
    .eq('order_id', offer.order_id)
    .neq('id', offerId)
    .in('status', ['pending', 'counter_offered']);

  try {
    await createStatusNotifications(updatedOrder);
  } catch (err) {
    console.error('Failed to create status notifications for counter offer accept:', err);
  }

  return { data: updatedOrder, error: null };
}


// ─── Merchant Profile ─────────────────────────────────────────────

export async function createMerchantProfile(profile: { user_id: string; business_name: string; business_type?: 'boutique' | 'pharmacy' | 'grocery' | 'restaurant' | 'electronics' | 'general'; whatsapp_number?: string; instagram_handle?: string; }) {
  const { data, error } = await supabase.from('merchant_profiles').insert(profile).select().single();
  return { data, error };
}

// ─── Notifications ────────────────────────────────────────────────

export async function getNotifications(userId: string, limit = 20) {
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(limit);
  return { data, error };
}

export async function createNotification(notification: { 
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: string;
}) {
  const { data, error } = await supabase.from('notifications').insert({
    ...notification,
    read: false,
    created_at: new Date().toISOString()
  }).select().single();
  return { data, error };
}

export async function createStatusNotifications(order: any) {
  const customerId = order.customer_id;
  const riderId = order.assigned_rider_id;
  const ref = order.reference_code;
  const status = order.status;

  if (customerId) {
    let title = '';
    let body = '';
    let type = 'order';

    // Fetch rider name if riderId is present
    let riderName = 'Your rider';
    if (riderId) {
      const { data: riderProfile } = await supabase.from('profiles').select('full_name').eq('id', riderId).single();
      if (riderProfile?.full_name) {
        riderName = riderProfile.full_name;
      }
    }

    if (status === 'rider_assigned') {
      title = 'Rider Assigned';
      body = `${riderName} accepted your delivery ${ref}`;
    } else if (status === 'rider_en_route_pickup') {
      title = 'Rider En Route';
      body = `${riderName} is heading to pickup location for ${ref}`;
    } else if (status === 'at_pickup') {
      title = 'Rider at Pickup';
      body = `${riderName} has arrived at the pickup location for ${ref}`;
    } else if (status === 'proof_uploaded') {
      title = 'Pickup Confirmed';
      body = `Pickup confirmed for ${ref}. Photo proof uploaded.`;
    } else if (status === 'en_route_delivery') {
      title = 'En Route to Delivery';
      body = `${riderName} is delivering your package for ${ref}`;
    } else if (status === 'at_delivery') {
      title = 'Rider at Delivery';
      body = `${riderName} has arrived at the delivery destination. Please provide your PIN to complete ${ref}`;
    } else if (status === 'completed') {
      title = 'Delivery Completed 📦';
      body = `Your order ${ref} has been successfully completed!`;
    } else if (status === 'disputed') {
      title = 'Order Disputed';
      body = `Your order ${ref} has been flagged with a dispute.`;
      type = 'dispute';
    } else if (status === 'cancelled') {
      title = 'Order Cancelled';
      body = `Your order ${ref} has been cancelled.`;
    }

    if (title && body) {
      await createNotification({
        recipient_id: customerId,
        type,
        title,
        body,
        data: { order_id: order.id, reference_code: ref }
      });
    }
  }

  // Send payout notification to rider when order is completed
  if (riderId && status === 'completed') {
    await createNotification({
      recipient_id: riderId,
      type: 'payout',
      title: 'Payment Received 💰',
      body: `Payment for delivery ${ref} has been released to your wallet.`,
      data: { order_id: order.id, reference_code: ref }
    });
  }
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
  return { error };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).eq('recipient_id', userId).eq('read', false);
  return { error };
}

// ─── Order Offers ─────────────────────────────────────────────────

export async function acceptOrderOffer(offerId: string, riderId: string) {
  const { data: offer, error: offerError } = await supabase.from('order_offers').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', offerId).eq('rider_id', riderId).select('order_id').single();
  if (offerError || !offer) return { data: null, error: offerError };
  const { data, error } = await supabase.from('delivery_requests').update({ assigned_rider_id: riderId, status: 'rider_assigned' }).eq('id', offer.order_id).select().single();
  if (!error) { await supabase.from('order_offers').update({ status: 'cancelled' }).eq('order_id', offer.order_id).neq('id', offerId).eq('status', 'pending'); }
  return { data, error };
}

export async function declineOrderOffer(offerId: string, riderId: string, reason?: 'too_far' | 'fee_too_low' | 'busy' | 'vehicle_mismatch' | 'zone_mismatch' | 'personal') {
  const { data, error } = await supabase.from('order_offers').update({ status: 'declined', responded_at: new Date().toISOString(), decline_reason: reason || 'personal' }).eq('id', offerId).eq('rider_id', riderId).select().single();
  return { data, error };
}

// ─── Quotes ───────────────────────────────────────────────────────

export async function createQuote(quote: {
  customer_id: string; order_id?: string; service_type: ServiceType; fulfillment_mode?: FulfillmentMode;
  protection_level?: ProtectionLevel; distance_km: number; estimated_duration_minutes: number;
  pickup_zone?: string; dropoff_zone?: string; delivery_fee: number; service_fee: number;
  protection_fee: number; purchase_budget?: number; total_amount: number;
}) {
  const { data, error } = await supabase.from('quotes').insert({ ...quote, status: 'presented', pricing_version: 'v1' }).select().single();
  return { data, error };
}

export async function acceptQuote(quoteId: string) {
  const { data, error } = await supabase.from('quotes').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', quoteId).select().single();
  return { data, error };
}

// ─── Delivery Links ───────────────────────────────────────────────

export async function createDeliveryLink(link: {
  merchant_id: string; slug: string; customer_name?: string; customer_phone?: string;
  items?: Record<string, unknown>[]; pickup_address: string; pickup_lat?: number; pickup_lng?: number;
  delivery_fee_preset?: number; protection_level?: ProtectionLevel; fulfillment_mode?: FulfillmentMode;
}) {
  const { data, error } = await supabase.from('delivery_links').insert({ ...link, status: 'active' }).select().single();
  return { data, error };
}

export async function cancelDeliveryLink(linkId: string) {
  const { error } = await supabase.from('delivery_links').update({ status: 'cancelled' }).eq('id', linkId);
  return { error };
}

// ─── Rider Matching ───────────────────────────────────────────────────

/**
 * Create pending offers for online riders near an order's pickup location.
 * In a production app this should be an Edge Function or server action
 * so the matching algorithm runs server-side.
 */
export async function requestRiderMatch(orderId: string, options?: {
  maxRiders?: number;
  radiusKm?: number;
}) {
  const maxRiders = options?.maxRiders ?? 10;

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from('delivery_requests')
    .select('id, pickup_lat, pickup_lng, rider_payout')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return { data: null, error: orderError };

  // Find online riders
  const { data: riders, error: ridersError } = await supabase
    .from('rider_profiles')
    .select('user_id, lat, lng')
    .eq('is_available', true)
    .order('active_since', { ascending: false })
    .limit(maxRiders);

  if (ridersError || !riders || riders.length === 0) {
    return { data: null, error: ridersError || new Error('No online riders') };
  }

  // Create offers
  const offers = riders.map((rider) => ({
    order_id: orderId,
    rider_id: rider.user_id,
    status: 'pending' as const,
    timeout_seconds: 30,
    expires_at: new Date(Date.now() + 30 * 1000).toISOString(),
    estimated_rider_payout: order.rider_payout || 0,
  }));

  const { data, error } = await supabase
    .from('order_offers')
    .insert(offers)
    .select();

  return { data, error };
}

// ─── Rider Location ───────────────────────────────────────────────

export async function insertLocationCheckpoint(checkpoint: {
  rider_id: string; order_id?: string; event_type: string;
  lat: number; lng: number; heading?: number; speed_kmh?: number; accuracy_meters?: number;
}) {
  const { data, error } = await supabase.from('rider_location_checkpoints').insert(checkpoint).select().single();
  return { data, error };
}

// ─── Dashboard Stats Aggregations ────────────────────────────────────

export async function getRiderDashboardStats(riderId: string) {
  const now = new Date();
  
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startTodayStr = startToday.toISOString();

  const startWeek = new Date(now);
  startWeek.setDate(now.getDate() - 7);
  startWeek.setHours(0, 0, 0, 0);
  const startWeekStr = startWeek.toISOString();

  const startMonth = new Date(now);
  startMonth.setDate(now.getDate() - 30);
  startMonth.setHours(0, 0, 0, 0);
  const startMonthStr = startMonth.toISOString();

  const [profileRes, userProfileRes, todayEarningsRes, weekEarningsRes, monthEarningsRes, completedRes, subscriptionRes] = await Promise.all([
    supabase.from('rider_profiles').select('*').eq('user_id', riderId).single(),
    supabase.from('profiles').select('trust_score').eq('id', riderId).single(),
    supabase.from('rider_earnings_log').select('amount').eq('rider_id', riderId).eq('type', 'delivery').gte('created_at', startTodayStr),
    supabase.from('rider_earnings_log').select('amount').eq('rider_id', riderId).eq('type', 'delivery').gte('created_at', startWeekStr),
    supabase.from('rider_earnings_log').select('amount').eq('rider_id', riderId).eq('type', 'delivery').gte('created_at', startMonthStr),
    supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('assigned_rider_id', riderId).eq('status', 'completed').gte('completed_at', startTodayStr),
    supabase.from('rider_subscriptions').select('*').eq('rider_id', riderId).single()
  ]);

  const profile = profileRes.data;
  const completedCount = completedRes.count || 0;
  const subscription = subscriptionRes.data;
  const trustScore = userProfileRes.data?.trust_score ?? 50;

  const todayEarnings = (todayEarningsRes.data || []).reduce((sum, log) => sum + Number(log.amount), 0);
  const weekEarnings = (weekEarningsRes.data || []).reduce((sum, log) => sum + Number(log.amount), 0);
  const monthEarnings = (monthEarningsRes.data || []).reduce((sum, log) => sum + Number(log.amount), 0);

  return { 
    isOnline: profile?.is_available ?? false,
    safetyQuizCompleted: profile?.safety_quiz_completed ?? false,
    todayEarnings,
    weekEarnings,
    monthEarnings,
    completedToday: completedCount,
    rating: profile?.avg_rating ? Number(profile.avg_rating) : 0.0,
    trustScore,
    tier: profile?.tier ?? 'starter',
    kycStatus: profile?.kyc_status ?? 'unverified',
    rejectionReason: profile?.kyc_rejection_reason ?? null,
    subscription: subscription ? {
      status: subscription.status,
      earningCap: Number(subscription.earning_cap),
      currentEarnings: Number(subscription.current_earnings),
      emergencyCreditUsed: Number(subscription.emergency_credit_used),
      expiresAt: subscription.subscription_expires_at
    } : null
  };
}

export async function getMerchantDashboardStats(merchantId: string) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTodayStr = startToday.toISOString();

  const [profileRes, activeOrdersRes, todayOrdersRes, activeLinksRes] = await Promise.all([
    supabase.from('merchant_profiles').select('*').eq('user_id', merchantId).single(),
    supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('merchant_id', merchantId).not('status', 'in', '("completed","cancelled","disputed")'),
    supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('merchant_id', merchantId).gte('created_at', startTodayStr),
    supabase.from('delivery_links').select('id', { count: 'exact' }).eq('merchant_id', merchantId).eq('status', 'active')
  ]);

  const profile = profileRes.data;

  return {
    businessName: profile?.business_name ?? '',
    rating: profile?.avg_delivery_rating ? Number(profile.avg_delivery_rating) : 0.0,
    totalDeliveries: profile?.total_deliveries ?? 0,
    activeOrdersCount: activeOrdersRes.count || 0,
    todayOrdersCount: todayOrdersRes.count || 0,
    activeLinksCount: activeLinksRes.count || 0,
  };
}

export async function getOpsDashboardStats() {
  const [activeOrdersRes, onlineRidersRes, openDisputesRes, pendingProofsRes] = await Promise.all([
    supabase.from('delivery_requests').select('id', { count: 'exact' }).not('status', 'in', '("completed","cancelled","disputed")'),
    supabase.from('rider_profiles').select('id', { count: 'exact' }).eq('is_available', true),
    supabase.from('disputes').select('id', { count: 'exact' }).eq('status', 'open'),
    supabase.from('rider_payment_proofs').select('id', { count: 'exact' }).eq('status', 'pending')
  ]);

  return {
    activeOrdersCount: activeOrdersRes.count || 0,
    onlineRidersCount: onlineRidersRes.count || 0,
    openDisputesCount: openDisputesRes.count || 0,
    pendingVerificationsCount: pendingProofsRes.count || 0
  };
}

export async function getCODReconciliationReport(dateStr?: string) {


  try {
    // Query live COD orders
    const { data: orders, error: ordersError } = await supabase
      .from('delivery_requests')
      .select('id, reference_code, cod_amount_expected, cod_amount_collected, cod_discrepancy_flag, cod_collection_confirmed_at, rider:profiles!delivery_requests_assigned_rider_id_fkey(full_name)')
      .eq('payment_method', 'cash')
      .eq('status', 'completed');
      
    if (ordersError) throw ordersError;

    // Query active outstanding balances per rider from ledger
    const { data: ledger, error: ledgerError } = await supabase
      .from('rider_cash_ledger')
      .select('rider_id, amount, type, status, rider:profiles!rider_cash_ledger_rider_id_fkey(full_name)');
      
    if (ledgerError) throw ledgerError;

    // Calculate aggregations
    let totalCODOrders = orders?.length || 0;
    let totalCashExpected = 0;
    let totalCashCollected = 0;
    const discrepancies: any[] = [];

    orders?.forEach(o => {
      const expected = Number(o.cod_amount_expected || 0);
      const collected = Number(o.cod_amount_collected || 0);
      totalCashExpected += expected;
      totalCashCollected += collected;

      if (o.cod_discrepancy_flag || Math.abs(expected - collected) > 0.01) {
        discrepancies.push({ 
          orderId: o.id,
          reference: o.reference_code,
          riderName: (o.rider as any)?.full_name || 'Unknown Rider',
          expected,
          collected,
          difference: Math.abs(expected - collected),
          flaggedAt: o.cod_collection_confirmed_at
        });
      }
    });

    // Calculate rider ledger outstanding balances
    const riderBalancesMap = new Map<string, { riderName: string; balance: number; }>();
    ledger?.forEach(item => {
      const riderId = item.rider_id;
      const riderName = (item.rider as any)?.full_name || 'Rider';
      const amount = Number(item.amount || 0);
      
      let balanceChange = 0;
      if (item.type === 'collected') {
        balanceChange = amount;
      } else if (item.type === 'remitted') {
        balanceChange = -amount;
      }
      
      const current = riderBalancesMap.get(riderId) || { riderName, balance: 0 };
      if (item.status === 'outstanding') {
        current.balance += balanceChange;
      }
      riderBalancesMap.set(riderId, current);
    });

    const outstandingRiderBalances = Array.from(riderBalancesMap.entries()).map(([riderId, info]) => ({ 
      riderId,
      riderName: info.riderName,
      balance: info.balance,
      limit: 50.00 // Standard limit
    })).filter(b => b.balance > 0);

    return {
      success: true,
      data: { 
        totalCODOrders,
        totalCashExpected,
        totalCashCollected,
        discrepancies,
        outstandingRiderBalances
      }
    };
  } catch (err: any) {
    console.error('Error fetching COD Reconciliation Report:', err);
    return { success: false, error: err.message };
  }
}

export async function processOrderPayment(orderId: string, paymentMethod: string) {
  const { data, error } = await supabase.rpc('process_order_payment', {
    p_order_id: orderId,
    p_payment_method: paymentMethod
  });

  return {
    success: data?.success ?? false,
    message: data?.message || 'Payment processing failed',
    error
  };
}
