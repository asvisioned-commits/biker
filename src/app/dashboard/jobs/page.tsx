'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRiderSubscription, requestEmergencyCredit, RiderSubscription } from '../earnings/actions';
import styles from './jobs.module.css';
import { useProfile } from '@/context/ProfileContext';
import { createClient } from '@/lib/supabase/client';
import { FLAGS } from '@/lib/flags';
import { toggleRiderOnline } from '@/lib/database';

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
    payment_method: 'cash',
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
  const { session, loading: profileLoading } = useProfile();
  const userId = session?.user_id;

  const [jobs, setJobs] = useState<any[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [sub, setSub] = useState<RiderSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglePending, setTogglePending] = useState(false);
  const [cashBalance, setCashBalance] = useState<number>(15.00);
  const cashLimit = 50.00;
  
  // Guard Modal State
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const formatOrderTime = (timeStr: string) => {
    if (!timeStr) return 'Just now';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const mapDbJobToUi = (dbJob: any) => {
    const payout = dbJob.payout ?? Number(dbJob.rider_payout || dbJob.delivery_fee * 0.8 || 0);
    const distance = dbJob.distance ?? (dbJob.estimated_distance_km ? `${dbJob.estimated_distance_km} km` : 'N/A');
    const estimated_time = dbJob.estimated_time ?? (dbJob.estimated_duration_minutes ? `${dbJob.estimated_duration_minutes} min` : 'N/A');
    const customer_name = dbJob.customer_name ?? (dbJob.customer?.full_name || 'Guest');
    const customer_rating = dbJob.customer_rating ?? 5.0;
    const posted = dbJob.posted ?? formatOrderTime(dbJob.created_at);

    return {
      ...dbJob,
      payout,
      distance,
      estimated_time,
      customer_name,
      customer_rating,
      posted,
    };
  };

  const fetchStatus = async () => {
    const riderId = userId || 'mock-rider';
    try {
      const activeSub = await getRiderSubscription(riderId);
      setSub(activeSub);
      
      if (FLAGS.useLiveDb && userId) {
        const supabase = createClient();
        const [profileRes, ledgerRes] = await Promise.all([
          supabase.from('rider_profiles').select('is_available').eq('user_id', userId).single(),
          supabase.from('rider_cash_ledger').select('amount').eq('rider_id', userId).eq('status', 'outstanding')
        ]);
        
        if (profileRes.data) {
          setIsOnline(profileRes.data.is_available);
        }
        if (ledgerRes.data) {
          const sum = ledgerRes.data.reduce((acc, row) => acc + Number(row.amount), 0);
          setCashBalance(sum);
        }
      } else {
        setIsOnline(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    if (!FLAGS.useLiveDb) {
      setJobs(MOCK_JOBS.map(mapDbJobToUi));
      return;
    }
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          customer:profiles!delivery_requests_customer_id_fkey(full_name, avatar_url)
        `)
        .is('assigned_rider_id', null)
        .eq('status', 'payment_held')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setJobs((data || []).map(mapDbJobToUi));
    } catch (err) {
      console.error('Failed to fetch available jobs:', err);
      if (FLAGS.enableMockFallback) {
        setJobs(MOCK_JOBS.map(mapDbJobToUi));
      } else {
        setJobs([]);
      }
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    fetchStatus();
    fetchJobs();
  }, [profileLoading, userId]);

  useEffect(() => {
    if (profileLoading || !userId || !FLAGS.useLiveDb) return;

    const supabase = createClient();
    const channel = supabase
      .channel('available_jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_requests',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'payment_held' && !payload.new.assigned_rider_id) {
            const { data } = await supabase
              .from('delivery_requests')
              .select('*, customer:profiles!delivery_requests_customer_id_fkey(full_name, avatar_url)')
              .eq('id', payload.new.id)
              .single();
            if (data) {
              setJobs((prev) => {
                if (prev.some((j) => j.id === data.id)) return prev;
                return [mapDbJobToUi(data), ...prev];
              });
            }
          }
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            if (updated.assigned_rider_id || updated.status !== 'payment_held') {
              setJobs((prev) => prev.filter((j) => j.id !== updated.id));
            } else {
              const { data } = await supabase
                .from('delivery_requests')
                .select('*, customer:profiles!delivery_requests_customer_id_fkey(full_name, avatar_url)')
                .eq('id', updated.id)
                .single();
              if (data) {
                setJobs((prev) => prev.map((j) => (j.id === data.id ? mapDbJobToUi(data) : j)));
              }
            }
          }
          if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((j) => j.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileLoading, userId]);

  const handleToggleOnline = async () => {
    if (togglePending) return;
    const targetStatus = !isOnline;
    setIsOnline(targetStatus);
    setTogglePending(true);
    
    if (FLAGS.useLiveDb && userId) {
      try {
        const { error } = await toggleRiderOnline(userId, targetStatus);
        if (error) throw error;
      } catch (err) {
        console.error(err);
        setIsOnline(!targetStatus);
        alert('Failed to update status. Please try again.');
      } finally {
        setTogglePending(false);
      }
    } else {
      setTogglePending(false);
    }
  };

  const handleAcceptJob = (jobId: string) => {
    if (!sub) return;

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

  const proceedAcceptJob = async (jobId: string) => {
    setAccepting(jobId);
    
    if (!FLAGS.useLiveDb) {
      setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        setAccepting(null);
        alert('Job Accepted! Navigating to navigation dispatcher...');
      }, 1200);
      return;
    }

    const riderId = userId || 'mock-rider';
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('delivery_requests')
        .update({
          assigned_rider_id: riderId,
          status: 'rider_assigned',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .is('assigned_rider_id', null)
        .eq('status', 'payment_held')
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('This job was just accepted by another rider.');
        fetchJobs();
        return;
      }

      alert('Job Accepted! Navigating to active orders...');
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error('Failed to accept job:', err);
      alert('Failed to accept job. Please try again.');
    } finally {
      setAccepting(null);
    }
  };

  const handleActivateEmergencyCredit = async () => {
    if (!pendingJobId) return;
    setLoading(true);
    const riderId = userId || 'mock-rider';
    const res = await requestEmergencyCredit(riderId);
    alert(res.message);
    if (res.success) {
      await fetchStatus();
      setShowGuardModal(false);
      proceedAcceptJob(pendingJobId);
    }
    setLoading(false);
  };

  if (profileLoading || loading) {
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
              onClick={handleToggleOnline}
              disabled={togglePending}
              style={{ cursor: togglePending ? 'not-allowed' : 'pointer', opacity: togglePending ? 0.7 : 1 }}
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

                  {/* COD Badge */}
                  {job.payment_method === 'cash' && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08))',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '9999px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#34d399',
                      marginBottom: '0.75rem',
                      boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)'
                    }}>
                      <span>💵</span> Cash on Delivery — Collect ${(job.total_amount || (job.payout / 0.8)).toFixed(2)}
                    </div>
                  )}

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

                  {/* Accept / Float Check */}
                  {job.payment_method === 'cash' && (cashBalance + (job.total_amount || (job.payout / 0.8)) > cashLimit) ? (
                    <div style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '0.75rem',
                      padding: '0.75rem 0.875rem',
                      marginTop: '0.75rem',
                      fontSize: '0.8125rem',
                      color: '#f87171',
                      lineHeight: '1.4',
                      textAlign: 'left'
                    }}>
                      ⚠️ <strong>Cash Collection Limit Warning</strong>
                      <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                        You are near your cash collection limit (${cashBalance.toFixed(2)}/${cashLimit.toFixed(2)}). 
                        Please remit collected cash to platform operations before accepting more COD orders.
                      </p>
                    </div>
                  ) : (
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
                  )}
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
