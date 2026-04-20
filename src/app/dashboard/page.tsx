'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './dashboard.module.css';
import type { UserRole } from '@/types';

// Mock data
const MOCK_RECENT_ORDERS = [
  {
    id: '1',
    reference_code: 'BKR-7X2K9M',
    service_type: 'send_item',
    status: 'completed',
    dropoff_address: 'Borrowdale Brooke',
    created_at: '2 hours ago',
    total: 4.50,
    protection_level: 'protected',
  },
  {
    id: '2',
    reference_code: 'BKR-A3F7B2',
    service_type: 'buy_for_me',
    status: 'en_route_delivery',
    dropoff_address: 'Sam Levy\'s Village',
    created_at: '35 min ago',
    total: 12.80,
    protection_level: 'protected',
  },
  {
    id: '3',
    reference_code: 'BKR-D9K1P4',
    service_type: 'pickup_order',
    status: 'rider_assigned',
    dropoff_address: 'Avondale Shops',
    created_at: '5 min ago',
    total: 3.00,
    protection_level: 'none',
  },
];

const MOCK_RIDER_STATS = {
  todayEarnings: 28.50,
  weeklyEarnings: 142.00,
  completedToday: 8,
  rating: 4.9,
  completionRate: 97,
  tier: 'verified',
  isOnline: true,
};

const MOCK_MERCHANT_STATS = {
  todayDeliveries: 12,
  pendingDeliveries: 3,
  deliveryLinks: 5,
  avgRating: 4.8,
  onTimeRate: 96,
};

const SERVICE_ICONS: Record<string, string> = {
  send_item: '📦',
  buy_for_me: '🛒',
  pickup_order: '🏪',
  document_run: '📄',
  queue_service: '⏳',
  multi_stop: '📍',
};

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  quoted: { label: 'Quoted', variant: 'primary' },
  payment_pending: { label: 'Awaiting payment', variant: 'warning' },
  payment_held: { label: 'Payment secured', variant: 'success' },
  rider_assigned: { label: 'Rider assigned', variant: 'primary' },
  rider_en_route_pickup: { label: 'Rider en route', variant: 'primary' },
  at_pickup: { label: 'At pickup', variant: 'warning' },
  en_route_delivery: { label: 'Delivering', variant: 'jet' },
  at_delivery: { label: 'At delivery', variant: 'success' },
  delivery_confirmed: { label: 'Delivered', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  disputed: { label: 'Disputed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export default function DashboardPage() {
  const [role, setRole] = useState<UserRole>('customer');
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRole(parsed.role || 'customer');
        setUserName(parsed.full_name || 'User');
      }
    }

    // Listen for role changes
    const handler = () => {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRole(parsed.role || 'customer');
      }
    };
    window.addEventListener('storage', handler);
    
    // Check periodically for role changes (since storage event doesn't fire on same tab)
    const interval = setInterval(() => {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.role !== role) {
          setRole(parsed.role);
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, [role]);

  if (role === 'rider') return <RiderDashboard />;
  if (role === 'merchant') return <MerchantDashboard />;
  if (role === 'ops') return <OpsDashboard />;
  return <CustomerDashboard userName={userName} />;
}

// ============================================================
// CUSTOMER DASHBOARD
// ============================================================
function CustomerDashboard({ userName }: { userName: string }) {
  return (
    <div className={styles.dashboard}>
      {/* Welcome */}
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>
            Hi, {userName.split(' ')[0]} 👋
          </h1>
          <p className={styles.welcomeSubtitle}>
            What do you need delivered today?
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <Link href="/dashboard/order/new" className={styles.quickAction}>
          <span className={styles.qaIcon}>📦</span>
          <span className={styles.qaLabel}>Send Item</span>
        </Link>
        <Link href="/dashboard/order/new?type=buy_for_me" className={styles.quickAction}>
          <span className={styles.qaIcon}>🛒</span>
          <span className={styles.qaLabel}>Buy For Me</span>
        </Link>
        <Link href="/dashboard/order/new?type=pickup_order" className={styles.quickAction}>
          <span className={styles.qaIcon}>🏪</span>
          <span className={styles.qaLabel}>Pick Up</span>
        </Link>
        <Link href="/dashboard/order/new?type=document_run" className={styles.quickAction}>
          <span className={styles.qaIcon}>📄</span>
          <span className={styles.qaLabel}>Documents</span>
        </Link>
        <Link href="/dashboard/order/new?type=queue_service" className={styles.quickAction}>
          <span className={styles.qaIcon}>⏳</span>
          <span className={styles.qaLabel}>Queue</span>
        </Link>
        <Link href="/dashboard/order/new?type=multi_stop" className={styles.quickAction}>
          <span className={styles.qaIcon}>📍</span>
          <span className={styles.qaLabel}>Multi-Stop</span>
        </Link>
      </div>

      {/* Active Orders */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active orders</h2>
          <Link href="/dashboard/orders" className={styles.sectionLink}>View all →</Link>
        </div>
        <div className={styles.ordersList}>
          {MOCK_RECENT_ORDERS.filter(o => o.status !== 'completed').map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.draft;
            return (
              <Link
                key={order.id}
                href={`/dashboard/tracking?id=${order.id}`}
                className={styles.orderCard}
              >
                <div className={styles.orderCardLeft}>
                  <span className={styles.orderIcon}>
                    {SERVICE_ICONS[order.service_type] || '📦'}
                  </span>
                  <div>
                    <div className={styles.orderRef}>{order.reference_code}</div>
                    <div className={styles.orderAddress}>{order.dropoff_address}</div>
                    <div className={styles.orderTime}>{order.created_at}</div>
                  </div>
                </div>
                <div className={styles.orderCardRight}>
                  <span className={`badge badge--${statusInfo.variant}`}>
                    {statusInfo.label}
                  </span>
                  <div className={styles.orderAmount}>${order.total.toFixed(2)}</div>
                  {order.protection_level !== 'none' && (
                    <span className="trust-badge trust-badge--protected">🛡️</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Completed */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recently completed</h2>
        </div>
        <div className={styles.ordersList}>
          {MOCK_RECENT_ORDERS.filter(o => o.status === 'completed').map((order) => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderCardLeft}>
                <span className={styles.orderIcon}>
                  {SERVICE_ICONS[order.service_type] || '📦'}
                </span>
                <div>
                  <div className={styles.orderRef}>{order.reference_code}</div>
                  <div className={styles.orderAddress}>{order.dropoff_address}</div>
                  <div className={styles.orderTime}>{order.created_at}</div>
                </div>
              </div>
              <div className={styles.orderCardRight}>
                <span className="badge badge--success">✓ Completed</span>
                <div className={styles.orderAmount}>${order.total.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RIDER DASHBOARD
// ============================================================
function RiderDashboard() {
  const [isOnline, setIsOnline] = useState(MOCK_RIDER_STATS.isOnline);

  return (
    <div className={styles.dashboard}>
      {/* Online Toggle */}
      <div className={styles.riderHeader}>
        <div
          className={`rider-status-indicator ${isOnline ? 'rider-status-indicator--online' : 'rider-status-indicator--offline'}`}
          onClick={() => setIsOnline(!isOnline)}
          style={{ cursor: 'pointer' }}
        >
          <div className={`toggle ${isOnline ? 'toggle--active' : ''}`}>
            <div className="toggle-knob" />
          </div>
          {isOnline ? '🟢 Online' : '⚪ Offline'}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>${MOCK_RIDER_STATS.todayEarnings.toFixed(2)}</div>
          <div className={styles.statLabel}>Today&apos;s earnings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{MOCK_RIDER_STATS.completedToday}</div>
          <div className={styles.statLabel}>Deliveries today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>⭐ {MOCK_RIDER_STATS.rating}</div>
          <div className={styles.statLabel}>Rating</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{MOCK_RIDER_STATS.completionRate}%</div>
          <div className={styles.statLabel}>Completion rate</div>
        </div>
      </div>

      {/* Tier */}
      <div className={styles.tierCard}>
        <div className={styles.tierInfo}>
          <span className="trust-badge trust-badge--verified">✓ Verified Rider</span>
          <p className={styles.tierDesc}>
            Complete 50 more deliveries to unlock <strong>Pro</strong> tier.
          </p>
        </div>
        <div className={styles.tierProgress}>
          <div className={styles.tierProgressBar}>
            <div className={styles.tierProgressFill} style={{ width: '60%' }} />
          </div>
          <span className={styles.tierProgressLabel}>30 / 50</span>
        </div>
      </div>

      {/* Weekly Earnings */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>This week</h2>
          <Link href="/dashboard/earnings" className={styles.sectionLink}>Details →</Link>
        </div>
        <div className={styles.weekSummary}>
          <div className={styles.weekTotal}>
            <span className={styles.weekTotalLabel}>Total earned</span>
            <span className={styles.weekTotalValue}>${MOCK_RIDER_STATS.weeklyEarnings.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Available Jobs Preview */}
      {isOnline && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Available jobs</h2>
            <Link href="/dashboard/jobs" className={styles.sectionLink}>View all →</Link>
          </div>
          <div className={styles.jobsList}>
            <div className={styles.jobCard}>
              <div className={styles.jobCardTop}>
                <span className="badge badge--jet">⚡ Biker Jet</span>
                <span className={styles.jobPayout}>$4.80</span>
              </div>
              <div className={styles.jobRoute}>
                CBD → Mount Pleasant · 5.2 km
              </div>
              <div className={styles.jobMeta}>
                📦 Send Item · 1.2 km to pickup
              </div>
              <div className={styles.jobActions}>
                <button className="btn btn--primary" style={{ flex: 1 }}>Accept</button>
                <button className="btn btn--ghost">Decline</button>
              </div>
            </div>
            <div className={styles.jobCard}>
              <div className={styles.jobCardTop}>
                <span className="badge badge--primary">Standard</span>
                <span className={styles.jobPayout}>$3.20</span>
              </div>
              <div className={styles.jobRoute}>
                Avondale → Eastlea · 3.8 km
              </div>
              <div className={styles.jobMeta}>
                🛒 Buy For Me · 0.8 km to pickup
              </div>
              <div className={styles.jobActions}>
                <button className="btn btn--primary" style={{ flex: 1 }}>Accept</button>
                <button className="btn btn--ghost">Decline</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MERCHANT DASHBOARD
// ============================================================
function MerchantDashboard() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>Good afternoon 🏪</h1>
          <p className={styles.welcomeSubtitle}>
            Here&apos;s your delivery overview for today.
          </p>
        </div>
        <Link href="/dashboard/links" className="btn btn--primary">
          + New delivery link
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{MOCK_MERCHANT_STATS.todayDeliveries}</div>
          <div className={styles.statLabel}>Deliveries today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{MOCK_MERCHANT_STATS.pendingDeliveries}</div>
          <div className={styles.statLabel}>Pending</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>⭐ {MOCK_MERCHANT_STATS.avgRating}</div>
          <div className={styles.statLabel}>Avg rating</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{MOCK_MERCHANT_STATS.onTimeRate}%</div>
          <div className={styles.statLabel}>On-time rate</div>
        </div>
      </div>

      {/* Active Delivery Links */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active delivery links</h2>
          <Link href="/dashboard/links" className={styles.sectionLink}>Manage →</Link>
        </div>
        <div className={styles.deliveryLinks}>
          <div className={styles.linkCard}>
            <div className={styles.linkCardTop}>
              <span className={styles.linkSlug}>biker.co.zw/d/sisi-001</span>
              <span className="badge badge--success">Active</span>
            </div>
            <div className={styles.linkCustomer}>
              Customer: Agnes M. · Items: 3 dresses
            </div>
            <div className={styles.linkMeta}>
              Created 2h ago · Expires in 46h
            </div>
          </div>
          <div className={styles.linkCard}>
            <div className={styles.linkCardTop}>
              <span className={styles.linkSlug}>biker.co.zw/d/sisi-002</span>
              <span className="badge badge--warning">Awaiting pickup</span>
            </div>
            <div className={styles.linkCustomer}>
              Customer: Tendai K. · Items: 1 phone case
            </div>
            <div className={styles.linkMeta}>
              Created 5h ago · Rider assigned
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// OPS DASHBOARD
// ============================================================
function OpsDashboard() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>Operations Center 🔧</h1>
          <p className={styles.welcomeSubtitle}>
            Real-time overview of all active operations.
          </p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>24</div>
          <div className={styles.statLabel}>Active orders</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>18</div>
          <div className={styles.statLabel}>Online riders</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>3</div>
          <div className={styles.statLabel}>Open disputes</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>2</div>
          <div className={styles.statLabel}>Pending verifications</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Open disputes</h2>
          <Link href="/dashboard/disputes" className={styles.sectionLink}>View all →</Link>
        </div>
        <div className={styles.ordersList}>
          <div className={styles.orderCard}>
            <div className={styles.orderCardLeft}>
              <span className={styles.orderIcon}>⚖️</span>
              <div>
                <div className={styles.orderRef}>DSP-001</div>
                <div className={styles.orderAddress}>Wrong item delivered</div>
                <div className={styles.orderTime}>Filed 45 min ago</div>
              </div>
            </div>
            <div className={styles.orderCardRight}>
              <span className="badge badge--danger">Open</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
