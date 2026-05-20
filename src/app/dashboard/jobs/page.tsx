'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRiderSubscription, requestEmergencyCredit, RiderSubscription } from '../earnings/actions';
import styles from './jobs.module.css';

const MOCK_JOBS = [
  {
    id: '1',
    reference_code: 'BKR-N3V8P2',
    service_type: 'send_item',
    pickup_address: 'Sam Levy\'s Village, Borrowdale',
    dropoff_address: 'Avondale Shops, 2nd Ave',
    distance: '4.2 km',
    estimated_time: '15 min',
    payout: 3.50,
    protection_level: 'protected',
    item_description: 'Small parcel — medications',
    fulfillment_mode: 'standard',
    posted: '2 min ago',
    customer_name: 'Sarah M.',
    customer_rating: 4.8,
  },
  {
    id: '2',
    reference_code: 'BKR-K7T1R9',
    service_type: 'buy_for_me',
    pickup_address: 'OK Supermarket CBD',
    dropoff_address: 'Mount Pleasant, Pomona',
    distance: '8.1 km',
    estimated_time: '25 min',
    payout: 6.80,
    protection_level: 'protected',
    item_description: '6 items — grocery run',
    fulfillment_mode: 'jet',
    posted: '30 sec ago',
    customer_name: 'John K.',
    customer_rating: 4.5,
  },
  {
    id: '3',
    reference_code: 'BKR-W2D5L8',
    service_type: 'document_run',
    pickup_address: 'Zimra Kurima House',
    dropoff_address: 'Eastlea, Natal Road',
    distance: '3.7 km',
    estimated_time: '12 min',
    payout: 5.00,
    protection_level: 'premium_secure',
    item_description: 'Tax compliance certificate collection',
    fulfillment_mode: 'standard',
    posted: '5 min ago',
    customer_name: 'Agnes T.',
    customer_rating: 5.0,
  },
  {
    id: '4',
    reference_code: 'BKR-A9F3M6',
    service_type: 'pickup_order',
    pickup_address: 'Chicken Inn Avondale',
    dropoff_address: 'Belvedere, 14 Baines Ave',
    distance: '2.9 km',
    estimated_time: '10 min',
    payout: 2.50,
    protection_level: 'none',
    item_description: 'Food pickup — 2x Chicken meals',
    fulfillment_mode: 'standard',
    posted: '8 min ago',
    customer_name: 'Mike D.',
    customer_rating: 4.2,
  },
];

const SERVICE_ICONS: Record<string, string> = {
  send_item: '📦',
  buy_for_me: '🛒',
  pickup_order: '🏪',
  document_run: '📄',
  queue_service: '⏳',
  multi_stop: '📍',
};

const SERVICE_LABELS: Record<string, string> = {
  send_item: 'Send Item',
  buy_for_me: 'Buy For Me',
  pickup_order: 'Pick Up Order',
  document_run: 'Document Run',
  queue_service: 'Queue Service',
  multi_stop: 'Multi-Stop',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [sub, setSub] = useState<RiderSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Guard Modal State
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const activeSub = await getRiderSubscription('mock-rider');
      setSub(activeSub);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleAcceptJob = (jobId: string) => {
    if (!sub) return;

    // Check subscription status before accepting
    if (sub.status === 'suspended' || sub.status === 'closed') {
      alert('Your account is currently suspended/closed. Please renew your subscription to accept jobs.');
      return;
    }

    if (sub.status === 'grace_period' || (sub.current_earnings >= sub.earning_cap && sub.emergency_credit_used === 0)) {
      setPendingJobId(jobId);
      setShowGuardModal(true);
      return;
    }

    proceedAcceptJob(jobId);
  };

  const proceedAcceptJob = (jobId: string) => {
    setAccepting(jobId);
    setTimeout(() => {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setAccepting(null);
      alert('Job Accepted! Navigating to navigation dispatcher...');
    }, 1200);
  };

  const handleActivateEmergencyCredit = async () => {
    if (!pendingJobId) return;
    setLoading(true);
    const res = await requestEmergencyCredit('mock-rider');
    alert(res.message);
    if (res.success) {
      // Reload sub details
      await fetchStatus();
      setShowGuardModal(false);
      proceedAcceptJob(pendingJobId);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Verifying rider credentials and billing status...</p>
      </div>
    );
  }

  const isSuspended = sub?.status === 'suspended' || sub?.status === 'closed';
  const isGrace = sub?.status === 'grace_period';
  const isNearCap = sub && sub.status === 'active' && sub.current_earnings >= (sub.earning_cap * 0.9);

  const baseCap = sub?.earning_cap || 0;
  const currentEarnings = sub?.current_earnings || 0;
  const debt = sub ? Number(sub.emergency_credit_used) : 0;
  const totalEarningCap = baseCap + (debt > 0 ? 30.00 : 0.00);
  const remainingLimit = Math.max(0, totalEarningCap - currentEarnings);
  const estJobsLeft = Math.ceil(remainingLimit / 4.50);

  return (
    <div className={styles.page}>
      
      {/* Block Acceptance Screen if Suspended/Closed */}
      {isSuspended ? (
        <div className={styles.suspendedScreen}>
          <div className={styles.suspendedIcon}>⚠️</div>
          <h2>Account Access Paused</h2>
          <p>
            You have reached your earnings limit of <strong>${sub?.earning_cap.toFixed(2)}</strong> under your current plan. Because emergency buffers are fully exhausted, your account has been suspended.
          </p>
          <div className={styles.suspendedNote}>
            To start accepting deliveries again, please renew your platform subscription.
          </div>
          <Link href="/dashboard/earnings" className="btn btn--primary btn--lg">
            Go to Wallet & Renew Plan
          </Link>
        </div>
      ) : (
        <>
          {/* Top Banner Warnings */}
          {isGrace && (
            <div className={`${styles.topBanner} ${styles.bannerGrace}`}>
              <span>⚠️</span>
              <div>
                <strong>Earnings Cap Reached (Grace Period)</strong>
                <p>You must renew your plan or request emergency credit to avoid account suspension.</p>
              </div>
              <Link href="/dashboard/earnings" className={styles.bannerLink}>
                Renew Plan ➔
              </Link>
            </div>
          )}

          {isNearCap && (
            <div className={`${styles.topBanner} ${styles.bannerNearCap}`}>
              <span>ℹ️</span>
              <div>
                <strong>Nearing Earning Limit</strong>
                <p>You have earned ${sub.current_earnings.toFixed(2)} of your ${sub.earning_cap.toFixed(2)} cap. Renew soon to avoid downtime.</p>
              </div>
              <Link href="/dashboard/earnings" className={styles.bannerLink}>
                Manage Subscription ➔
              </Link>
            </div>
          )}

          {/* Online Toggle */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Available Jobs</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <p className={styles.subtitle} style={{ margin: 0 }}>{jobs.length} jobs near you</p>
                {sub && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: sub.status === 'active' ? 'var(--color-success-50)' : 'var(--color-warning-50)',
                    color: sub.status === 'active' ? 'var(--color-success-700)' : 'var(--color-warning-700)',
                    border: '1px solid currentColor',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {sub.status === 'active' 
                      ? `🔓 Unlocked (~${estJobsLeft} deliveries left)`
                      : `⏳ Grace Period Active`
                    }
                  </span>
                )}
              </div>
            </div>
            <button
              className={`${styles.onlineToggle} ${isOnline ? styles.onlineToggleActive : ''}`}
              onClick={() => setIsOnline(!isOnline)}
            >
              <span className={styles.onlineDot} />
              {isOnline ? 'Online' : 'Offline'}
            </button>
          </div>

          {!isOnline && (
            <div className={styles.offlineNotice}>
              <span>🔴</span>
              <div>
                <strong>You&apos;re offline</strong>
                <p>Turn online to start receiving job offers from customers near you.</p>
              </div>
            </div>
          )}

          {isOnline && (
            <div className={styles.jobsList}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`${styles.jobCard} ${job.fulfillment_mode === 'jet' ? styles.jobCardJet : ''}`}
                >
                  {job.fulfillment_mode === 'jet' && (
                    <div className={styles.jetBadge}>⚡ JET — Priority Delivery</div>
                  )}

                  <div className={styles.jobCardHeader}>
                    <div className={styles.jobMeta}>
                      <span className={styles.jobIcon}>{SERVICE_ICONS[job.service_type]}</span>
                      <div>
                        <div className={styles.jobType}>{SERVICE_LABELS[job.service_type]}</div>
                        <div className={styles.jobRef}>{job.reference_code}</div>
                      </div>
                    </div>
                    <div className={styles.jobPayout}>
                      <span className={styles.payoutAmount}>${job.payout.toFixed(2)}</span>
                      <span className={styles.payoutLabel}>payout</span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className={styles.jobRoute}>
                    <div className={styles.routePoint}>
                      <span className={styles.routeDot} data-type="pickup" />
                      <span>{job.pickup_address}</span>
                    </div>
                    <div className={styles.routeInfo}>
                      <span className={styles.routeDist}>↕ {job.distance}</span>
                      <span className={styles.routeTime}>~{job.estimated_time}</span>
                    </div>
                    <div className={styles.routePoint}>
                      <span className={styles.routeDot} data-type="dropoff" />
                      <span>{job.dropoff_address}</span>
                    </div>
                  </div>

                  {/* Item details */}
                  <div className={styles.jobDetails}>
                    <span>📝 {job.item_description}</span>
                    {job.protection_level !== 'none' && (
                      <span className="trust-badge trust-badge--protected" style={{ fontSize: '0.65rem' }}>
                        🛡️ {job.protection_level === 'premium_secure' ? 'Protect+' : 'Protected'}
                      </span>
                    )}
                  </div>

                  {/* Customer */}
                  <div className={styles.jobCustomer}>
                    <span className={styles.customerAvatar}>{job.customer_name[0]}</span>
                    <span className={styles.customerName}>{job.customer_name}</span>
                    <span className={styles.customerRating}>⭐ {job.customer_rating}</span>
                    <span className={styles.jobTime}>{job.posted}</span>
                  </div>

                  {/* Accept */}
                  <button
                    className={`btn btn--primary btn--lg btn--full ${styles.acceptBtn}`}
                    onClick={() => handleAcceptJob(job.id)}
                    disabled={accepting === job.id}
                  >
                    {accepting === job.id ? (
                      <>
                        <span className="spinner" /> Accepting...
                      </>
                    ) : (
                      `Accept — $${job.payout.toFixed(2)}`
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Guard Lock Modal for Grace Period */}
      {showGuardModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Earning Cap Reached</h2>
              <button onClick={() => setShowGuardModal(false)} className={styles.modalClose}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalWarningIcon}>⚠️</div>
              <p>
                You have reached your subscription earnings limit of <strong>${sub?.earning_cap.toFixed(2)}</strong>. You must renew or activate emergency credit buffer to accept this job.
              </p>

              <div className={styles.modalOptionBox}>
                <div className={styles.optionLeft}>
                  <strong>$2.50 Emergency Credit</strong>
                  <p>One-time buffer. Settle this on your next subscription renewal.</p>
                </div>
                <button onClick={handleActivateEmergencyCredit} className="btn btn--secondary btn--sm">
                  Activate Credit
                </button>
              </div>

              <div className={styles.modalOptionBox}>
                <div className={styles.optionLeft}>
                  <strong>Renew Platform Subscription</strong>
                  <p>Pay $5.00 (Zim Plan) or $10.00 (Standard) to fully reset your cap.</p>
                </div>
                <Link href="/dashboard/earnings" className="btn btn--primary btn--sm">
                  Renew Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
