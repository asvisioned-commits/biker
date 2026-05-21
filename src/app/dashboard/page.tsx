'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OrderService, BikerOrder } from '@/lib/order-service';
import Link from 'next/link';

export default function DashboardHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<'customer' | 'rider' | 'merchant' | 'ops' | null>(null);
  const [orders, setOrders] = useState<BikerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Rider/Merchant specific metrics
  const [riderOnline, setRiderOnline] = useState(false);
  const [updatingOnlineStatus, setUpdatingOnlineStatus] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch Profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      // Determine active role
      const activeRole = (prof?.active_role || 'customer') as any;
      setRole(activeRole);

      // Fetch Orders
      const userOrders = await OrderService.getOrders(user.id, activeRole);
      setOrders(userOrders);

      // If Rider, check available status
      if (activeRole === 'rider') {
        const { data: rp } = await supabase.from('rider_profiles').select('is_available').eq('user_id', user.id).single();
        if (rp) {
          setRiderOnline(rp.is_available);
        }
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  const toggleRiderAvailability = async () => {
    if (!profile) return;
    setUpdatingOnlineStatus(true);
    const supabase = createClient();
    
    const nextVal = !riderOnline;
    const { error } = await supabase
      .from('rider_profiles')
      .update({ is_available: nextVal })
      .eq('user_id', profile.id);

    if (!error) {
      setRiderOnline(nextVal);
    }
    setUpdatingOnlineStatus(false);
  };

  const switchRole = async (targetRole: string) => {
    if (!profile) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ active_role: targetRole }).eq('id', profile.id);
    
    // Refresh page/state
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl p-6">
      {/* Header Profile section */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="title" style={{ fontSize: '1.8rem' }}>Welcome back, {profile?.full_name || 'Biker user'} 👋</h1>
          <p style={{ color: 'var(--text-secondary)' }}>You are currently active as a <span style={{ textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-primary-500)' }}>{role}</span></p>
        </div>

        {/* Role switching */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {role !== 'customer' && (
            <button className="btn btn--secondary btn--sm" onClick={() => switchRole('customer')}>
              Switch to Customer
            </button>
          )}
          {role !== 'rider' && (
            <button className="btn btn--secondary btn--sm" onClick={() => switchRole('rider')}>
              Switch to Rider
            </button>
          )}
        </div>
      </div>

      {/* Main dashboard widgets */}
      {role === 'customer' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 md:col-span-2 display-flex flex-column justify-center align-start">
            <h2 className="title title--sm mb-2">Need to deliver or buy something?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
              Zimbabwe's premier secure escrow courier logistics service. Real-time path tracing, dynamic pricing, and cash collection.
            </p>
            <Link href="/dashboard/order/new" className="btn btn--primary">
              📦 Book a Biker Delivery
            </Link>
          </div>

          <div className="card p-6 display-flex flex-column justify-between">
            <div style={{ fontSize: '3rem' }}>🛡️</div>
            <div>
              <h3 style={{ fontWeight: 800, marginBottom: '6px' }}>Biker Protect enabled</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                All EcoCash order payouts are held securely in a multi-sig escrow system. Guaranteed payout releases.
              </p>
            </div>
          </div>
        </div>
      )}

      {role === 'rider' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 md:col-span-2 display-flex flex-column justify-between">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="title title--sm mb-2">Rider Work Console</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Go online to receive matches and immediate delivery assignments nearby.
                </p>
              </div>

              <button 
                className={`btn ${riderOnline ? 'btn--success' : 'btn--secondary'} btn--sm`}
                onClick={toggleRiderAvailability}
                disabled={updatingOnlineStatus}
              >
                {updatingOnlineStatus ? 'Updating...' : riderOnline ? '🟢 Online' : '🔴 Offline'}
              </button>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
              <Link href="/dashboard/active" className="btn btn--primary btn--full text-center">
                🚴 Open Active Job Console
              </Link>
            </div>
          </div>

          <div className="card p-6 display-flex flex-column justify-between">
            <div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Rider Wallet balance</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>$42.50</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Payouts are released immediately upon PIN validation.
            </div>
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="card p-6">
        <h3 className="title title--sm mb-4">Your Recent Deliveries</h3>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📦</div>
            <p>No recent orders found. Get started by booking a biker.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center p-4 border border--default" style={{ borderRadius: '8px', background: 'var(--bg-secondary)', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.5rem' }}>🚴</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }} className="font-mono">{o.reference_code}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      To: {o.dropoff_address}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px' }}>${o.total_amount?.toFixed(2)}</div>
                    <div style={{ fontSize: '11px', textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-primary-500)' }}>
                      {o.status.replace(/_/g, ' ')}
                    </div>
                  </div>

                  <Link href={`/dashboard/tracking?id=${o.id}`} className="btn btn--secondary btn--sm">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
