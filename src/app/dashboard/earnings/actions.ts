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

function getMockEarningsLogs(): EarningsLogEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEYS.EARNINGS_LOG);
  if (stored) return JSON.parse(stored);
  // Default mock transactions
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
          reason: `Earnings reached $${newEarnings.toFixed(2)}. Cap limit is $${totalCap.toFixed(2)}.`,
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
      reason: `EcoCash/Mobile proof approved by admin. Paid $${proof.amount.toFixed(2)}.`,\n      admin_id: adminId,\n      created_at: new Date().toISOString(),\n    });\n    saveMockAuditLogs(audits);\n\n    return { success: true, message: 'Payment proof approved and subscription renewed successfully!' };\n  }\n\n  const supabase = createClient();\n  \n  // Fetch the proof\n  const { data: proof, error: proofErr } = await supabase\n    .from('rider_payment_proofs')\n    .select('*')\n    .eq('id', proofId)\n    .single();\n\n  if (proofErr || !proof) return { success: false, message: 'Proof query failed.' };\n\n  // Update proof status\n  await supabase\n    .from('rider_payment_proofs')\n    .update({ status: 'approved', updated_at: new Date().toISOString() })\n    .eq('id', proofId);\n\n  // Fetch current sub\n  const { data: sub } = await supabase\n    .from('rider_subscriptions')\n    .select('*')\n    .eq('rider_id', proof.rider_id)\n    .single();\n\n  const region = sub?.region_tier || 'zimbabwe';\n  const cap = region === 'zimbabwe' ? 60.00 : 90.00;\n  const deposit = region === 'zimbabwe' ? 5.00 : 10.00;\n\n  // Update rider subscription\n  await supabase\n    .from('rider_subscriptions')\n    .upsert({\n      rider_id: proof.rider_id,\n      region_tier: region,\n      deposit_amount: deposit,\n      earning_cap: cap,\n      current_earnings: 0.00,\n      emergency_credit_used: 0.00,\n      status: 'active',\n      subscription_expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),\n      grace_period_ends_at: null,\n      updated_at: new Date().toISOString(),\n    });\n\n  // Log ledger\n  await supabase.from('rider_earnings_log').insert({\n    rider_id: proof.rider_id,\n    amount: -proof.amount,\n    type: 'subscription_renewal',\n    balance_after: 0.00,\n    metadata: { tier: region, paymentMethod: proof.payment_method, proofId },\n  });\n\n  // Audit\n  await supabase.from('rider_status_audit').insert({\n    rider_id: proof.rider_id,\n    from_status: sub?.status || 'active',\n    to_status: 'active',\n    trigger: 'payment_received',\n    reason: `Mobile payment proof approved.`,\n    admin_id: adminId,\n  });\n\n  return { success: true, message: 'Proof approved.' };\n}\n\n/**\n * Admin: Reject a submitted payment proof\n */\nexport async function adminRejectPaymentProof(proofId: string, notes: string): Promise<{ success: boolean; message: string }> {\n  if (IS_DEV) {\n    const proofs = getMockPaymentProofs();\n    const proofIndex = proofs.findIndex(p => p.id === proofId);\n    if (proofIndex === -1) return { success: false, message: 'Proof not found.' };\n\n    const proof = proofs[proofIndex];\n    proof.status = 'rejected';\n    proof.admin_notes = notes;\n    proofs[proofIndex] = proof;\n    saveMockPaymentProofs(proofs);\n\n    return { success: true, message: 'Payment proof rejected with notes.' };\n  }\n\n  const supabase = createClient();\n  const { error } = await supabase\n    .from('rider_payment_proofs')\n    .update({\n      status: 'rejected',\n      admin_notes: notes,\n      updated_at: new Date().toISOString(),\n    })\n    .eq('id', proofId);\n\n  if (error) return { success: false, message: error.message };\n  return { success: true, message: 'Proof rejected.' };\n}\n\n/**\n * Fetch all rider subscriptions for admin moderation\n */\nexport async function adminGetRiders(): Promise<RiderSubscription[]> {\n  if (IS_DEV) {\n    const subs = getMockSubscriptions();\n    return Object.values(subs);\n  }\n\n  const supabase = createClient();\n  const { data } = await supabase\n    .from('rider_subscriptions')\n    .select('*')\n    .order('updated_at', { ascending: false });\n\n  return (data || []) as RiderSubscription[];\n}\n\n/**\n * Admin: Override rider billing status manually\n */\nexport async function adminOverrideRiderStatus(\n  riderId: string,\n  newStatus: 'active' | 'grace_period' | 'suspended' | 'closed',\n  reason: string,\n  adminId: string\n): Promise<{ success: boolean; message: string }> {\n  const currentSub = await getRiderSubscription(riderId);\n  const oldStatus = currentSub?.status || 'active';\n\n  if (IS_DEV) {\n    const subs = getMockSubscriptions();\n    const sub = subs[riderId];\n    if (sub) {\n      sub.status = newStatus;\n      if (newStatus === 'active') {\n        sub.current_earnings = 0.00;\n        sub.emergency_credit_used = 0.00;\n      }\n      subs[riderId] = sub;\n      saveMockSubscriptions(subs);\n\n      // Audit log\n      const audits = getMockAuditLogs();\n      audits.push({ \n        id: 'audit-' + Date.now(),\n        rider_id: riderId,\n        from_status: oldStatus,\n        to_status: newStatus,\n        trigger: 'manual_admin',\n        reason: reason,\n        admin_id: adminId,\n        created_at: new Date().toISOString(),\n      });\n      saveMockAuditLogs(audits);\n    }\n    return { success: true, message: `Rider status overridden to ${newStatus}.` };\n  }\n\n  const supabase = createClient();\n  const updates: Partial<RiderSubscription> = {\n    status: newStatus,\n    updated_at: new Date().toISOString() as any,\n  };\n\n  if (newStatus === 'active') {\n    updates.current_earnings = 0.00;\n    updates.emergency_credit_used = 0.00;\n  }\n\n  const { error } = await supabase\n    .from('rider_subscriptions')\n    .update(updates)\n    .eq('rider_id', riderId);\n\n  if (error) return { success: false, message: error.message };\n\n  await supabase.from('rider_status_audit').insert({\n    rider_id: riderId,\n    from_status: oldStatus,\n    to_status: newStatus,\n    trigger: 'manual_admin',\n    reason,\n    admin_id: adminId,\n  });\n\n  return { success: true, message: 'Status updated.' };\n}\n\n/**\n * Complete safety quiz for a rider\n */\nexport async function completeRiderSafetyQuiz(riderId: string): Promise<{ success: boolean; error?: any; data?: any }> {\n  if (IS_DEV) {\n    if (typeof window !== 'undefined') {\n      localStorage.setItem(`safety_quiz_completed_${riderId}`, 'true');\n    }\n    return { success: true };\n  }\n  const supabase = createClient();\n  const { data, error } = await supabase\n    .from('rider_profiles')\n    .update({ safety_quiz_completed: true })\n    .eq('user_id', riderId)\n    .select()\n    .single();\n  return { success: !error, error, data };\n}\n\n/**\n * Create a counter offer on a delivery request\n */\nexport async function createCounterOffer(orderId: string, riderId: string, amount: number): Promise<{ success: boolean; error?: any; data?: any; message?: string }> {\n  if (IS_DEV) {\n    const key = `biker_order_offers_${orderId}`;\n    if (typeof window !== 'undefined') {\n      const stored = localStorage.getItem(key);\n      const offers = stored ? JSON.parse(stored) : [];\n      const newOffer = {\n        id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,\n        order_id: orderId,\n        rider_id: riderId,\n        status: 'counter_offered',\n        counter_offer_amount: amount,\n        estimated_rider_payout: amount,\n        created_at: new Date().toISOString(),\n        expires_at: new Date(Date.now() + 120 * 1000).toISOString(),\n        rider_name: 'Mock Rider',\n        rider_rating: 4.8,\n        rider_avatar: ''\n      };\n      offers.push(newOffer);\n      localStorage.setItem(key, JSON.stringify(offers));\n      return { success: true, data: newOffer };\n    }\n    return { success: false, message: 'Window undefined' };\n  }\n  \n  const { createCounterOffer: dbCreateCounterOffer } = await import('@/lib/database');\n  const { data, error } = await dbCreateCounterOffer(orderId, riderId, amount);\n  return { success: !error, error, data };\n}\n\n/**\n * Get active counter offers for a delivery request\n */\nexport async function getCounterOffersForOrder(orderId: string): Promise<{ success: boolean; error?: any; data: any[] }> {\n  if (IS_DEV) {\n    if (typeof window !== 'undefined') {\n      const key = `biker_order_offers_${orderId}`;\n      const stored = localStorage.getItem(key);\n      const offers = stored ? JSON.parse(stored) : [];\n      const activeOffers = offers.filter((o: any) => new Date(o.expires_at).getTime() > Date.now() && o.status === 'counter_offered');\n      return { success: true, data: activeOffers };\n    }\n    return { success: true, data: [] };\n  }\n  \n  const supabase = createClient();\n  const { data, error } = await supabase\n    .from('order_offers')\n    .select(`\n      *,\n      rider:profiles!order_offers_rider_id_fkey(full_name, avatar_url)\n    `)\n    .eq('order_id', orderId)\n    .eq('status', 'counter_offered')\n    .gt('expires_at', new Date().toISOString());\n\n  const mapped = (data || []).map((o: any) => ({\n    ...o,\n    rider_name: o.rider?.full_name || 'Rider',\n    rider_avatar: o.rider?.avatar_url || '',\n    rider_rating: 4.8\n  }));\n  \n  return { success: !error, error, data: mapped };\n}\n\n/**\n * Respond (Accept/Decline) to a counter offer\n */\nexport async function respondToCounterOffer(offerId: string, action: 'accept' | 'decline'): Promise<{ success: boolean; error?: any; data?: any; message?: string }> {\n  if (IS_DEV) {\n    if (typeof window !== 'undefined') {\n      let foundOrderKey = '';\n      let foundOffer: any = null;\n      let allOffers: any[] = [];\n      \n      for (let i = 0; i < localStorage.length; i++) {\n        const key = localStorage.key(i);\n        if (key && key.startsWith('biker_order_offers_')) {\n          const stored = localStorage.getItem(key);\n          const offers = stored ? JSON.parse(stored) : [];\n          const idx = offers.findIndex((o: any) => o.id === offerId);\n          if (idx !== -1) {\n            foundOrderKey = key;\n            foundOffer = offers[idx];\n            allOffers = offers;\n            break;\n          }\n        }\n      }\n\n      if (!foundOffer) {\n        return { success: false, message: 'Offer not found' };\n      }\n\n      if (action === 'decline') {\n        foundOffer.status = 'declined';\n        foundOffer.responded_at = new Date().toISOString();\n        localStorage.setItem(foundOrderKey, JSON.stringify(allOffers));\n        return { success: true, data: foundOffer };\n      }\n\n      foundOffer.status = 'accepted';\n      foundOffer.responded_at = new Date().toISOString();\n      \n      allOffers.forEach((o: any) => {\n        if (o.id !== offerId && (o.status === 'pending' || o.status === 'counter_offered')) {\n          o.status = 'cancelled';\n        }\n      });\n      localStorage.setItem(foundOrderKey, JSON.stringify(allOffers));\n\n      const ordersStored = localStorage.getItem('biker_local_orders_v2');\n      if (ordersStored) {\n        const orders = JSON.parse(ordersStored);\n        const orderIndex = orders.findIndex((o: any) => o.id === foundOffer.order_id);\n        if (orderIndex !== -1) {\n          const order = orders[orderIndex];\n          const counterAmount = Number(foundOffer.counter_offer_amount || foundOffer.estimated_rider_payout || 0);\n          const serviceFee = Number(order.service_fee || 0);\n          const protectionFee = Number(order.protection_fee || 0);\n          const purchaseAmount = Number(order.purchase_amount || 0);\n          const newTotal = counterAmount + serviceFee + protectionFee + purchaseAmount;\n          \n          orders[orderIndex] = {\n            ...order,\n            assigned_rider_id: foundOffer.rider_id,\n            status: 'rider_assigned',\n            rider_payout: counterAmount,\n            delivery_fee: counterAmount,\n            total_amount: newTotal,\n            accepted_at: new Date().toISOString(),\n            rider: {\n              full_name: 'Mock Rider',\n              avatar_url: '',\n              phone: '+263 77 123 4567'\n            }\n          };\n          localStorage.setItem('biker_local_orders_v2', JSON.stringify(orders));\n        }\n      }\n\n      return { success: true, data: foundOffer };\n    }\n    return { success: false, message: 'Window undefined' };\n  }\n\n  const { respondToCounterOffer: dbRespondToCounterOffer } = await import('@/lib/database');\n  const { data, error } = await dbRespondToCounterOffer(offerId, action);\n  return { success: !error, error, data };\n}\n\n/**\n * Get rolling today/week/month earnings metrics, trust scores, and tier status\n */\nexport async function getRiderDashboardStats(riderId: string) {\n  if (IS_DEV) {\n    const sub = await getRiderSubscription(riderId);\n    const logs = getMockEarningsLogs().filter(l => l.rider_id === riderId);\n    \n    const now = new Date();\n    const startToday = new Date(now);\n    startToday.setHours(0, 0, 0, 0);\n    const startWeek = new Date(now);\n    startWeek.setDate(now.getDate() - 7);\n    startWeek.setHours(0, 0, 0, 0);\n    const startMonth = new Date(now);\n    startMonth.setDate(now.getDate() - 30);\n    startMonth.setHours(0, 0, 0, 0);\n\n    const todayEarnings = logs\n      .filter(l => l.type === 'delivery' && new Date(l.created_at) >= startToday)\n      .reduce((sum, l) => sum + Number(l.amount), 0);\n      \n    const weekEarnings = logs\n      .filter(l => l.type === 'delivery' && new Date(l.created_at) >= startWeek)\n      .reduce((sum, l) => sum + Number(l.amount), 0);\n\n    const monthEarnings = logs\n      .filter(l => l.type === 'delivery' && new Date(l.created_at) >= startMonth)\n      .reduce((sum, l) => sum + Number(l.amount), 0);\n\n    const completedToday = logs\n      .filter(l => l.type === 'delivery' && new Date(l.created_at) >= startToday)\n      .length;\n\n    const safetyQuizCompleted = typeof window !== 'undefined' \n      ? localStorage.getItem(`safety_quiz_completed_${riderId}`) === 'true'\n      : false;\n\n    const isOnline = typeof window !== 'undefined'\n      ? localStorage.getItem(`rider_online_${riderId}`) === 'true'\n      : false;\n\n    const trustScore = 95;\n    const tier = sub?.region_tier === 'zimbabwe' ? 'starter' : 'pro';\n\n    return {\n      isOnline,\n      safetyQuizCompleted,\n      todayEarnings,\n      weekEarnings,\n      monthEarnings,\n      completedToday,\n      rating: 4.8,\n      trustScore,\n      tier,\n      subscription: sub ? {\n        status: sub.status,\n        expiresAt: sub.subscription_expires_at,\n        currentEarnings: sub.current_earnings,\n        earningCap: sub.earning_cap\n      } : null\n    };\n  }\n\n  const { getRiderDashboardStats: dbGetRiderDashboardStats } = await import('@/lib/database');\n  return dbGetRiderDashboardStats(riderId);\n}\n\n/**\n * Toggle online status for a rider\n */\nexport async function updateRiderOnlineStatus(riderId: string, isAvailable: boolean) {\n  if (IS_DEV) {\n    if (typeof window !== 'undefined') {\n      localStorage.setItem(`rider_online_${riderId}`, isAvailable ? 'true' : 'false');\n    }\n    return { success: true };\n  }\n  const supabase = createClient();\n  const { data, error } = await supabase\n    .from('rider_profiles')\n    .update({ is_available: isAvailable })\n    .eq('user_id', riderId)\n    .select()\n    .single();\n  return { success: !error, error, data };\n}\n