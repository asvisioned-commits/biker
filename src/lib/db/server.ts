/**
 * Server-side database queries — use in Server Components & API routes
 * Uses the Supabase SSR server client with cookie-based auth
 */

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

// ─── Dashboard Stats ─────────────────────────────────────────────────

export async function getDashboardStats(userId: string, role: UserRole) {
  const supabase = await createClient();

  if (role === 'customer') {
    const [ordersRes, activeRes] = await Promise.all([
      supabase.from('delivery_requests').select('id, status, total_amount', { count: 'exact' }).eq('customer_id', userId),
      supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('customer_id', userId).not('status', 'in', '("completed","cancelled","failed","refunded")'),
    ]);
    return {
      totalOrders: ordersRes.count || 0,
      activeOrders: activeRes.count || 0,
      totalSpent: ordersRes.data?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0,
    };
  }

  if (role === 'rider') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [profileRes, todayRes, weekRes, ratingRes] = await Promise.all([
      supabase.from('rider_profiles').select('tier, total_completions, completion_rate, avg_rating, is_available').eq('user_id', userId).single(),
      supabase.from('delivery_requests').select('rider_payout').eq('assigned_rider_id', userId).eq('status', 'completed').gte('completed_at', today.toISOString()),
      supabase.from('delivery_requests').select('rider_payout').eq('assigned_rider_id', userId).eq('status', 'completed').gte('completed_at', weekAgo.toISOString()),
      supabase.from('ratings').select('rating').eq('to_user_id', userId).order('created_at', { ascending: false }).limit(50),
    ]);
    const todayEarnings = todayRes.data?.reduce((sum, o) => sum + (Number(o.rider_payout) || 0), 0) || 0;
    const weeklyEarnings = weekRes.data?.reduce((sum, o) => sum + (Number(o.rider_payout) || 0), 0) || 0;
    const avgRating = ratingRes.data?.length ? ratingRes.data.reduce((sum, r) => sum + r.rating, 0) / ratingRes.data.length : 0;
    return {
      todayEarnings, weeklyEarnings,
      completedToday: todayRes.data?.length || 0,
      rating: Number(avgRating.toFixed(1)),
      completionRate: Number(profileRes.data?.completion_rate || 0),
      tier: profileRes.data?.tier || 'starter',
      totalCompletions: profileRes.data?.total_completions || 0,
      isOnline: profileRes.data?.is_available || false,
    };
  }

  if (role === 'merchant') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayRes, pendingRes, linksRes, ratingRes] = await Promise.all([
      supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('merchant_id', userId).gte('created_at', today.toISOString()),
      supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('merchant_id', userId).not('status', 'in', '("completed","cancelled","failed","refunded")'),
      supabase.from('delivery_links').select('id', { count: 'exact' }).eq('merchant_id', userId).eq('status', 'active'),
      supabase.from('merchant_profiles').select('avg_delivery_rating, total_deliveries').eq('user_id', userId).single(),
    ]);
    return {
      todayDeliveries: todayRes.count || 0,
      pendingDeliveries: pendingRes.count || 0,
      activeLinks: linksRes.count || 0,
      avgRating: Number(ratingRes.data?.avg_delivery_rating || 0),
      totalDeliveries: ratingRes.data?.total_deliveries || 0,
    };
  }

  // Ops/Admin stats
  const [activeRes, ridersRes, disputesRes] = await Promise.all([
    supabase.from('delivery_requests').select('id', { count: 'exact' }).not('status', 'in', '("completed","cancelled","failed","refunded")'),
    supabase.from('rider_profiles').select('id', { count: 'exact' }).eq('is_available', true),
    supabase.from('disputes').select('id', { count: 'exact' }).eq('status', 'open'),
  ]);
  return {
    activeOrders: activeRes.count || 0,
    onlineRiders: ridersRes.count || 0,
    openDisputes: disputesRes.count || 0,
  };
}

// ─── Profile ──────────────────────────────────────────────────────

export async function getProfileServer(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(`*, roles:user_roles(role, is_active, verified_at)`)
    .eq('id', userId)
    .single();
  return { data, error };
}

// ─── Orders ───────────────────────────────────────────────────────

export async function getOrdersServer(userId: string, role: UserRole, filters?: { status?: string; limit?: number; offset?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from('delivery_requests')
    .select(`id, reference_code, service_type, fulfillment_mode, protection_level, status, pickup_address, dropoff_address, total_amount, delivery_fee, service_fee, created_at, completed_at, rider:profiles!delivery_requests_assigned_rider_id_fkey(id, full_name, avatar_url, phone), customer:profiles!delivery_requests_customer_id_fkey(id, full_name, avatar_url)`)
    .order('created_at', { ascending: false });

  if (role === 'customer') query = query.eq('customer_id', userId);
  else if (role === 'rider') query = query.eq('assigned_rider_id', userId);
  else if (role === 'merchant') query = query.eq('merchant_id', userId);

  if (filters?.status === 'active') query = query.not('status', 'in', '("completed","cancelled","failed","refunded")');
  else if (filters?.status) query = query.eq('status', filters.status);

  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  return { data, error };
}

export async function getOrderByIdServer(orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('delivery_requests')
    .select(`*, rider:profiles!delivery_requests_assigned_rider_id_fkey(id, full_name, avatar_url, phone, trust_score), customer:profiles!delivery_requests_customer_id_fkey(id, full_name, avatar_url, phone), proofs:delivery_proofs(id, proof_type, file_url, file_type, notes, lat, lng, verified, created_at), status_log:delivery_status_log(id, from_status, to_status, changed_by, notes, lat, lng, created_at), quote:quotes(id, total_amount, delivery_fee, service_fee, protection_fee, surge_multiplier, rush_premium, saver_discount)`)
    .eq('id', orderId)
    .single();
  return { data, error };
}

// ─── Rider ────────────────────────────────────────────────────────

export async function getRiderProfileServer(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('rider_profiles').select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function getAvailableJobsServer(riderId: string, zone?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('order_offers')
    .select(`id, status, expires_at, distance_to_pickup_km, estimated_rider_payout, offer_rank, order:delivery_requests(id, reference_code, service_type, fulfillment_mode, protection_level, pickup_address, dropoff_address, estimated_distance_km, total_amount, delivery_fee)`)
    .eq('rider_id', riderId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  const { data, error } = await query;
  return { data, error };
}

// ─── Merchant ─────────────────────────────────────────────────────

export async function getMerchantProfileServer(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('merchant_profiles').select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function getDeliveryLinksServer(merchantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('delivery_links')
    .select(`*, order:delivery_requests(id, reference_code, status, rider:profiles!delivery_requests_assigned_rider_id_fkey(full_name))`)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return { data, error };
}

// ─── Notifications ────────────────────────────────────────────────

export async function getNotificationsServer(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(limit);
  return { data, error };
}

export async function getUnreadCountServer(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('read', false);
  return { count: count || 0, error };
}

// ─── Disputes ─────────────────────────────────────────────────────

export async function getDisputesServer(userId: string, role: UserRole) {
  const supabase = await createClient();
  let query = supabase
    .from('disputes')
    .select(`*, request:delivery_requests(reference_code, service_type, total_amount), initiator:profiles!disputes_initiated_by_fkey(full_name, avatar_url), against:profiles!disputes_against_user_id_fkey(full_name, avatar_url)`)
    .order('created_at', { ascending: false });
  if (role === 'ops' || role === 'admin') { /* Ops sees all disputes via RLS */ }
  else { query = query.or(`initiated_by.eq.${userId},against_user_id.eq.${userId}`); }
  const { data, error } = await query;
  return { data, error };
}

// ─── Earnings ─────────────────────────────────────────────────────

export async function getRiderEarningsServer(riderId: string, period: 'today' | 'week' | 'month') {
  const supabase = await createClient();
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
  }
  const { data, error } = await supabase
    .from('delivery_requests')
    .select('id, reference_code, rider_payout, service_type, completed_at')
    .eq('assigned_rider_id', riderId)
    .eq('status', 'completed')
    .gte('completed_at', startDate.toISOString())
    .order('completed_at', { ascending: false });
  const total = data?.reduce((sum, d) => sum + (Number(d.rider_payout) || 0), 0) || 0;
  return { data, total, count: data?.length || 0, error };
}

// ─── Accounts / Wallet ──────────────────────────────────────────────

export async function getUserAccountsServer(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('*').eq('owner_id', userId);
  return { data, error };
}
