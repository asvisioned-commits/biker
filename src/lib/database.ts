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

export async function updateProfile(userId: string, updates: { full_name?: string; avatar_url?: string; phone?: string; }) {
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
}) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const reference = 'BKR-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const { data, error } = await supabase.from('delivery_requests').insert({ ...order, reference_code: reference, status: 'draft' }).select().single();
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
  const { data, error } = await supabase.from('delivery_requests').select(`*, rider:profiles!delivery_requests_assigned_rider_id_fkey(id, full_name, avatar_url, phone), customer:profiles!delivery_requests_customer_id_fkey(id, full_name, avatar_url, phone), proofs:delivery_proofs(proof_type, file_url, notes, created_at), status_log:delivery_status_log(from_status, to_status, changed_by, notes, created_at)`).eq('id', orderId).single();
  return { data, error };
}

export async function updateOrderStatus(orderId: string, status: string, notes?: string) {
  const { data, error } = await supabase.from('delivery_requests').update({ status }).eq('id', orderId).select().single();
  if (!error) { await supabase.from('delivery_status_log').insert({ request_id: orderId, to_status: status, notes }); }
  return { data, error };
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

// ─── Rider ─────────────────────────────────────────────────────────

export async function getRiderProfile(userId: string) {
  const { data, error } = await supabase.from('rider_profiles').select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function updateRiderProfile(userId: string, updates: { vehicle_type?: VehicleType; vehicle_registration?: string; license_number?: string; operating_zone?: string; is_available?: boolean; }) {
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

export async function createRiderProfile(profile: { user_id: string; vehicle_type?: 'bicycle' | 'motorcycle' | 'car' | 'van'; vehicle_registration?: string; license_number?: string; operating_zone?: string; }) {
  const { data, error } = await supabase.from('rider_profiles').insert(profile).select().single();
  if (!error) { await supabase.from('user_roles').upsert({ user_id: profile.user_id, role: 'rider', is_active: true }, { onConflict: 'user_id,role' }); }
  return { data, error };
}

export async function toggleRiderOnline(userId: string, isAvailable: boolean) {
  const { data, error } = await supabase.from('rider_profiles').update({ is_available: isAvailable }).eq('user_id', userId).select().single();
  return { data, error };
}

// ─── Merchant Profile ─────────────────────────────────────────────

export async function createMerchantProfile(profile: { user_id: string; business_name: string; business_type?: 'boutique' | 'pharmacy' | 'grocery' | 'restaurant' | 'electronics' | 'general'; whatsapp_number?: string; instagram_handle?: string; }) {
  const { data, error } = await supabase.from('merchant_profiles').insert(profile).select().single();
  if (!error) { await supabase.from('user_roles').upsert({ user_id: profile.user_id, role: 'merchant', is_active: true }, { onConflict: 'user_id,role' }); }
  return { data, error };
}

// ─── Notifications ────────────────────────────────────────────────

export async function getNotifications(userId: string, limit = 20) {
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(limit);
  return { data, error };
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

// ─── Rider Location ───────────────────────────────────────────────

export async function insertLocationCheckpoint(checkpoint: {
  rider_id: string; order_id?: string; event_type: string;
  lat: number; lng: number; heading?: number; speed_kmh?: number; accuracy_meters?: number;
}) {
  const { data, error } = await supabase.from('rider_location_checkpoints').insert(checkpoint).select().single();
  return { data, error };
}
