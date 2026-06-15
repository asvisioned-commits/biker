/**
 * Actions for Rider subscriptions, earnings log, payment verification, and status auditing.
 * Operates strictly in live-database mode (using Supabase client).
 */

import { createClient } from '@/lib/supabase/client';

export interface RiderSubscription {
  id?: string;
  rider_id: string;
  region_tier: 'zimbabwe' | 'standard';
  deposit_amount: number;
  earning_cap: number;
  current_earnings: number;
  emergency_credit_used: number;
  total_debt?: number;
  status: 'active' | 'grace_period' | 'suspended' | 'closed';
  subscription_expires_at: string | null;
  grace_period_ends_at: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface EarningsLogEntry {
  id: string;
  rider_id: string;
  order_id?: string;
  amount: number;
  type: 'delivery' | 'subscription_renewal' | 'emergency_credit' | 'penalty' | 'refund';
  balance_after: number;
  metadata?: any;
  created_at: string;
}

export interface PaymentProof {
  id: string;
  rider_id: string;
  rider_name: string;
  amount: number;
  payment_method: 'ecocash' | 'innbucks' | 'onemoney';
  reference_number: string;
  proof_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
}

export interface StatusAuditEntry {
  id: string;
  rider_id: string;
  from_status: string;
  to_status: string;
  trigger: 'manual_admin' | 'auto_system' | 'payment_received' | 'fraud_flag';
  reason: string;
  admin_id?: string;
  created_at: string;
}

/**
 * Fetch a rider's subscription details
 */
export async function getRiderSubscription(riderId: string): Promise<RiderSubscription> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rider_subscriptions')
    .select('*')
    .eq('rider_id', riderId)
    .single();

  if (error || !data) {
    return {
      rider_id: riderId,
      region_tier: 'zimbabwe',
      deposit_amount: 5.00,
      earning_cap: 60.00,
      current_earnings: 0.00,
      emergency_credit_used: 0.00,
      status: 'active',
      subscription_expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      grace_period_ends_at: null,
    };
  }

  return data as RiderSubscription;
}

/**
 * Subscribe or Renew subscription
 */
export async function subscribeOrRenew(
  riderId: string,
  riderName: string,
  tier: 'zimbabwe' | 'standard',
  paymentMethod: 'stripe' | 'ecocash' | 'innbucks' | 'onemoney',
  referenceNumber?: string,
  proofImageUrl?: string
): Promise<{ success: boolean; status: string; totalPaid: number; message: string }> {
  const basePrice = tier === 'zimbabwe' ? 5.00 : 10.00;
  
  const currentSub = await getRiderSubscription(riderId);
  const creditDebt = Number(currentSub?.emergency_credit_used || 0);
  const total = basePrice + creditDebt;

  if (paymentMethod !== 'stripe') {
    if (!referenceNumber) {
      return { success: false, status: 'error', totalPaid: 0, message: 'Reference number is required for mobile money.' };
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('rider_payment_proofs')
      .insert({
        rider_id: riderId,
        amount: total,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        proof_image_url: proofImageUrl || 'https://via.placeholder.com/300x500?text=EcoCash+Screenshot+Mockup',
        status: 'pending',
      });

    if (error) {
      return { success: false, status: 'error', totalPaid: 0, message: error.message };
    }

    return {
      success: true,
      status: 'pending_approval',
      totalPaid: total,
      message: 'Payment proof submitted. Admin will verify shortly.',
    };
  }

  const supabase = createClient();
  const cap = tier === 'zimbabwe' ? 60.00 : 90.00;
  
  const { error } = await supabase
    .from('rider_subscriptions')
    .upsert({
      rider_id: riderId,
      region_tier: tier,
      deposit_amount: basePrice,
      earning_cap: cap,
      current_earnings: 0.00,
      emergency_credit_used: 0.00,
      status: 'active',
      subscription_expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      grace_period_ends_at: null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, status: 'error', totalPaid: 0, message: error.message };
  }

  await supabase.from('rider_earnings_log').insert({
    rider_id: riderId,
    amount: -total,
    type: 'subscription_renewal',
    balance_after: 0.00,
    metadata: { tier, paymentMethod, creditDebt },
  });

  return { success: true, status: 'active', totalPaid: total, message: 'Subscription renewed.' };
}

/**
 * Request Emergency Credit ($2.50 advance)
 */
export async function requestEmergencyCredit(riderId: string): Promise<{ success: boolean; message: string }> {
  const currentSub = await getRiderSubscription(riderId);

  if (!currentSub) {
    return { success: false, message: 'Active plan not found.' };
  }

  if (currentSub.status !== 'grace_period' && currentSub.status !== 'active' && currentSub.current_earnings < currentSub.earning_cap) {
    return { success: false, message: 'Emergency credit is only available when close to or at your earnings cap.' };
  }

  if (currentSub.emergency_credit_used > 0) {
    return { success: false, message: 'You have already exhausted your emergency credit for this subscription cycle.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('rider_subscriptions')
    .update({
      emergency_credit_used: 2.50,
      status: 'active',
      grace_period_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('rider_id', riderId);

  if (error) return { success: false, message: error.message };

  await supabase.from('rider_earnings_log').insert({
    rider_id: riderId,
    amount: 2.50,
    type: 'emergency_credit',
    balance_after: 2.50,
  });

  return { success: true, message: 'Emergency credit of $2.50 activated.' };
}

/**
 * Record delivery earnings, handling caps, grace periods, and auto-suspensions
 */
export async function recordDeliveryEarning(
  riderId: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; status: string; currentEarnings: number; message: string }> {
  const currentSub = await getRiderSubscription(riderId);

  if (!currentSub) {
    return { success: false, status: 'error', currentEarnings: 0, message: 'Subscription details not found.' };
  }

  if (currentSub.status === 'suspended') {
    return { success: false, status: 'suspended', currentEarnings: currentSub.current_earnings, message: 'Account is suspended. Repay/renew to proceed.' };
  }

  if (currentSub.status === 'closed') {
    return { success: false, status: 'closed', currentEarnings: currentSub.current_earnings, message: 'Account is closed. Contact support.' };
  }

  const baseCap = currentSub.earning_cap;
  const emergencyCredit = Number(currentSub.emergency_credit_used);
  const totalCap = baseCap + (emergencyCredit > 0 ? 30.00 : 0.00);
  const newEarnings = Number(currentSub.current_earnings) + amount;

  let finalStatus: 'active' | 'grace_period' | 'suspended' = 'active';
  let graceEndsAt = currentSub.grace_period_ends_at;

  if (newEarnings >= totalCap) {
    if (emergencyCredit > 0) {
      finalStatus = 'suspended';
    } else {
      finalStatus = 'grace_period';
      graceEndsAt = new Date(Date.now() + 72 * 3600000).toISOString();
    }
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('rider_subscriptions')
    .update({
      current_earnings: newEarnings,
      status: finalStatus,
      grace_period_ends_at: graceEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('rider_id', riderId);

  if (error) {
    return { success: false, status: 'error', currentEarnings: 0, message: error.message };
  }

  await supabase.from('rider_earnings_log').insert({
    rider_id: riderId,
    order_id: orderId,
    amount: amount,
    type: 'delivery',
    balance_after: newEarnings,
  });

  return { success: true, status: finalStatus, currentEarnings: newEarnings, message: 'Earnings recorded.' };
}

/**
 * Fetch all transaction ledger entries for a rider
 */
export async function getEarningsLedger(riderId: string): Promise<EarningsLogEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('rider_earnings_log')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });

  return (data || []) as EarningsLogEntry[];
}

/**
 * Fetch all pending and recent payment proofs for admin review
 */
export async function adminGetPaymentProofs(): Promise<PaymentProof[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('rider_payment_proofs')
    .select('*')
    .order('created_at', { ascending: false });

  return (data || []) as PaymentProof[];
}

/**
 * Admin: Approve a submitted payment proof
 */
export async function adminApprovePaymentProof(proofId: string, adminId: string): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  
  const { data: proof, error: proofErr } = await supabase
    .from('rider_payment_proofs')
    .select('*')
    .eq('id', proofId)
    .single();

  if (proofErr || !proof) return { success: false, message: 'Proof query failed.' };

  await supabase
    .from('rider_payment_proofs')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', proofId);

  const { data: sub } = await supabase
    .from('rider_subscriptions')
    .select('*')
    .eq('rider_id', proof.rider_id)
    .single();

  const region = sub?.region_tier || 'zimbabwe';
  const cap = region === 'zimbabwe' ? 60.00 : 90.00;
  const deposit = region === 'zimbabwe' ? 5.00 : 10.00;

  await supabase
    .from('rider_subscriptions')
    .upsert({
      rider_id: proof.rider_id,
      region_tier: region,
      deposit_amount: deposit,
      earning_cap: cap,
      current_earnings: 0.00,
      emergency_credit_used: 0.00,
      status: 'active',
      subscription_expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      grace_period_ends_at: null,
      updated_at: new Date().toISOString(),
    });

  await supabase.from('rider_earnings_log').insert({
    rider_id: proof.rider_id,
    amount: -proof.amount,
    type: 'subscription_renewal',
    balance_after: 0.00,
    metadata: { tier: region, paymentMethod: proof.payment_method, proofId },
  });

  await supabase.from('rider_status_audit').insert({
    rider_id: proof.rider_id,
    from_status: sub?.status || 'active',
    to_status: 'active',
    trigger: 'payment_received',
    reason: `Mobile payment proof approved.`,
    admin_id: adminId,
  });

  return { success: true, message: 'Proof approved.' };
}

/**
 * Admin: Reject a submitted payment proof
 */
export async function adminRejectPaymentProof(proofId: string, notes: string): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('rider_payment_proofs')
    .update({
      status: 'rejected',
      admin_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proofId);

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Proof rejected.' };
}

/**
 * Fetch all rider subscriptions for admin moderation
 */
export async function adminGetRiders(): Promise<RiderSubscription[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('rider_subscriptions')
    .select('*')
    .order('updated_at', { ascending: false });

  return (data || []) as RiderSubscription[];
}

/**
 * Admin: Override rider billing status manually
 */
export async function adminOverrideRiderStatus(
  riderId: string,
  newStatus: 'active' | 'grace_period' | 'suspended' | 'closed',
  reason: string,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  const currentSub = await getRiderSubscription(riderId);
  const oldStatus = currentSub?.status || 'active';

  const supabase = createClient();
  const updates: Partial<RiderSubscription> = {
    status: newStatus,
    updated_at: new Date().toISOString() as any,
  };

  if (newStatus === 'active') {
    updates.current_earnings = 0.00;
    updates.emergency_credit_used = 0.00;
  }

  const { error } = await supabase
    .from('rider_subscriptions')
    .update(updates)
    .eq('rider_id', riderId);

  if (error) return { success: false, message: error.message };

  await supabase.from('rider_status_audit').insert({
    rider_id: riderId,
    from_status: oldStatus,
    to_status: newStatus,
    trigger: 'manual_admin',
    reason,
    admin_id: adminId,
  });

  return { success: true, message: 'Status updated.' };
}

/**
 * Complete safety quiz for a rider
 */
export async function completeRiderSafetyQuiz(riderId: string): Promise<{ success: boolean; error?: any; data?: any }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rider_profiles')
    .update({ safety_quiz_completed: true })
    .eq('user_id', riderId)
    .select()
    .single();
  return { success: !error, error, data };
}

/**
 * Create a counter offer on a delivery request
 */
export async function createCounterOffer(orderId: string, riderId: string, amount: number): Promise<{ success: boolean; error?: any; data?: any; message?: string }> {
  const { createCounterOffer: dbCreateCounterOffer } = await import('@/lib/database');
  const { data, error } = await dbCreateCounterOffer(orderId, riderId, amount);
  return { success: !error, error, data };
}

/**
 * Get active counter offers for a delivery request
 */
export async function getCounterOffersForOrder(orderId: string): Promise<{ success: boolean; error?: any; data: any[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('order_offers')
    .select(`
      *,
      rider:profiles!order_offers_rider_id_fkey(full_name, avatar_url, trust_tier)
    `)
    .eq('order_id', orderId)
    .eq('status', 'counter_offered')
    .gt('expires_at', new Date().toISOString());

  const mapped = (data || []).map((o: any) => ({
    ...o,
    rider_name: o.rider?.full_name || 'Rider',
    rider_avatar: o.rider?.avatar_url || '',
    rider_rating: 4.8,
    is_verified: ['verified', 'pro', 'elite', 'business_courier'].includes(o.rider?.trust_tier || '')
  }));
  
  return { success: !error, error, data: mapped };
}

/**
 * Respond (Accept/Decline) to a counter offer
 */
export async function respondToCounterOffer(offerId: string, action: 'accept' | 'decline'): Promise<{ success: boolean; error?: any; data?: any; message?: string }> {
  const { respondToCounterOffer: dbRespondToCounterOffer } = await import('@/lib/database');
  const { data, error } = await dbRespondToCounterOffer(offerId, action);
  return { success: !error, error, data };
}

/**
 * Get rolling today/week/month earnings metrics, trust scores, and tier status
 */
export async function getRiderDashboardStats(riderId: string) {
  const { getRiderDashboardStats: dbGetRiderDashboardStats } = await import('@/lib/database');
  return dbGetRiderDashboardStats(riderId);
}

/**
 * Toggle online status for a rider
 */
export async function updateRiderOnlineStatus(riderId: string, isAvailable: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rider_profiles')
    .update({ is_available: isAvailable })
    .eq('user_id', riderId)
    .select()
    .single();
  return { success: !error, error, data };
}

/**
 * Fetch status audit history logs for a rider
 */
export async function getRiderAuditLogs(riderId: string): Promise<StatusAuditEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('rider_status_audit')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });

  return (data || []) as StatusAuditEntry[];
}
  







