'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './matching.module.css';
import { getOrderById, requestRiderMatch } from '@/lib/database';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import type { LatLng } from '@/lib/geo';
import { formatDuration } from '@/lib/geo';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const MatchingMap = dynamic(() => import('@/components/matching/MatchingMap'), { ssr: false });

// Mock order for dev/demo
const MOCK_ORDER: Order = {
  id: 'mock-order',
  reference_code: 'BKR-7X2K9M',
  service_type: 'send_item',
  fulfillment_mode: 'standard',
  protection_level: 'protected',
  privacy_mode: false,
  status: 'payment_held',
  customer_id: 'customer-1',
  rider_id: null,
  merchant_id: null,
  delivery_link_id: null,
  pickup_address: "Sam Levy's Village, Borrowdale",
  pickup_lat: -17.785,
  pickup_lng: 31.08,
  pickup_contact_name: 'Sender',
  pickup_contact_phone: '+263 77 111 2222',
  pickup_instructions: null,
  pickup_photo_urls: [],
  pickup_timestamp: null,
  dropoff_address: '42 Churchill Ave, Borrowdale Brooke',
  dropoff_lat: -17.76,
  dropoff_lng: 31.095,
  dropoff_contact_name: 'Recipient',
  dropoff_contact_phone: '+263 77 333 4444',
  dropoff_instructions: 'Brown gate. Call on arrival.',
  dropoff_gate_color: 'Brown gate',
  dropoff_photo_urls: [],
  dropoff_timestamp: null,
  delivery_pin_hash: '4729',
  delivery_pin_verified: false,
  handover_mode: 'hand_to_recipient',
  items: [],
  receipt_photo_urls: [],
  purchase_budget_max: null,
  purchase_buffer_pct: 10,
  substitution_allowed: true,
  estimated_distance_km: 4.2,
  estimated_duration_minutes: 15,
  promised_delivery_by: null,
  promise_met: null,
  scheduled_window_start: null,
  scheduled_window_end: null,
  scheduled_cutoff_at: null,
  batch_eligible: false,
  accepted_quote_id: null,
  quote_amount: 0,
  delivery_fee: 2.5,
  service_fee: 0.38,
  protection_fee: 0.5,
  purchase_amount: 0,
  surge_multiplier: 1,
  rush_premium: 0,
  saver_discount: 0,
  rider_payout: 2.2,
  platform_commission: 0.68,
  protection_reserve: 0.5,
  total_amount: 3.38,
  customer_rating: null,
  customer_review: null,
  rider_rating_of_customer: null,
  is_template: false,
  template_name: null,
  parent_template_id: null,
  batch_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
} as const;

const SERVICE_LABELS: Record<string, string> = {
  send_item: 'Send Item',
  buy_for_me: 'Buy For Me',
  pickup_order: 'Pick Up Order',
  document_run: 'Document Run',
  queue_service: 'Queue Service',
  multi_stop: 'Multi-Stop',
  emergency: 'Emergency',
};

function useOrder(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    if (IS_DEV) {
      setOrder(MOCK_ORDER);
      setLoading(false);
      return;
    }

    const id = orderId;
    let cancelled = false;

    getOrderById(id).then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data) setOrder(data as Order);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return { order, loading };
}

function MatchingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id') || null;

  const { order, loading } = useOrder(orderId);
  const [status, setStatus] = useState<'matching' | 'found' | 'timeout'>('matching');
  const [elapsed, setElapsed] = useState(0);
  const [rider, setRider] = useState<{ name: string; rating: number; tier: string; vehicle: string } | null>(null);
  const [offerAmount, setOfferAmount] = useState<number | null>(null);
  const [suggestedAmount, setSuggestedAmount] = useState(0);
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState(0);

  // Set up offer amount and bounds
  useEffect(() => {
    if (!order) return;
    const base = Number(order.total_amount) || 3.5;
    setOfferAmount(base);
    setSuggestedAmount(base);
    setMinAmount(Math.max(1.5, base * 0.7));
    setMaxAmount(base * 1.5);
  }, [order]);

  // Request rider matching when page loads
  useEffect(() => {
    if (!orderId || IS_DEV) return;
    requestRiderMatch(orderId).catch((err) => console.warn('Matching request failed:', err));
  }, [orderId]);

  // Subscribe to matching channel for this order
  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();
    const channel = supabase.channel(`matching-${orderId}`);

    const subscription = channel
      .on(
        'broadcast',
        { event: 'rider_assigned' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const data = payload?.payload;
          if (data?.rider) {
            setRider(data.rider as { name: string; rating: number; tier: string; vehicle: string });
            setStatus('found');
            // Redirect to tracking after a short delay
            setTimeout(() => {
              router.push(`/dashboard/tracking?id=${orderId}`);
            }, 2500);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  // Timer
  useEffect(() => {
    if (status !== 'matching') return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= 90) {
          setStatus('timeout');
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // In dev mode, simulate a rider accepting after 6 seconds
  useEffect(() => {
    if (!IS_DEV || !orderId) return;

    const timer = setTimeout(() => {
      setRider({ name: 'Takudzwa M.', rating: 4.9, tier: 'verified', vehicle: 'Honda CG 125' });
      setStatus('found');
      setTimeout(() => {
        router.push(`/dashboard/tracking?id=${orderId}`);
      }, 2500);
    }, 6000);

    return () => clearTimeout(timer);
  }, [IS_DEV, orderId, router]);

  const handleRaiseOffer = useCallback(() => {
    if (offerAmount === null) return;
    const newAmount = Math.min(offerAmount + 0.5, maxAmount);
    setOfferAmount(Number(newAmount.toFixed(2)));
    setElapsed(0);
    setStatus('matching');
  }, [offerAmount, maxAmount]);

  const handleSwitchToJet = useCallback(() => {
    if (!order) return;
    // In a real implementation, update order.fulfillment_mode to 'jet' and recalculate
    setOfferAmount((prev) => (prev ? Number((prev + 1.5).toFixed(2)) : prev));
    setElapsed(0);
    setStatus('matching');
  }, [order]);

  if (loading || !order) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingOverlay}>
          <span className="spinner spinner--lg" />
          <p>Loading your order...</p>
        </div>
      </div>
    );
  }

  const pickup: LatLng = { lat: order.pickup_lat, lng: order.pickup_lng };
  const dropoff: LatLng = { lat: order.dropoff_lat, lng: order.dropoff_lng };
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className={styles.page}>
      {/* Background Map */}
      <div className={styles.mapBackground}>
        <MatchingMap pickup={pickup} dropoff={dropoff} />
      </div>

      {/* Dark gradient overlay */}
      <div className={styles.overlay} />

      {/* Content */}
      <div className={styles.content}>
        {status === 'matching' && (
          <div className={styles.matchingCard}>
            <div className={styles.searchAnimation}>
              <div className={styles.radarRing} />
              <div className={styles.radarRing} />
              <div className={styles.radarRing} />
              <span className={styles.searchIcon}>🚴</span>
            </div>

            <h1 className={styles.title}>Finding your Biker</h1>
            <p className={styles.subtitle}>
              {SERVICE_LABELS[order.service_type]} · {order.pickup_address.split(',')[0]} →{' '}
              {order.dropoff_address.split(',')[0]}
            </p>

            <div className={styles.timer}>
              Searching {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>

            {/* Offer card */}
            <div className={styles.offerCard}>
              <div className={styles.offerHeader}>
                <span>Your offer</span>
                <span className={styles.offerAmount}>${offerAmount?.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={minAmount}
                max={maxAmount}
                step={0.5}
                value={offerAmount ?? suggestedAmount}
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                className={styles.offerSlider}
              />
              <div className={styles.offerRange}>
                <span>${minAmount.toFixed(2)}</span>
                <span>Suggested ${suggestedAmount.toFixed(2)}</span>
                <span>${maxAmount.toFixed(2)}</span>
              </div>
              <p className={styles.offerHint}>
                Raising your offer usually gets a faster match.
              </p>
            </div>

            <div className={styles.actions}>
              <button className="btn btn--primary btn--lg btn--full" onClick={handleRaiseOffer}>
                ⚡ Raise offer to ${((offerAmount ?? 0) + 0.5).toFixed(2)}
              </button>
              <button className="btn btn--jet btn--lg btn--full" onClick={handleSwitchToJet}>
                Switch to Biker Jet
              </button>
            </div>
          </div>
        )}

        {status === 'found' && rider && (
          <div className={`${styles.matchingCard} ${styles.foundCard}`}>
            <div className={styles.foundAvatar}>🎉</div>
            <h1 className={styles.title}>Biker found!</h1>
            <div className={styles.riderProfile}>
              <div className="avatar avatar--lg">{rider.name[0]}</div>
              <div>
                <div className={styles.riderName}>{rider.name}</div>
                <div className={styles.riderMeta}>
                  <span className="trust-badge trust-badge--verified">✓ {rider.tier}</span>
                  <span>⭐ {rider.rating}</span>
                </div>
                <div className={styles.riderVehicle}>{rider.vehicle}</div>
              </div>
            </div>
            <p className={styles.subtitle}>Heading to pickup now. Redirecting to live tracking...</p>
          </div>
        )}

        {status === 'timeout' && (
          <div className={styles.matchingCard}>
            <div className={styles.timeoutIcon}>⏱</div>
            <h1 className={styles.title}>Still searching</h1>
            <p className={styles.subtitle}>
              No riders accepted yet. Try raising your offer or switching to Biker Jet for faster matching.
            </p>
            <div className={styles.actions}>
              <button className="btn btn--primary btn--lg btn--full" onClick={handleRaiseOffer}>
                Raise offer
              </button>
              <button className="btn btn--jet btn--lg btn--full" onClick={handleSwitchToJet}>
                Switch to Biker Jet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchingPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.loadingOverlay}><span className="spinner spinner--lg" /></div></div>}>
      <MatchingContent />
    </Suspense>
  );
}
