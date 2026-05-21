'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderService, BikerOrder } from '@/lib/order-service';
import styles from './tracking.module.css';

function TrackingContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'map' | 'info'>('map');
  const [currentStatus, setCurrentStatus] = useState(3); // 3: en route pickup, 4: at pickup, 6: en route delivery, 7: delivered
  const [progress, setProgress] = useState(0); // 0 to 100
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Live order from database or local storage
  const [liveOrder, setLiveOrder] = useState<BikerOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const orderId = searchParams.get('id');

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchLiveOrder = async () => {
      try {
        const o = await OrderService.getOrderById(orderId);
        if (o) {
          setLiveOrder(o);
          if (o.status === 'completed') {
            setProgress(100);
            setPinVerified(true);
            setCurrentStatus(7);
          } else if (o.status === 'en_route_delivery') {
            setProgress(prev => Math.max(prev, 50));
          } else if (o.status === 'arrived_pickup') {
            setProgress(prev => Math.max(prev, 30));
          }
        }
      } catch (err) {
        console.error('Error fetching live order:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveOrder();
    const interval = setInterval(fetchLiveOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const mapId = 'leaflet-tracking-map';

  // Read coordinates and addresses from URL, fallback to Harare coordinates
  const pLatParam = parseFloat(searchParams.get('pLat') || '-17.7502');
  const pLngParam = parseFloat(searchParams.get('pLng') || '31.0858');
  const dLatParam = parseFloat(searchParams.get('dLat') || '-17.7289');
  const dLngParam = parseFloat(searchParams.get('dLng') || '31.1345');

  const pickupLat = liveOrder?.pickup_lat || pLatParam;
  const pickupLng = liveOrder?.pickup_lng || pLngParam;
  const dropoffLat = liveOrder?.dropoff_lat || dLatParam;
  const dropoffLng = liveOrder?.dropoff_lng || dLngParam;
  
  const pickupAddress = liveOrder?.pickup_address || searchParams.get('pAddr') || "Sam Levy's Village, Borrowdale";
  const dropoffAddress = liveOrder?.dropoff_address || searchParams.get('dAddr') || "Borrowdale Brooke Golf Estate";

  // Unified order details
  const order = {
    reference_code: liveOrder?.reference_code || searchParams.get('ref') || 'BKR-NEW',
    service_type: (liveOrder?.service_type || searchParams.get('service') || 'send_item') as 'send_item' | 'buy_for_me',
    fulfillment_mode: (liveOrder?.fulfillment_mode || 'standard') as 'standard' | 'jet',
    protection_level: liveOrder?.protection_level || 'protected',
    pickup_address: pickupAddress,
    dropoff_address: dropoffAddress,
    dropoff_gate_color: liveOrder?.dropoff_gate_color || 'Brown gate',
    delivery_pin: liveOrder?.delivery_pin || '4729',
    rider: {
      name: liveOrder?.rider?.full_name || 'Takudzwa M.',
      rating: 4.9,
      vehicle: 'Honda CG 125',
      reg: 'AEQ 7834',
      completions: 247,
      tier: 'verified',
      avatar: (liveOrder?.rider?.full_name?.[0] || 'T').toUpperCase(),
    },
    pricing: {
      delivery_fee: Number(liveOrder?.delivery_fee || parseFloat(searchParams.get('fare') || '5.00')),
      service_fee: Number(liveOrder?.service_fee || 0.38),
      protection_fee: Number(liveOrder?.protection_fee || 0.50),
      total: Number(liveOrder?.total_amount || (parseFloat(searchParams.get('fare') || '5.00') + 0.38 + 0.50)),
    },
    estimated_delivery: progress < 25 ? '12 min' : progress < 45 ? '10 min' : progress < 90 ? '5 min' : 'Arrived',
    created_at: liveOrder ? new Date(liveOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
  };

  // Load Leaflet dynamically
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapId);
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }

    const map = L.map(mapId).setView([pickupLat, pickupLng], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const createCustomIcon = (emoji: string) => {
      return L.divIcon({
        html: `<div style="font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">${emoji}</div>`,
        className: 'custom-leaflet-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    };

    L.marker([pickupLat, pickupLng], { icon: createCustomIcon('📍') })
      .addTo(map)
      .bindPopup('<b>Pickup Point</b>');

    L.marker([dropoffLat, dropoffLng], { icon: createCustomIcon('🏁') })
      .addTo(map)
      .bindPopup('<b>Dropoff Point</b>');

    const polyline = L.polyline(
      [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ],
      {
        color: '#1a73e8',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8',
      }
    ).addTo(map);

    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    const riderMarker = L.marker([pickupLat, pickupLng], { icon: createCustomIcon('🚴') }).addTo(map);
    riderMarkerRef.current = riderMarker;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  // Simulate progress interval (0 to 100 in 25 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 250); // 100 steps * 250ms = 25 seconds

    return () => clearInterval(interval);
  }, []);

  // Update Rider position and status based on progress
  useEffect(() => {
    if (!leafletLoaded || !riderMarkerRef.current || !mapRef.current) return;

    const interpolate = (p1: [number, number], p2: [number, number], t: number): [number, number] => {
      return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
    };

    let lat: number;
    let lng: number;
    let status = 3;

    if (progress < 25) {
      // Phase 1: Rider moving to pickup
      const startOffset: [number, number] = [pickupLat + 0.005, pickupLng - 0.005];
      const t = progress / 25;
      [lat, lng] = interpolate(startOffset, [pickupLat, pickupLng], t);
      status = 3;
    } else if (progress < 45) {
      // Phase 2: Rider at pickup
      lat = pickupLat;
      lng = pickupLng;
      status = 4;
    } else if (progress < 90) {
      // Phase 3: Rider en route to delivery
      const t = (progress - 45) / 45;
      [lat, lng] = interpolate([pickupLat, pickupLng], [dropoffLat, dropoffLng], t);
      status = 6;
    } else {
      // Phase 4: Delivered (arrived)
      lat = dropoffLat;
      lng = dropoffLng;
      status = 7;
    }

    riderMarkerRef.current.setLatLng([lat, lng]);
    if (progress % 4 === 0) {
      mapRef.current.panTo([lat, lng]);
    }
    
    if (status !== currentStatus) {
      setCurrentStatus(status);
      
      const dbStatusMap: Record<number, string> = {
        3: 'en_route_pickup',
        4: 'arrived_pickup',
        6: 'en_route_delivery',
        7: 'completed',
      };
      
      const targetDbStatus = dbStatusMap[status];
      if (orderId && liveOrder && liveOrder.status !== targetDbStatus && !pinVerified) {
        OrderService.updateOrderStatus(orderId, targetDbStatus);
      }
    }
  }, [progress, leafletLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng, currentStatus, orderId, liveOrder, pinVerified]);

  const timeline = [
    { status: 'Order placed', time: '2:15 PM', completed: true, description: 'Order confirmed and payment secured' },
    { status: 'Rider assigned', time: '2:16 PM', completed: true, description: 'Takudzwa M. accepted your delivery' },
    { status: 'En route to pickup', time: '2:18 PM', completed: true, description: 'Rider is heading to pickup location' },
    { status: 'At pickup', time: progress >= 25 ? '2:25 PM' : '', completed: currentStatus >= 4, active: currentStatus === 3, description: 'Rider arrived at pickup point' },
    { status: 'Proof uploaded', time: progress >= 45 ? '2:28 PM' : '', completed: currentStatus >= 6, active: currentStatus === 4, description: 'Pickup photo captured' },
    { status: 'En route to delivery', time: progress >= 45 ? '2:29 PM' : '', completed: currentStatus >= 6, active: currentStatus === 6, description: `On the way to ${dropoffAddress}` },
    { status: 'Delivered', time: progress >= 90 ? '2:35 PM' : '', completed: currentStatus >= 7 || pinVerified, active: currentStatus === 7 && !pinVerified, description: 'Confirmed with PIN code' },
  ];

  const verifyPin = async () => {
    if (enteredPin === order.delivery_pin) {
      setPinVerified(true);
      setPinError(false);
      
      // Mark as completed in backend/local
      if (orderId) {
        try {
          await OrderService.updateOrderStatus(orderId, 'completed');
        } catch (e) {
          console.error('Failed to mark order as completed upon PIN entry', e);
        }
      }
    } else {
      setPinError(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <span className="spinner spinner--lg" style={{ marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading live tracking data...</p>
      </div>
    );
  }

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
            <div id={mapId} className={styles.mapContainer} />
            {!leafletLoaded && <div className={styles.mapLabel}>Loading live tracking map...</div>}
          </div>

          {/* ETA Card */}
          <div className={styles.etaCard}>
            <div className={styles.etaIcon}>🚴</div>
            <div className={styles.etaInfo}>
              <div className={styles.etaStatus}>
                {progress < 25 && 'Rider heading to pickup'}
                {progress >= 25 && progress < 45 && 'Rider collecting package'}
                {progress >= 45 && progress < 90 && 'Rider en route to delivery'}
                {progress >= 90 && 'Rider arrived at destination'}
              </div>
              <div className={styles.etaTime}>
                Status: <strong>{order.estimated_delivery}</strong> (Simulation: {progress}%)
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
              <strong>Delivery PIN Code</strong>
            </div>
            {pinVerified ? (
              <div className="alert alert--success" style={{ margin: '12px 0' }}>
                ✅ <strong>Delivery Confirmed!</strong> Escrow funds released to rider.
              </div>
            ) : (
              <>
                <div className={styles.pinDigits}>
                  {order.delivery_pin.split('').map((d, i) => (
                    <div key={i} className={styles.pinDigit}>{d}</div>
                  ))}
                </div>
                {currentStatus === 7 ? (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: 'var(--text-xs)', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      <strong>Rider is here!</strong> Enter PIN below to confirm delivery:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <input
                        type="text"
                        placeholder="Enter 4-digit PIN"
                        className="input"
                        style={{ width: '130px', textAlign: 'center', fontSize: '14px', padding: '6px' }}
                        value={enteredPin}
                        onChange={(e) => setEnteredPin(e.target.value.slice(0, 4))}
                      />
                      <button className="btn btn--primary btn--sm" onClick={verifyPin}>
                        Verify
                      </button>
                    </div>
                    {pinError && (
                      <p style={{ color: 'var(--color-danger-500)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                        Incorrect PIN. Try again.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={styles.pinNote}>
                    Share this PIN with the rider to confirm delivery. Funds release only after PIN is verified.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Escrow Status */}
          {order.protection_level !== 'none' && (
            <div className={`escrow-status ${pinVerified ? 'escrow-status--released' : 'escrow-status--held'}`}>
              <span>🛡️</span>
              <div>
                <strong>{pinVerified ? 'Funds Released' : 'Funds held securely'}</strong>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                  {pinVerified
                    ? `$${order.pricing.total.toFixed(2)} transferred to rider Takudzwa M.`
                    : `$${order.pricing.total.toFixed(2)} held in escrow · Releases after PIN confirmation`}
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
                    <div
                      className={`timeline-dot ${
                        item.completed ? 'timeline-dot--completed' : item.active ? 'timeline-dot--active' : ''
                      }`}
                    />
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
            {!pinVerified && <button className="btn btn--danger btn--full btn--sm">Cancel order</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-6">
          <span className="spinner spinner--lg" />
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}
