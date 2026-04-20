'use client';

import { useState, useEffect, Suspense } from 'react';
import styles from './tracking.module.css';

function TrackingContent() {
  const [activeTab, setActiveTab] = useState<'map' | 'info'>('map');
  const [currentStatus, setCurrentStatus] = useState(3); // simulated progress

  // Mock order data
  const order = {
    reference_code: 'BKR-7X2K9M',
    service_type: 'send_item' as const,
    fulfillment_mode: 'standard' as const,
    protection_level: 'protected' as string,
    status: 'en_route_delivery' as const,
    pickup_address: 'Sam Levy\'s Village, Borrowdale',
    dropoff_address: 'Borrowdale Brooke, 42 Churchill Ave',
    dropoff_gate_color: 'Brown gate',
    delivery_pin: '4729',
    rider: {
      name: 'Takudzwa M.',
      rating: 4.9,
      vehicle: 'Honda CG 125',
      reg: 'AEQ 7834',
      completions: 247,
      tier: 'verified',
      avatar: 'T',
    },
    pricing: {
      delivery_fee: 2.50,
      service_fee: 0.38,
      protection_fee: 0.50,
      total: 3.38,
    },
    estimated_delivery: '12 min',
    created_at: '2:15 PM',
  };

  const timeline = [
    { status: 'Order placed', time: '2:15 PM', completed: true, description: 'Order confirmed and payment secured' },
    { status: 'Rider assigned', time: '2:16 PM', completed: true, description: 'Takudzwa M. accepted your delivery' },
    { status: 'En route to pickup', time: '2:18 PM', completed: true, description: 'Rider is heading to Sam Levy\'s Village' },
    { status: 'At pickup', time: '2:25 PM', completed: currentStatus >= 4, active: currentStatus === 3, description: 'Rider arrived at pickup point' },
    { status: 'Proof uploaded', time: '', completed: currentStatus >= 5, active: currentStatus === 4, description: 'Pickup photo captured' },
    { status: 'En route to delivery', time: '', completed: currentStatus >= 6, active: currentStatus === 5, description: 'On the way to Borrowdale Brooke' },
    { status: 'Delivered', time: '', completed: currentStatus >= 7, active: currentStatus === 6, description: 'Confirmed with PIN' },
  ];

  // Simulate progress
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStatus((prev) => (prev < 7 ? prev + 1 : prev));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Order Tracking</h1>
          <span className={styles.refCode}>{order.reference_code}</span>
        </div>
        <div className={styles.headerRight}>
          {order.protection_level !== 'none' && (
            <span className="trust-badge trust-badge--protected">🛡️ Protected</span>
          )}
          <span className="badge badge--live">Live</span>
        </div>
      </div>

      {/* Tabs for mobile */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'map' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('map')}
        >
          📍 Map
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('info')}
        >
          📋 Details
        </button>
      </div>

      <div className={styles.content}>
        {/* Map Area */}
        <div className={`${styles.mapArea} ${activeTab === 'map' ? styles.mapAreaVisible : ''}`}>
          <div className={styles.mapPlaceholder}>
            <div className={styles.mapDotPickup}>📍</div>
            <div className={styles.mapDotRider}>🚴</div>
            <div className={styles.mapDotDropoff}>📍</div>
            <div className={styles.mapLabel}>
              Live map will display here with Leaflet.js
            </div>
          </div>

          {/* ETA Card */}
          <div className={styles.etaCard}>
            <div className={styles.etaIcon}>🚴</div>
            <div className={styles.etaInfo}>
              <div className={styles.etaStatus}>
                {currentStatus < 4 ? 'Heading to pickup' : currentStatus < 6 ? 'At pickup / collecting' : 'Delivering to you'}
              </div>
              <div className={styles.etaTime}>
                ETA: <strong>{order.estimated_delivery}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className={`${styles.infoPanel} ${activeTab === 'info' ? styles.infoPanelVisible : ''}`}>
          {/* Rider Card */}
          <div className={styles.riderCard}>
            <div className={styles.riderInfo}>
              <div className="avatar avatar--lg">{order.rider.avatar}</div>
              <div>
                <div className={styles.riderName}>{order.rider.name}</div>
                <div className={styles.riderMeta}>
                  <span className="trust-badge trust-badge--verified">✓ Verified</span>
                  <span>⭐ {order.rider.rating}</span>
                  <span>{order.rider.completions} deliveries</span>
                </div>
                <div className={styles.riderVehicle}>
                  {order.rider.vehicle} · {order.rider.reg}
                </div>
              </div>
            </div>
            <div className={styles.riderActions}>
              <button className="btn btn--secondary btn--sm">📞 Call</button>
              <button className="btn btn--secondary btn--sm">💬 Message</button>
            </div>
          </div>

          {/* Route */}
          <div className={styles.routeCard}>
            <div className={styles.routePoint}>
              <div className={styles.routeDot} style={{ background: 'var(--color-primary-500)' }} />
              <div>
                <div className={styles.routeLabel}>Pickup</div>
                <div className={styles.routeAddress}>{order.pickup_address}</div>
              </div>
            </div>
            <div className={styles.routeLine} />
            <div className={styles.routePoint}>
              <div className={styles.routeDot} style={{ background: 'var(--color-success-500)' }} />
              <div>
                <div className={styles.routeLabel}>Deliver to</div>
                <div className={styles.routeAddress}>{order.dropoff_address}</div>
                {order.dropoff_gate_color && (
                  <div className={styles.routeNote}>🏠 {order.dropoff_gate_color}</div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery PIN */}
          <div className={styles.pinCard}>
            <div className={styles.pinHeader}>
              <span>🔑</span>
              <strong>Delivery PIN</strong>
            </div>
            <div className={styles.pinDigits}>
              {order.delivery_pin.split('').map((d, i) => (
                <div key={i} className={styles.pinDigit}>{d}</div>
              ))}
            </div>
            <p className={styles.pinNote}>
              Share this PIN with the rider to confirm delivery.
              Funds release only after PIN is verified.
            </p>
          </div>

          {/* Escrow Status */}
          {order.protection_level !== 'none' && (
            <div className="escrow-status escrow-status--held">
              <span>🛡️</span>
              <div>
                <strong>Funds held securely</strong>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                  ${order.pricing.total.toFixed(2)} held in escrow · Releases after PIN confirmation
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className={styles.timelineSection}>
            <h3 className={styles.timelineTitle}>Order timeline</h3>
            <div className="timeline">
              {timeline.map((item, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-marker">
                    <div className={`timeline-dot ${item.completed ? 'timeline-dot--completed' : item.active ? 'timeline-dot--active' : ''}`} />
                    {i < timeline.length - 1 && (
                      <div className={`timeline-line ${item.completed ? 'timeline-line--completed' : ''}`} />
                    )}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title">{item.status}</div>
                    <div className="timeline-description">{item.description}</div>
                    {item.time && <div className="timeline-time">{item.time}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className={styles.priceSummary}>
            <div className={styles.priceRow}>
              <span>Delivery fee</span>
              <span>${order.pricing.delivery_fee.toFixed(2)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Service fee</span>
              <span>${order.pricing.service_fee.toFixed(2)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>🛡️ Protection fee</span>
              <span>${order.pricing.protection_fee.toFixed(2)}</span>
            </div>
            <hr className="divider" />
            <div className={`${styles.priceRow} ${styles.priceTotal}`}>
              <span>Total</span>
              <span>${order.pricing.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className="btn btn--secondary btn--full">Report issue</button>
            <button className="btn btn--danger btn--full btn--sm">Cancel order</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-6"><span className="spinner spinner--lg" /></div>}>
      <TrackingContent />
    </Suspense>
  );
}
