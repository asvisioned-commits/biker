/**
 * Actions for Rider subscriptions, earnings log, payment verification, and status auditing.
 * Operates in live-database mode (using Supabase client) or fallback high-fidelity mock mode.
 */

import { createClient } from '@/lib/supabase/client';
import { FLAGS } from '@/lib/flags';

const IS_DEV = !FLAGS.useLiveDb;

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

// Helpers for localStorage fallback keys
const KEYS = {
  SUBSCRIPTIONS: 'biker_subs_subscriptions',
  EARNINGS_LOG: 'biker_subs_earnings_log',
  PAYMENT_PROOFS: 'biker_subs_payment_proofs',
  AUDIT_LOGS: 'biker_subs_audit_logs',
};

// Initial data creator for mock mode
function getMockSubscriptions(): Record<string, RiderSubscription> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(KEYS.SUBSCRIPTIONS);
  if (stored) return JSON.parse(stored);
  return {};
}

function saveMockSubscriptions(data: Record<string, RiderSubscription>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.SUBSCRIPTIONS, JSON.stringify(data));
  }
}

// Default mock transactions
function getMockEarningsLogs(): EarningsLogEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEYS.EARNINGS_LOG);
  if (stored) return JSON.parse(stored);
  const defaults: EarningsLogEntry[] = [
    { id: 'tx-1', rider_id: 'mock-rider', amount: 8.50, type: 'delivery', balance_after: 8.50, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'tx-2', rider_id: 'mock-rider', amount: 12.00, type: 'delivery', balance_after: 20.50, created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 'tx-3', rider_id: 'mock-rider', amount: 15.00, type: 'delivery', balance_after: 35.50, created_at: new Date(Date.now() - 1 * 3600000).toISOString() },
    { id: 'tx-4', rider_id: 'mock-rider', amount: 9.50, type: 'delivery', balance_after: 45.00, created_at: new Date(Date.now() - 100000).toISOString() },
  ];
  localStorage.setItem(KEYS.EARNINGS_LOG, JSON.stringify(defaults));
  return defaults;
}

function saveMockEarningsLog(logs: EarningsLogEntry[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.EARNINGS_LOG, JSON.stringify(logs));
  }
}

function getMockPaymentProofs(): PaymentProof[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEYS.PAYMENT_PROOFS);
  if (stored) return JSON.parse(stored);
  return [];
}

// Save mock payment proofs
function saveMockPaymentProofs(proofs: PaymentProof[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.PAYMENT_PROOFS, JSON.stringify(proofs));
  }
}

export function getMockAuditLogs(): StatusAuditEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEYS.AUDIT_LOGS);
  if (stored) return JSON.parse(stored);
  return [];
}

function saveMockAuditLogs(audits: StatusAuditEntry[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(audits));
  }
}

/**
 * Fetch a rider's subscription details
 */
export async function getRiderSubscription(riderId: string): Promise<RiderSubscription> {
  if (IS_DEV) {
    const subs = getMockSubscriptions();
    if (!subs[riderId]) {
      // Create a default initial subscription for Zimbabwe
      subs[riderId] = {
        rider_id: riderId,
        region_tier: 'zimbabwe',
        deposit_amount: 5.00,
        earning_cap: 60.00,
        current_earnings: 45.00, // Pre-fill with progress
        emergency_credit_used: 0.00,
        status: 'active',
        subscription_expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
        grace_period_ends_at: null,
      };
      saveMockSubscriptions(subs);
    }
    return subs[riderId];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('rider_subscriptions')
    .select('*')
    .eq('rider_id', riderId)
    .single();

  if (error || !data) {
    // If not found in DB, return a default initialized object for the page to use/create
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
  
  // Calculate total: base price + any outstanding emergency credit balance
  const currentSub = await getRiderSubscription(riderId);
  const creditDebt = Number(currentSub?.emergency_credit_used || 0);
  const total = basePrice + creditDebt;

  if (paymentMethod !== 'stripe') {
    // Mobile Money flow requires admin verification queue
    if (!referenceNumber) {
      return { success: false, status: 'error', totalPaid: 0, message: 'Reference number is required for mobile money.' };
    }

    if (IS_DEV) {
      const proofs = getMockPaymentProofs();
      const newProof: PaymentProof = {
        id: 'proof-' + Date.now(),
        rider_id: riderId,
        rider_name: riderName,
        amount: total,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        proof_image_url: proofImageUrl || 'https://via.placeholder.com/300x500?text=EcoCash+Screenshot+Mockup',
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      proofs.push(newProof);
      saveMockPaymentProofs(proofs);
      return {
        success: true,
        status: 'pending_approval',
        totalPaid: total,
        message: 'Payment proof submitted successfully! Waiting for admin verification.',
      };
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

  // Instant card success
  if (IS_DEV) {
    const subs = getMockSubscriptions();
    const sub = subs[riderId] || { rider_id: riderId };
    
    // Log previous status for audit trail
    const fromStatus = sub.status || 'active';
    const audits = getMockAuditLogs();
    audits.push({
      id: 'audit-' + Date.now(),
      rider_id: riderId,
      from_status: fromStatus,
      to_status: 'active',
      trigger: 'payment_received',
      reason: `Renewed standard subscription via Stripe. Paid $${total.toFixed(2)} (includes $${creditDebt.toFixed(2)} credit debt)`,
      created_at: new Date().toISOString(),
    });
    saveMockAuditLogs(audits);

    // Apply updates
    sub.region_tier = tier;
    sub.deposit_amount = basePrice;
    sub.earning_cap = tier === 'zimbabwe' ? 60.00 : 90.00;
    sub.current_earnings = 0.00;
    sub.emergency_credit_used = 0.00;
    sub.status = 'active';
    sub.subscription_expires_at = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
    sub.grace_period_ends_at = null;
    
    subs[riderId] = sub as RiderSubscription;
    saveMockSubscriptions(subs);

    // Ledger Log
    const logs = getMockEarningsLogs();
    logs.push({
      id: 'tx-renew-' + Date.now(),
      rider_id: riderId,
      amount: -total,
      type: 'subscription_renewal',
      balance_after: 0.00,
      metadata: { tier, paymentMethod, creditDebt },
      created_at: new Date().toISOString(),
    });
    saveMockEarningsLog(logs);

    return { success: true, status: 'active', totalPaid: total, message: 'Subscription successfully activated!' };
  }

  // Supabase update code
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

  // Insert ledger entry
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

  if (IS_DEV) {
    const subs = getMockSubscriptions();
    const sub = subs[riderId];
    if (sub) {
      sub.emergency_credit_used = 2.50;
      sub.status = 'active'; // Returns to active but with outstanding debt
      sub.grace_period_ends_at = null;
      subs[riderId] = sub;
      saveMockSubscriptions(subs);

      // Ledger entry
      const logs = getMockEarningsLogs();
      logs.push({
        id: 'tx-credit-' + Date.now(),
        rider_id: riderId,
        amount: 2.50,
        type: 'emergency_credit',
        balance_after: 2.50,
        created_at: new Date().toISOString(),
      });
      saveMockEarningsLog(logs);

      // Audit entry
      const audits = getMockAuditLogs();
      audits.push({
        id: 'audit-' + Date.now(),
        rider_id: riderId,
        from_status: 'grace_period',
        to_status: 'active',
        trigger: 'auto_system',
        reason: 'Granted $2.50 emergency credit advance.',
        created_at: new Date().toISOString(),
      });
      saveMockAuditLogs(audits);
    }
    return { success: true, message: 'Emergency credit of $2.50 granted. You can keep taking orders!' };
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
  // Cap is extended by $30 if they have emergency credit (giving a grace buffer of earnings)
  const totalCap = baseCap + (emergencyCredit > 0 ? 30.00 : 0.00);
  const newEarnings = Number(currentSub.current_earnings) + amount;

  let finalStatus: 'active' | 'grace_period' | 'suspended' = 'active';
  let graceEndsAt = currentSub.grace_period_ends_at;

  // Determine transition state
  if (newEarnings >= totalCap) {
    if (emergencyCredit > 0) {
      // Exceeded emergency buffer, transition to suspended
      finalStatus = 'suspended';
    } else {
      // Reached base cap, trigger 72h grace period warning
      finalStatus = 'grace_period';
      graceEndsAt = new Date(Date.now() + 72 * 3600000).toISOString();
    }
  }

  if (IS_DEV) {
    const subs = getMockSubscriptions();
    const sub = subs[riderId];
    if (sub) {
      const oldStatus = sub.status;
      sub.current_earnings = newEarnings;
      sub.status = finalStatus;
      sub.grace_period_ends_at = graceEndsAt;
      subs[riderId] = sub;
      saveMockSubscriptions(subs);

      // Ledger log
      const logs = getMockEarningsLogs();
      logs.push({
        id: 'tx-earn-' + Date.now(),
        rider_id: riderId,
        order_id: orderId,
        amount: amount,
        type: 'delivery',
        balance_after: newEarnings,
        created_at: new Date().toISOString(),
      });
      saveMockEarningsLog(logs);

      // Audit if status changed
      if (oldStatus !== finalStatus) {
        const audits = getMockAuditLogs();
        audits.push({
          id: 'audit-' + Date.now(),
          rider_id: riderId,
          from_status: oldStatus,
          to_status: finalStatus,
          trigger: 'auto_system',
          reason: `Earnings reached $${newEarnings.toFixed(2)}. Cap limit is $${totalCap.toFixed(2)}。`,
          created_at: new Date().toISOString(),
        });
        saveMockAuditLogs(audits);
      }
    }
    return {
      success: true,
      status: finalStatus,
      currentEarnings: newEarnings,
      message: finalStatus === 'suspended'
        ? 'Earnings limit exceeded. Account has been suspended.'
        : finalStatus === 'grace_period'
          ? 'You have reached your earning cap! 72-hour grace period started. Please renew.'
          : 'Earning registered successfully.',
    };
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

  // Log in ledger
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
  if (IS_DEV) {
    const logs = getMockEarningsLogs();
    return logs.filter(l => l.rider_id === riderId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

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
  if (IS_DEV) {
    return getMockPaymentProofs().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

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
  if (IS_DEV) {
    const proofs = getMockPaymentProofs();
    const proofIndex = proofs.findIndex(p => p.id === proofId);
    if (proofIndex === -1) return { success: false, message: 'Proof not found.' };

    const proof = proofs[proofIndex];
    proof.status = 'approved';
    proofs[proofIndex] = proof;
    saveMockPaymentProofs(proofs);

    // Apply the subscription renewal to the rider
    const subs = getMockSubscriptions();
    const sub = subs[proof.rider_id] || { rider_id: proof.rider_id };
    
    const creditDebt = Number(sub.emergency_credit_used || 0);
    const region = sub.region_tier || 'zimbabwe';
    
    sub.region_tier = region;
    sub.deposit_amount = region === 'zimbabwe' ? 5.00 : 10.00;
    sub.earning_cap = region === 'zimbabwe' ? 60.00 : 90.00;
    sub.current_earnings = 0.00;
    sub.emergency_credit_used = 0.00;
    sub.status = 'active';
    sub.subscription_expires_at = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
    sub.grace_period_ends_at = null;
    
    subs[proof.rider_id] = sub as RiderSubscription;
    saveMockSubscriptions(subs);

    // Add renewal to earnings log ledger
    const logs = getMockEarningsLogs();
    logs.push({
      id: 'tx-renew-mm-' + Date.now(),
      rider_id: proof.rider_id,
      amount: -proof.amount,
      type: 'subscription_renewal',
      balance_after: 0.00,
      metadata: { tier: region, paymentMethod: proof.payment_method, proofId, creditDebt },
      created_at: new Date().toISOString(),
    });
    saveMockEarningsLog(logs);

    // Add status audit entry
    const audits = getMockAuditLogs();
    audits.push({
      id: 'audit-' + Date.now(),
      rider_id: proof.rider_id,
      from_status: 'grace_period',
      to_status: 'active',
      trigger: 'payment_received',
      reason: `EcoCash/Mobile proof approved by admin. Paid $${proof.amount.toFixed(2)}.`,
      admin_id: adminId,
      created_at: new Date().toISOString(),
    });
    saveMockAuditLogs(audits);

    return { success: true, message: 'Payment proof approved and subscription renewed successfully!' };
  }

  const supabase = createClient();
  
  // Fetch the proof
  const { data: proof, error: proofErr } = await supabase
    .from('rider_payment_proofs')
    .select('*')
    .eq('id', proofId)
    .single();

  if (proofErr || !proof) return { success: false, message: 'Proof query failed.' };

  // Update proof status
  await supabase
    .from('rider_payment_proofs')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', proofId);

  // Fetch current sub
  const { data: sub } = await supabase
    .from('rider_subscriptions')
    .select('*')
    .eq('rider_id', proof.rider_id)
    .single();

  const region = sub?.region_tier || 'zimbabwe';
  const cap = region === 'zimbabwe' ? 60.00 : 90.00;
  const deposit = region === 'zimbabwe' ? 5.00 : 10.00;

  // Update rider subscription
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

  // Log ledger
  await supabase.from('rider_earnings_log').insert({
    rider_id: proof.rider_id,
    amount: -proof.amount,
    type: 'subscription_renewal',
    balance_after: 0.00,
    metadata: { tier: region, paymentMethod: proof.payment_method, proofId },
  });

  // Audit
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
  if (IS_DEV) {
    const proofs = getMockPaymentProofs();
    const proofIndex = proofs.findIndex(p => p.id === proofId);
    if (proofIndex === -1) return { success: false, message: 'Proof not found.' };

    const proof = proofs[proofIndex];
    proof.status = 'rejected';
    proof.admin_notes = notes;
    proofs[proofIndex] = proof;
    saveMockPaymentProofs(proofs);

    return { success: true, message: 'Payment proof rejected with notes.' };
  }

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
  if (IS_DEV) {
    const subs = getMockSubscriptions();
    return Object.values(subs);
  }

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

  if (IS_DEV) {
    const subs = getMockSubscriptions();
    const sub = subs[riderId];
    if (sub) {
      sub.status = newStatus;
      if (newStatus === 'active') {
        sub.current_earnings = 0.00;
        sub.emergency_credit_used = 0.00;
      }
      subs[riderId] = sub;
      saveMockSubscriptions(subs);

      // Audit log
      const audits = getMockAuditLogs();
      audits.push({
        id: 'audit-' + Date.now(),
        rider_id: riderId,
        from_status: oldStatus,
        to_status: newStatus,
        trigger: 'manual_admin',
        reason: reason,
        admin_id: adminId,
        created_at: new Date().toISOString(),
      });
      saveMockAuditLogs(audits);
    }
    return { success: true, message: `Rider status overridden to ${newStatus}.` };
  }

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
