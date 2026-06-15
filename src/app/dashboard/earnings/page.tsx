'use client';

import { useState, useEffect } from 'react';
import {
  getRiderSubscription,
  subscribeOrRenew,
  requestEmergencyCredit,
  getEarningsLedger,
  getRiderAuditLogs,
  RiderSubscription,
  EarningsLogEntry,
  StatusAuditEntry
} from './actions';
import styles from './earnings.module.css';
import { useProfile } from '@/context/ProfileContext';

export default function EarningsPage() {
  const { session, loading: profileLoading } = useProfile();
  const userId = session?.user_id;

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<RiderSubscription | null>(null);
  const [ledger, setLedger] = useState<EarningsLogEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<StatusAuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'policy'>('overview');
  
  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTier, setPayTier] = useState<'zimbabwe' | 'standard'>('zimbabwe');
  const [payMethod, setPayMethod] = useState<'stripe' | 'ecocash' | 'innbucks'>('ecocash');
  const [refNum, setRefNum] = useState('');
  const [proofSent, setProofSent] = useState(false);

  // Load state
  const loadData = async () => {
    if (profileLoading || !userId) return;
    setLoading(true);
    try {
      const activeSub = await getRiderSubscription(userId);
      const activeLedger = await getEarningsLedger(userId);
      const activeAudits = await getRiderAuditLogs(userId);
      setSub(activeSub);
      setLedger(activeLedger);
      setAuditLogs(activeAudits);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && userId) {
      loadData();
    }
  }, [profileLoading, userId]);

  const handleRequestCredit = async () => {
    if (!sub || !userId) return;
    const res = await requestEmergencyCredit(userId);
    alert(res.message);
    if (res.success) {
      loadData();
    }
  };

  const handleRenewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sub || !userId) return;
    
    const res = await subscribeOrRenew(
      userId,
      session?.full_name || 'Takudzwa M. (Zimbabwe Rider)',
      payTier,
      payMethod === 'stripe' ? 'stripe' : payMethod,
      refNum,
      'https://via.placeholder.com/300x500?text=Mock+MobileMoney+Screenshot'
    );

    if (res.success) {
      if (res.status === 'pending_approval') {
        setProofSent(true);
      } else {
        alert(res.message);
        setShowPayModal(false);
        setRefNum('');
        loadData();
      }
    } else {
      alert(`Renewal failed: ${res.message}`);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Syncing wallet logs with platform ledger...</p>
      </div>
    );
  }

  if (!userId || !sub) {
    return (
      <div className={styles.loadingContainer}>
        <p>Please log in to view wallet details.</p>
      </div>
    );
  }

  // Calculate percentages for SVG Credit Rings
  const baseCap = sub.earning_cap;
  const currentEarnings = sub.current_earnings;
  const debt = Number(sub.emergency_credit_used);
  
  // Cap is extended by $30.00 earning limit if emergency credit buffer is active
  const totalEarningCap = baseCap + (debt > 0 ? 30.00 : 0.00);
  const remainingLimit = Math.max(0, totalEarningCap - currentEarnings);
  const percentOfCap = Math.min(100, (currentEarnings / totalEarningCap) * 100);

  // Shifting color definitions
  let statusColor = styles.statusActive;
  let ringColor = 'var(--color-primary-500)';
  if (sub.status === 'grace_period') {
    statusColor = styles.statusGrace;
    ringColor = 'var(--color-warning-500)';
  } else if (sub.status === 'suspended') {
    statusColor = styles.statusSuspended;
    ringColor = 'var(--color-danger-500)';
  } else if (sub.status === 'closed') {
    statusColor = styles.statusClosed;
    ringColor = 'var(--color-neutral-800)';
  }

  // Circ calculation for SVG Progress Rings
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentOfCap / 100) * circumference;

  return (
    <div className={styles.page}>
      {/* Header Info */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Wallet & Billing Hub</h1>
          <p className={styles.subtitle}>
            Platform credits, mobile subscription, and emergency balances.
          </p>
        </div>
        <div className={styles.statusPillContainer}>
          <div className={`${styles.statusPill} ${statusColor}`}>
            <span className={styles.dot} />
            {sub.status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Primary Grid Layout */}
      <div className={styles.mainGrid}>
        
        {/* Left Side: Credit Rings & Stats */}
        <div className={styles.statsColumn}>
          
          {/* Circular SVG Credit Ring */}
          <div className={styles.ringCard}>
            <div className={styles.ringWrapper}>
              <svg className={styles.svgRing} width="168" height="168">
                {/* Background Ring */}
                <circle
                  className={styles.ringTrack}
                  cx="84"
                  cy="84"
                  r={radius}
                  strokeWidth="10"
                />
                {/* Inner Earning Progress */}
                <circle
                  className={styles.ringProgress}
                  cx="84"
                  cy="84"
                  r={radius}
                  strokeWidth="10"
                  stroke={ringColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 84 84)"
                />
              </svg>
              <div className={styles.ringInnerContent}>
                <div className={styles.ringPercentLabel}>Earnings Progress</div>
                <div className={styles.ringCapValue}>${currentEarnings.toFixed(2)}</div>
                <div className={styles.ringLimitDivider}>of ${totalEarningCap.toFixed(2)} limit</div>
              </div>
            </div>

            <div className={styles.ringInfoList}>
              <div className={styles.ringInfoRow}>
                <span>Current Earning Period:</span>
                <strong>{sub.region_tier === 'zimbabwe' ? 'Zimbabwe Tier' : 'Standard Tier'}</strong>
              </div>
              <div className={styles.ringInfoRow}>
                <span>Remaining Limit:</span>
                <strong style={{ color: ringColor }}>${remainingLimit.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Cap Lockout Safety Meter */}
          <div className={styles.lockMeterCard}>
            <div className={styles.lockMeterHeader}>
              <span>Access Status</span>
              <span className={`${styles.lockBadge} ${
                sub.status === 'active' ? styles.lockBadgeUnlocked :
                sub.status === 'grace_period' ? styles.lockBadgeWarning :
                styles.lockBadgeLocked
              }`}>
                {sub.status === 'active' ? '🔓 UNLOCKED' : sub.status === 'grace_period' ? '⏳ GRACE ACTIVE' : '🔒 LOCKED'}
              </span>
            </div>
            <p className={styles.lockMeterText}>
              {sub.status === 'active' 
                ? `You have earned $${currentEarnings.toFixed(2)} out of your $${baseCap.toFixed(2)} cap. You can accept jobs freely.`
                : sub.status === 'grace_period'
                ? `Earning cap exceeded. Access will lock in less than 72 hours.`
                : `Earnings cap exceeded and grace period expired. Job acceptance is locked.`
              }
            </p>
            <div className={styles.safetyMeterTrack}>
              <div 
                className={styles.safetyMeterFill} 
                style={{ 
                  width: `${percentOfCap}%`,
                  backgroundColor: sub.status === 'active' ? 'var(--color-success-500)' : 'var(--color-danger-500)'
                }} 
              />
            </div>
            <div className={styles.lockEstimateRow}>
              <span>Estimated deliveries remaining:</span>
              <strong>{sub.status === 'active' ? Math.ceil(remainingLimit / 4.50) : 0} jobs</strong>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Mobile Money Subscription</div>
              <div className={styles.metricValue}>${sub.region_tier === 'zimbabwe' ? '5.00' : '10.00'}</div>
              <div className={styles.metricFooter}>to earn up to ${sub.region_tier === 'zimbabwe' ? '60.00' : '90.00'}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Credit Advance Debt</div>
              <div className={styles.metricValue} style={{ color: debt > 0 ? 'var(--color-danger-500)' : 'inherit' }}>
                -${debt.toFixed(2)}
              </div>
              <div className={styles.metricFooter}>Repaid on renewal</div>
            </div>
          </div>

        </div>

        {/* Right Side: Billing State Controller & Reminders */}
        <div className={styles.controlsColumn}>
          
          {/* State Specific Alert Banners */}
          {sub.status === 'grace_period' && (
            <div className={`${styles.alertBox} ${styles.alertWarning}`}>
              <div className={styles.alertHeader}>⚠️ 72-Hour Grace Period Active</div>
              <p className={styles.alertText}>
                You have reached your platform earning limit of <strong>${baseCap.toFixed(2)}</strong>. You must top-up/subscribe again or request an emergency credit advance to avoid account suspension.
              </p>
              {sub.grace_period_ends_at && (
                <div className={styles.alertTimer}>
                  Grace expires: {new Date(sub.grace_period_ends_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {sub.status === 'suspended' && (
            <div className={`${styles.alertBox} ${styles.alertDanger}`}>
              <div className={styles.alertHeader}>❌ Account Suspended</div>
              <p className={styles.alertText}>
                Your delivery features have been disabled. This happens when you exceed your earning cap plus the emergency credit limit. Renew your subscription immediately to resume jobs.
              </p>
            </div>
          )}

          {sub.status === 'closed' && (
            <div className={`${styles.alertBox} ${styles.alertDark}`}>
              <div className={styles.alertHeader}>⚠️ Account Closed Permanently</div>
              <p className={styles.alertText}>
                This account is closed due to unpaid emergency balances beyond 30 days. Please contact operations support to reactivate.
              </p>
            </div>
          )}

          {debt > 0 && sub.status === 'active' && (
            <div className={`${styles.alertBox} ${styles.alertInfo}`}>
              <div className={styles.alertHeader}>ℹ️ Emergency Credit Buffer Active</div>
              <p className={styles.alertText}>
                You requested a <strong>$2.50 emergency credit</strong>. This debt will be automatically deducted from your next subscription renewal. Your current cap is extended to <strong>${totalEarningCap.toFixed(2)}</strong>.
              </p>
            </div>
          )}

          {/* Wallet Actions card */}
          <div className={styles.actionsCard}>
            <h3 className={styles.cardTitle}>Platform Access Billing</h3>
            <p className={styles.cardDesc}>
              Biker drivers pay platform subscription fees to enable delivery requests. Choose standard or ZWL/USD mobile money plans.
            </p>
            
            <div className={styles.actionButtons}>
              <button 
                onClick={() => {
                  setPayTier(sub.region_tier);
                  setShowPayModal(true);
                  setProofSent(false);
                }} 
                disabled={sub.status === 'closed'}
                className="btn btn--primary"
              >
                {sub.status === 'suspended' ? 'Pay & Reactivate Account' : 'Renew Subscription Plan'}
              </button>

              <button
                onClick={handleRequestCredit}
                disabled={debt > 0 || (sub.status !== 'grace_period' && sub.status !== 'suspended' && currentEarnings < baseCap)}
                className="btn btn--secondary"
              >
                Request $2.50 Credit Advance
              </button>
            </div>
          </div>

          {/* Regional Plan Details */}
          <div className={styles.planCard}>
            <div className={styles.planRow}>
              <div>
                <strong>Zimbabwe Regional Plan (Harare/Zim)</strong>
                <p>Designed for local mobile money (EcoCash, InnBucks).</p>
              </div>
              <div className={styles.priceTag}>$5.00</div>
            </div>
            <div className={styles.planFeatureList}>
              <span>• Earn up to $60.00 per cycle</span>
              <span>• $2.50 emergency grace line</span>
              <span>• Manual screenshot proof confirmation</span>
            </div>
          </div>

        </div>

      </div>

      {/* Tabs Section for Logs and Rules */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabsList}>
          <button 
            className={`${styles.tabLink} ${activeTab === 'overview' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Recent Ledger Transactions
          </button>
          <button 
            className={`${styles.tabLink} ${activeTab === 'ledger' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            Audit Log History
          </button>
          <button 
            className={`${styles.tabLink} ${activeTab === 'policy' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('policy')}
          >
            Suspension Policies
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.ledgerList}>
              {ledger.length === 0 ? (
                <p className={styles.noData}>No transaction logs registered in ledger yet.</p>
              ) : (
                ledger.map((tx) => (
                  <div key={tx.id} className={styles.ledgerRow}>
                    <div className={styles.ledgerLeft}>
                      <span className={styles.ledgerTypeIcon}>
                        {tx.type === 'delivery' ? '📦' : tx.type === 'subscription_renewal' ? '💳' : '🛡️'}
                      </span>
                      <div>
                        <strong>{tx.type === 'delivery' ? `Delivery Earning (Order #${tx.order_id?.slice(-6) || 'Simulated'})` : tx.type === 'subscription_renewal' ? 'Plan Deposit / Subscription' : 'Emergency credit buffer'}</strong>
                        <span className={styles.ledgerDate}>{new Date(tx.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div className={`${styles.ledgerAmount} ${tx.amount < 0 ? styles.amountNeg : styles.amountPos}`}>
                      {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className={styles.auditList}>
              <p className={styles.auditIntro}>Rider compliance logs maintained by platform audit controls:</p>
              <div className={styles.ledgerList}>
                {auditLogs.length === 0 ? (
                  <p className={styles.noData}>No compliance actions logged for this rider.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className={styles.ledgerRow}>
                      <div className={styles.ledgerLeft}>
                        <span className={styles.ledgerTypeIcon}>🛡️</span>
                        <div>
                          <strong>Status Change: {log.from_status.toUpperCase()} ➔ {log.to_status.toUpperCase()}</strong>
                          <p className={styles.auditReason}>{log.reason}</p>
                          <span className={styles.ledgerDate}>Trigger: {log.trigger} · {new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'policy' && (
            <div className={styles.policyCard}>
              <h3>Platform Suspension & Termination Rules</h3>
              <div className={styles.policyGrid}>
                <div className={styles.policyItem}>
                  <h4>1. Subscriptions</h4>
                  <p>Subscriptions require a deposit. Standard is $10 to earn up to $90; Zimbabwe is $5 to make up to $60.</p>
                </div>
                <div className={styles.policyItem}>
                  <h4>2. Cap Reached</h4>
                  <p>Once the earnings limit is hit, drivers can finish their current delivery but cannot accept new jobs.</p>
                </div>
                <div className={styles.policyItem}>
                  <h4>3. Emergency Credit</h4>
                  <p>A $2.50 advance buffer allows continuation. This debt is auto-collected on your next renewal payment.</p>
                </div>
                <div className={styles.policyItem}>
                  <h4>4. Auto Suspension</h4>
                  <p>Failure to settle balances within 72 hours of cap limit, or exceeding the emergency cap, results in immediate suspension.</p>
                </div>
                <div className={styles.policyItem}>
                  <h4>5. Permanent Closure</h4>
                  <p>Accounts remaining suspended or with outstanding credits for more than 30 days are permanently terminated.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscription / Renewal Modal */}
      {showPayModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Renew Rider Subscription Plan</h2>
              <button onClick={() => setShowPayModal(false)} className={styles.modalClose}>×</button>
            </div>

            {proofSent ? (
              <div className={styles.successProof}>
                <div className={styles.successIcon}>✓</div>
                <h3>Proof Submitted Successfully!</h3>
                <p>
                  EcoCash/InnBucks transaction screenshot sent to the platform moderation queue. An admin will review and reactivate your account shortly.
                </p>
                <div className={styles.proofActions}>
                  <button 
                    onClick={() => {
                      setShowPayModal(false);
                      loadData();
                    }} 
                    className="btn btn--primary"
                  >
                    Go back to Wallet
                  </button>
                  <a href="/dashboard/admin/billing" className="btn btn--secondary">
                    Open Admin Verification Queue (Moderator View)
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRenewPayment} className={styles.paymentForm}>
                
                {/* Select Region Tier */}
                <div className={styles.formGroup}>
                  <label>Select Subscription Region Tier:</label>
                  <div className={styles.planSelectorPills}>
                    <button
                      type="button"
                      className={`${styles.planPill} ${payTier === 'zimbabwe' ? styles.planPillActive : ''}`}
                      onClick={() => setPayTier('zimbabwe')}
                    >
                      <strong>Zimbabwe Plan</strong>
                      <span>$5.00 fee to earn $60.00</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.planPill} ${payTier === 'standard' ? styles.planPillActive : ''}`}
                      onClick={() => setPayTier('standard')}
                    >
                      <strong>Standard Plan</strong>
                      <span>$10.00 fee to earn $90.00</span>
                    </button>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className={styles.modalBillSummary}>
                  <div className={styles.billLine}>
                    <span>Subscription Fee:</span>
                    <span>${payTier === 'zimbabwe' ? '5.00' : '10.00'}</span>
                  </div>
                  {debt > 0 && (
                    <div className={styles.billLine} style={{ color: 'var(--color-danger-500)' }}>
                      <span>Outstanding Credit Repayment:</span>
                      <span>+${debt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={styles.billTotal}>
                    <span>Total Amount Payable:</span>
                    <span>${(payTier === 'zimbabwe' ? 5.00 + debt : 10.00 + debt).toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className={styles.formGroup}>
                  <label>Select Payment Method:</label>
                  <div className={styles.planSelectorPills}>
                    {payTier === 'zimbabwe' && (
                      <>
                        <button
                          type="button"
                          className={`${styles.planPill} ${payMethod === 'ecocash' ? styles.planPillActive : ''}`}
                          onClick={() => setPayMethod('ecocash')}
                        >
                          💸 EcoCash
                        </button>
                        <button
                          type="button"
                          className={`${styles.planPill} ${payMethod === 'innbucks' ? styles.planPillActive : ''}`}
                          onClick={() => setPayMethod('innbucks')}
                        >
                          🏦 InnBucks
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={`${styles.planPill} ${payMethod === 'stripe' ? styles.planPillActive : ''}`}
                      onClick={() => setPayMethod('stripe')}
                    >
                      💳 Credit Card (Stripe)
                    </button>
                  </div>
                </div>

                {/* Dynamic Payment Details */}
                {payMethod !== 'stripe' ? (
                  <div className={styles.manualPaymentDetails}>
                    <p className={styles.instructionText}>
                      Please send <strong>${(payTier === 'zimbabwe' ? 5.00 + debt : 10.00 + debt).toFixed(2)}</strong> to our official merchant account:
                    </p>
                    <div className={styles.merchantBox}>
                      {payMethod === 'ecocash' ? (
                        <>
                          <strong>EcoCash Merchant Code:</strong>
                          <code>*151*2*2*184920#</code> (Biker Ltd)
                        </>
                      ) : (
                        <>
                          <strong>InnBucks Account Number:</strong>
                          <code>0781294829</code> (Biker Operations)
                        </>
                      )}
                    </div>

                    <div className={styles.formInputGroup}>
                      <label>EcoCash/InnBucks Reference Number:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. PP260520.1245.G8492"
                        value={refNum}
                        onChange={(e) => setRefNum(e.target.value)}
                        className={styles.modalInput}
                      />
                    </div>

                    <div className={styles.screenshotSimulation}>
                      <span>📸 Simulation: Mobile Screenshot Proof Auto-Generated</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.stripePlaceholder}>
                    <span>🔒 Stripe Credit Card Payment Element Loaded</span>
                    <p>Card number: •••• •••• •••• 4242 (Simulator Mode)</p>
                  </div>
                )}

                <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: 'var(--space-4)' }}>
                  {payMethod === 'stripe' ? 'Confirm Stripe Payment' : 'Submit Screenshot & Reference Proof'}
                </button>

              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
