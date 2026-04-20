'use client';

import { useState, useEffect } from 'react';
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

  // Simulate new jobs appearing
  useEffect(() => {
    const timer = setInterval(() => {
      // Pulse animation for freshness
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleAcceptJob = (jobId: string) => {
    setAccepting(jobId);
    setTimeout(() => {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setAccepting(null);
    }, 1500);
  };

  return (
    <div className={styles.page}>
      {/* Online Toggle */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Available Jobs</h1>
          <p className={styles.subtitle}>{jobs.length} jobs near you</p>
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
    </div>
  );
}
