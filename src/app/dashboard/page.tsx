'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './dashboard.module.css';
import { useProfile } from '@/context/ProfileContext';
import { OrderService, BikerOrder } from '@/lib/order-service';
import type { UserRole } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { 
  getRiderDashboardStats, 
  getMerchantDashboardStats, 
  getOpsDashboardStats, 
  toggleRiderOnline 
} from '@/lib/database';
import { ListSkeleton, StatsSkeleton } from '@/components/skeletons';

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
  const { session, loading } = useProfile();

  if (loading) {
    return (
      <div className={styles.dashboard} style={{ padding: 'var(--space-6)' }}>
        {/* Welcome Shimmer */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton skeleton--title" style={{ width: '220px', height: '32px' }} />
          <div className="skeleton skeleton--text" style={{ width: '320px', height: '16px' }} />
        </div>
        {/* Stats Grid Shimmer */}
        <StatsSkeleton />
        {/* Active Orders List Shimmer */}
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div className="skeleton skeleton--title" style={{ width: '150px', height: '24px', marginBottom: 'var(--space-4)' }} />
          <ListSkeleton count={2} />
        </div>
      </div>
    );
  }

  const role = (session?.role as UserRole) || 'customer';
  const userName = session?.full_name || 'User';

  if (role === 'rider') return <RiderDashboard />;
  if (role === 'merchant') return <MerchantDashboard />;
  if (role === 'ops') return <OpsDashboard />;
  return <CustomerDashboard userName={userName} />;
}

// ============================================================
// CUSTOMER DASHBOARD
// ============================================================
function CustomerDashboard({ userName }: { userName: string }) {
  const { session } = useProfile();
  const userId = session?.user_id || 'mock-customer-id';
  
  const [orders, setOrders] = useState<BikerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const list = await OrderService.getOrders(userId, 'customer');
        setOrders(list);
      } catch (err) {
        console.error('Failed to get dashboard orders:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [userId]);

  const formatOrderTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const completedOrders = orders.filter(o => o.status === 'completed');

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
          {loading && <ListSkeleton count={2} />}
          {!loading && activeOrders.length === 0 && (
            <p className={styles.emptyText} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              No active orders at the moment.
            </p>
          )}
          {!loading && activeOrders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.draft;
            const fare = order.delivery_fee ?? 5.00;
            return (
              <Link
                key={order.id}
                href={`/dashboard/tracking?id=${order.id}`}
                className={styles.orderCard}
              >
                <div className={styles.orderCardLeft}>
                  <span className={styles.orderIcon}>
                    {SERVICE_ICONS[order.service_type || ''] || '📦'}
                  </span>
                  <div>
                    <div className={styles.orderRef}>{order.reference_code}</div>
                    <div className={styles.orderAddress}>{order.dropoff_address}</div>
                    <div className={styles.orderTime}>{formatOrderTime(order.created_at)}</div>
                  </div>
                </div>
                <div className={styles.orderCardRight}>
                  <span className={`badge badge--${statusInfo.variant}`}>
                    {statusInfo.label}
                  </span>
                  <div className={styles.orderAmount}>${fare.toFixed(2)}</div>
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
          {loading && <ListSkeleton count={1} />}
          {!loading && completedOrders.length === 0 && (
            <p className={styles.emptyText} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              No recently completed orders.
            </p>
          )}
          {!loading && completedOrders.map((order) => {
            const fare = order.delivery_fee ?? 5.00;
            return (
              <Link key={order.id} href={`/dashboard/tracking?id=${order.id}`} className={styles.orderCard}>
                <div className={styles.orderCardLeft}>
                  <span className={styles.orderIcon}>
                    {SERVICE_ICONS[order.service_type || ''] || '📦'}
                  </span>
                  <div>
                    <div className={styles.orderRef}>{order.reference_code}</div>
                    <div className={styles.orderAddress}>{order.dropoff_address}</div>
                    <div className={styles.orderTime}>{formatOrderTime(order.created_at)}</div>
                  </div>
                </div>
                <div className={styles.orderCardRight}>
                  <span className="badge badge--success">✓ Completed</span>
                  <div className={styles.orderAmount}>${fare.toFixed(2)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RIDER DASHBOARD
// ============================================================
function RiderDashboard() {
  const { session } = useProfile();
  const userId = session?.user_id;
  
  const [stats, setStats] = useState<{
    isOnline: boolean;
    todayEarnings: number;
    completedToday: number;
    rating: number;
    tier: string;
    subscription: any;
  } | null>(null);
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  const fetchRiderData = async () => {
    if (!userId) return;
    try {
      const statsData = await getRiderDashboardStats(userId);
      setStats(statsData);
      setIsOnline(statsData.isOnline);

      // Fetch available jobs preview if online
      if (statsData.isOnline) {
        const supabase = createClient();
        const { data } = await supabase
          .from('delivery_requests')
          .select('*')
          .is('assigned_rider_id', null)
          .eq('status', 'payment_held')
          .order('created_at', { ascending: false })
          .limit(2);
        setJobs(data || []);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('Failed to fetch rider dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderData();
    const interval = setInterval(fetchRiderData, 10000);
    return () => clearInterval(interval);
  }, [userId, isOnline]);

  const handleToggleOnline = async () => {
    if (!userId || togglePending) return;
    const targetStatus = !isOnline;
    
    // Optimistic UI update
    setIsOnline(targetStatus);
    setTogglePending(true);

    try {
      const { error } = await toggleRiderOnline(userId, targetStatus);
      if (error) throw error;
      
      setStats(prev => prev ? { ...prev, isOnline: targetStatus } : null);
    } catch (err) {
      // Revert on error
      setIsOnline(!targetStatus);
      alert('Failed to update status. Please try again.');
    } finally {
      setTogglePending(false);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!userId) return;
    setAcceptingJobId(jobId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('delivery_requests')
        .update({
          assigned_rider_id: userId,
          status: 'rider_assigned',
          accepted_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .is('assigned_rider_id', null)
        .eq('status', 'payment_held')
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('This job was just accepted by another rider.');
        fetchRiderData();
        return;
      }

      alert('Job successfully accepted! Navigate to pickup.');
      fetchRiderData();
    } catch (err) {
      console.error(err);
      alert('Failed to accept job. Please try again.');
    } finally {
      setAcceptingJobId(null);
    }
  };

  const todayEarnings = stats?.todayEarnings ?? 0.00;
  const completedToday = stats?.completedToday ?? 0;
  const rating = stats?.rating ?? 0.0;
  const tier = stats?.tier ?? 'starter';

  return (
    <div className={styles.dashboard}>
      {/* Online Toggle */}
      <div className={styles.riderHeader}>
        <div
          className={`rider-status-indicator ${isOnline ? 'rider-status-indicator--online' : 'rider-status-indicator--offline'}`}
          onClick={handleToggleOnline}
          style={{ cursor: togglePending ? 'not-allowed' : 'pointer', opacity: togglePending ? 0.7 : 1 }}
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
          <div className={styles.statValue}>${todayEarnings.toFixed(2)}</div>
          <div className={styles.statLabel}>Today&apos;s earnings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{completedToday}</div>
          <div className={styles.statLabel}>Deliveries today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>⭐ {rating.toFixed(1)}</div>
          <div className={styles.statLabel}>Rating</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{tier.toUpperCase()}</div>
          <div className={styles.statLabel}>Rider tier</div>
        </div>
      </div>

      {/* Tier Progress */}
      <div className={styles.tierCard}>
        <div className={styles.tierInfo}>
          <span className="trust-badge trust-badge--verified">✓ {tier.toUpperCase()} Rider</span>
          <p className={styles.tierDesc}>
            {stats?.subscription ? (
              <>
                Subscription Active. Limit: <strong>${stats.subscription.earningCap.toFixed(2)}</strong> · Current: <strong>${stats.subscription.currentEarnings.toFixed(2)}</strong>
              </>
            ) : (
              <>Complete deliveries and maintain high ratings to unlock elite tiers.</>
            )}
          </p>
        </div>
        <div className={styles.tierProgress}>
          <div className={styles.tierProgressBar}>
            <div 
              className={styles.tierProgressFill} 
              style={{ 
                width: stats?.subscription \n                  ? `${Math.min(100, (stats.subscription.currentEarnings / stats.subscription.earningCap) * 100)}%` 
                  : '30%' 
              }} 
            />
          </div>
          <span className={styles.tierProgressLabel}>
            {stats?.subscription 
              ? `$${stats.subscription.currentEarnings.toFixed(0)} / $${stats.subscription.earningCap.toFixed(0)}` 
              : 'Active'}
          </span>
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
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="card card--glass" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: '80px', height: '18px', borderRadius: 'var(--radius-full)' }} />
                      <div className="skeleton" style={{ width: '40px', height: '18px' }} />
                    </div>
                    <div className="skeleton skeleton--title" style={{ width: '80%', height: '14px', marginTop: 'var(--space-2)' }} />
                    <div className="skeleton skeleton--text" style={{ width: '50%', height: '10px' }} />
                    <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)' }} />
                  </div>
                ))}
              </div>
            )}
            {!loading && jobs.length === 0 && (
              <p className={styles.emptyText} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                You&apos;re all caught up! New jobs appear here instantly.
              </p>
            )}
            {!loading && jobs.map((job) => (
              <div key={job.id} className={styles.jobCard}>
                <div className={styles.jobCardTop}>
                  <span className="badge badge--jet">{job.fulfillment_mode?.toUpperCase() || 'STANDARD'}</span>
                  <span className={styles.jobPayout}>${Number(job.rider_payout || job.delivery_fee * 0.8).toFixed(2)}</span>
                </div>
                <div className={styles.jobRoute}>
                  {job.pickup_address.split(',')[0]} → {job.dropoff_address.split(',')[0]} {job.estimated_distance_km ? `· ${job.estimated_distance_km} km` : ''}
                </div>
                <div className={styles.jobMeta}>
                  📦 {job.service_type?.replace('_', ' ') || 'Send Item'} {job.estimated_duration_minutes ? `· ${job.estimated_duration_minutes} mins` : ''}
                </div>
                <div className={styles.jobActions}>
                  <button 
                    className="btn btn--primary" 
                    style={{ flex: 1 }} 
                    disabled={acceptingJobId === job.id}
                    onClick={() => handleAcceptJob(job.id)}
                  >
                    {acceptingJobId === job.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
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
  const { session } = useProfile();
  const userId = session?.user_id;

  const [stats, setStats] = useState<{
    businessName: string;
    rating: number;
    totalDeliveries: number;
    activeOrdersCount: number;
    todayOrdersCount: number;
    activeLinksCount: number;
  } | null>(null);

  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMerchantData = async () => {
    if (!userId) return;
    try {
      const statsData = await getMerchantDashboardStats(userId);
      setStats(statsData);

      const supabase = createClient();
      const { data } = await supabase
        .from('delivery_links')
        .select('*')
        .eq('merchant_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3);
      
      setLinks(data || []);
    } catch (err) {
      console.error('Failed to load merchant stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantData();
    const interval = setInterval(fetchMerchantData, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const activeOrdersCount = stats?.activeOrdersCount ?? 0;
  const todayOrdersCount = stats?.todayOrdersCount ?? 0;
  const rating = stats?.rating ?? 0.0;
  const activeLinksCount = stats?.activeLinksCount ?? 0;
  const businessName = stats?.businessName || 'Merchant';

  const formatExpires = (expiryStr: string) => {
    const diff = new Date(expiryStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return `Expires in ${hours}h`;
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>Good afternoon, {businessName} 🏪</h1>
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
          <div className={styles.statValue}>{todayOrdersCount}</div>
          <div className={styles.statLabel}>Deliveries today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{activeOrdersCount}</div>
          <div className={styles.statLabel}>Pending</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>⭐ {rating.toFixed(1)}</div>
          <div className={styles.statLabel}>Avg rating</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{activeLinksCount}</div>
          <div className={styles.statLabel}>Active links</div>
        </div>
      </div>

      {/* Active Delivery Links */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active delivery links</h2>
          <Link href="/dashboard/links" className={styles.sectionLink}>Manage →</Link>
        </div>
        <div className={styles.deliveryLinks}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="card card--glass" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton skeleton--title" style={{ width: '150px', height: '14px', marginBottom: 0 }} />
                    <div className="skeleton" style={{ width: '50px', height: '18px', borderRadius: 'var(--radius-full)' }} />
                  </div>
                  <div className="skeleton skeleton--text" style={{ width: '80%', height: '10px' }} />
                  <div className="skeleton skeleton--text" style={{ width: '40%', height: '10px' }} />
                </div>
              ))}
            </div>
          )}
          {!loading && links.length === 0 && (
            <p className={styles.emptyText} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              No active delivery links yet. Create one above!
            </p>
          )}
          {!loading && links.map((link) => (
            <div key={link.id} className={styles.linkCard}>
              <div className={styles.linkCardTop}>
                <span className={styles.linkSlug}>biker.co.zw/d/{link.slug}</span>
                <span className="badge badge--success">Active</span>
              </div>
              <div className={styles.linkCustomer}>
                Customer: {link.customer_name || 'Guest'} · Items: {
                  Array.isArray(link.items) 
                    ? link.items.map((i: any) => i.name || i.item_description || 'item').join(', ')
                    : 'Preset order'
                }
              </div>
              <div className={styles.linkMeta}>
                Created {new Date(link.created_at).toLocaleDateString()} · {formatExpires(link.expires_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// OPS DASHBOARD
// ============================================================
function OpsDashboard() {
  const [stats, setStats] = useState<{
    activeOrdersCount: number;
    onlineRidersCount: number;
    openDisputesCount: number;
    pendingVerificationsCount: number;
  } | null>(null);

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpsData = async () => {
    try {
      const statsData = await getOpsDashboardStats();
      setStats(statsData);

      const supabase = createClient();
      const { data } = await supabase
        .from('disputes')
        .select(`
          id,
          dispute_type,
          description,
          created_at,
          status,
          initiator:profiles!disputes_initiated_by_fkey(full_name)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(3);
      
      setDisputes(data || []);
    } catch (err) {
      console.error('Failed to fetch ops data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpsData();
    const interval = setInterval(fetchOpsData, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeOrdersCount = stats?.activeOrdersCount ?? 0;
  const onlineRidersCount = stats?.onlineRidersCount ?? 0;
  const openDisputesCount = stats?.openDisputesCount ?? 0;
  const pendingVerificationsCount = stats?.pendingVerificationsCount ?? 0;

  const formatTime = (timeStr: string) => {
    const diff = Date.now() - new Date(timeStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(timeStr).toLocaleDateString();
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>Operations Center 🔧</h1>
          <p className={styles.welcomeSubtitle}>
            Real-time overview of all active operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/dashboard/ops/cod" className="btn btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
            💵 Cash Reconciliation
          </Link>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{activeOrdersCount}</div>
          <div className={styles.statLabel}>Active orders</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{onlineRidersCount}</div>
          <div className={styles.statLabel}>Online riders</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{openDisputesCount}</div>
          <div className={styles.statLabel}>Open disputes</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{pendingVerificationsCount}</div>
          <div className={styles.statLabel}>Pending verifications</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Open disputes</h2>
          <Link href="/dashboard/disputes" className={styles.sectionLink}>View all →</Link>
        </div>
        <div className={styles.ordersList}>
          {loading && <ListSkeleton count={2} />}
          {!loading && disputes.length === 0 && (
            <p className={styles.emptyText} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              No open disputes at the moment. Good job!
            </p>
          )}
          {!loading && disputes.map((dispute) => (
            <div key={dispute.id} className={styles.orderCard}>
              <div className={styles.orderCardLeft}>
                <span className={styles.orderIcon}>⚖️</span>
                <div>
                  <div className={styles.orderRef}>DSP-{dispute.id.slice(0, 6).toUpperCase()}</div>
                  <div className={styles.orderAddress}>{dispute.description}</div>
                  <div className={styles.orderTime}>
                    Filed by {dispute.initiator?.full_name || 'User'} · {formatTime(dispute.created_at)}
                  </div>
                </div>
              </div>
              <div className={styles.orderCardRight}>
                <span className="badge badge--danger">Open</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
