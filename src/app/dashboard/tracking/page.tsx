'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { OrderService, BikerOrder } from '@/lib/order-service';
import { EcoCashService, EcoCashTransaction } from '@/lib/ecocash';
import { createClient } from '@/lib/supabase/client';
import styles from './tracking.module.css';

function TrackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('id');
  const launchEcoCash = searchParams.get('pay') === 'ecocash';
  const ecocashPhoneParam = searchParams.get('phone') || '';

  const [order, setOrder] = useState<BikerOrder | null>(null);
  const [liveOrder, setLiveOrder] = useState<BikerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Active Tab (mobile view)
  const [activeTab, setActiveTab] = useState<'map' | 'details'>('map');

  // EcoCash Simulator Overlay States
  const [showEcoCashOverlay, setShowEcoCashOverlay] = useState(false);
  const [isProcessingEcoCash, setIsProcessingEcoCash] = useState(false);
  const [ecocashPhone, setEcocashPhone] = useState(ecocashPhoneParam);
  const [ecocashTimer, setEcocashTimer] = useState(30);
  const [ecocashError, setEcocashError] = useState('');
  const [activeTxId, setActiveTxId] = useState<string | null>(null);

  // Escrow Verification PIN States
  const [verificationPin, setVerificationPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);

  // Simulation controls
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  
  // Map markers & state tracking
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  // Realtime subscription ref
  const subscriptionRef = useRef<any>(null);

  // Load Order Details
  useEffect(() => {
    if (!orderId) {
      setError('Missing order ID parameter');
      setLoading(false);
      return;
    }

    async function loadOrder() {
      try {
        const o = await OrderService.getOrderById(orderId);
        if (!o) {
          // If not found in DB or LocalStorage, try to load simulated mocks for visualization
          if (orderId.startsWith('mock-')) {
            const mockO: BikerOrder = {
              id: orderId,
              reference_code: 'BKR-MOCK-99',
              customer_id: 'mock-cust-123',
              service_type: 'send_item',
              fulfillment_mode: 'standard',
              protection_level: 'none',
              pickup_address: "Sam Levy's Village, Borrowdale",
              dropoff_address: 'Avondale Shops, Harare',
              status: 'rider_assigned',
              created_at: new Date().toISOString(),
              total_amount: 8.50,
              delivery_fee: 7.62,
              service_fee: 0.38,
              protection_fee: 0.50,
              payment_method: 'ecocash',
              syncStatus: 'synced',
              retryCount: 0
            };
            setOrder(mockO);
            setLiveOrder(mockO);
            setLoading(false);
            return;
          }
          setError('Order not found');
          setLoading(false);
          return;
        }

        setOrder(o);
        setLiveOrder(o);
        
        if (o.status === 'completed' || o.delivery_pin_verified) {
          setPinVerified(true);
        }

        // Set default EcoCash phone if empty
        if (!ecocashPhone && o.pickup_contact_phone) {
          setEcocashPhone(o.pickup_contact_phone);
        }

        // Auto trigger EcoCash checkout overlay if requested
        if (launchEcoCash && o.status === 'payment_pending') {
          triggerEcoCashUSSDPush(o, ecocashPhoneParam || o.pickup_contact_phone || '0771234567');
        }

        // Initialize rider location coordinates if rider is assigned
        if (o.assigned_rider_id) {
          setRiderLocation({
            lat: o.pickup_lat || -17.8292,
            lng: o.pickup_lng || 31.0522
          });
        }
      } catch (err: any) {
        setError(err.message || 'Error loading order');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId, launchEcoCash]);

  // Real-time tracking dispatcher and Supabase Realtime channel subscription
  useEffect(() => {
    if (!orderId || !OrderService.isOnline) return;

    const supabase = createClient();
    
    // Subscribe to updates for this order row
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_requests',
          filter: `id=eq.${orderId}`
        },
        async (payload) => {
          const fresh = await OrderService.getOrderById(orderId);
          if (fresh) {
            setLiveOrder(fresh);
            if (fresh.status === 'completed' || fresh.delivery_pin_verified) {
              setPinVerified(true);
            }
          }
          addSimulationLog(`⚡ Realtime DB Update: Status is now "${payload.new.status}"`);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Also listen to location updates of rider if assigned
    let locationChannel: any = null;
    if (liveOrder?.assigned_rider_id) {
      locationChannel = supabase
        .channel(`rider-location-${liveOrder.assigned_rider_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rider_location_checkpoints',
            filter: `rider_id=eq.${liveOrder.assigned_rider_id}`
          },
          (payload) => {
            const cp = payload.new;
            setRiderLocation({ lat: cp.lat, lng: cp.lng });
            addSimulationLog(`📍 Location Checkpoint received: [${cp.lat.toFixed(5)}, ${cp.lng.toFixed(5)}]`);
          }
        )
        .subscribe();
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (locationChannel) {
        supabase.removeChannel(locationChannel);
      }
    };
  }, [orderId, liveOrder?.assigned_rider_id]);

  // Simulated live matching engine ticker for developer sandbox / offline mode
  useEffect(() => {
    if (!liveOrder || liveOrder.status !== 'payment_held' || liveOrder.assigned_rider_id) return;
    
    // Auto-matchmaker simulation (takes 5 seconds in developer offline mode)
    addSimulationLog('🤖 Match Engine: Broadcast dispatching order offers to nearby riders...');
    
    const timer = setTimeout(async () => {
      addSimulationLog('🚴 Match Engine: Rider "Tinashe M." (Rating: 4.8★) accepted the offer.');
      
      const updated = {
        ...liveOrder,
        status: 'rider_assigned',
        assigned_rider_id: 'mock-rider-99',
        rider: {
          full_name: 'Tinashe M.',
          avatar_url: '',
          phone: '+263 77 482 9102'
        }
      };
      
      // Update locally
      await OrderService.updateOrderStatus(liveOrder.id, 'rider_assigned', 'Simulated matchmaker assigned Rider: Tinashe M.');
      setLiveOrder(updated);
      setRiderLocation({ lat: -17.8105, lng: 31.0620 }); // Heading toward pickup
      
      addSimulationLog('🟢 Status Changed: "Rider Assigned" (Tinashe M. is en route to pickup)');
    }, 6000);

    return () => clearTimeout(timer);
  }, [liveOrder?.status, liveOrder?.assigned_rider_id]);

  // Simulated rider en-route checkpoints tracker
  useEffect(() => {
    if (!liveOrder || liveOrder.status !== 'rider_assigned' || !riderLocation) return;

    // Simulate rider movement toward pickup point in 10s
    const moveTimer = setTimeout(async () => {
      addSimulationLog('🚴 Rider status: Arrived at Pickup Point.');
      const updated = {
        ...liveOrder,
        status: 'at_pickup'
      };
      await OrderService.updateOrderStatus(liveOrder.id, 'at_pickup', 'Rider arrived at pickup');
      setLiveOrder(updated);
      setRiderLocation({
        lat: liveOrder.pickup_lat || -17.8292,
        lng: liveOrder.pickup_lng || 31.0522
      });
      addSimulationLog('🟢 Status Changed: "At Pickup"');
    }, 12000);

    return () => clearTimeout(moveTimer);
  }, [liveOrder?.status]);

  // Helper to append developer/sandbox logs
  const addSimulationLog = (msg: string) => {
    setSimulationLogs(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 19)
    ]);
  };

  // ECO-CASH USSD PUSH INITIATION FLOW
  const triggerEcoCashUSSDPush = async (ord: BikerOrder, phone: string) => {
    setEcocashError('');
    setShowEcoCashOverlay(true);
    setEcocashTimer(30);
    
    addSimulationLog(`📱 Initiating EcoCash USSD Push request for ${phone}...`);
    
    try {
      const tx = await EcoCashService.initiatePayment(
        ord.id,
        phone,
        ord.total_amount || 5.00,
        ord.reference_code
      );
      setActiveTxId(tx.id);
      addSimulationLog(`📱 USSD Push prompt dispatched. TxRef: ${tx.id}. Status: Awaiting PIN.`);
    } catch (e: any) {
      setEcocashError(e.message || 'Failed to dispatch USSD Push prompt');
      addSimulationLog(`❌ EcoCash Error: ${e.message}`);
    }
  };

  // Simulated EcoCash Countdown timer
  useEffect(() => {
    if (!showEcoCashOverlay || ecocashTimer <= 0 || isProcessingEcoCash) return;
    
    const interval = setInterval(() => {
      setEcocashTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          handleEcoCashTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showEcoCashOverlay, ecocashTimer, isProcessingEcoCash]);

  const handleEcoCashTimeout = async () => {
    setEcocashError('USSD push transaction timed out. Please try booking again.');
    addSimulationLog('❌ EcoCash Error: Awaiting customer PIN authorization timed out.');
    if (activeTxId && order) {
      await EcoCashService.cancelPayment(order.id, activeTxId);
    }
  };

  const handleApprovePayment = async () => {
    if (!order || !activeTxId) return;
    setIsProcessingEcoCash(true);
    setEcocashError('');
    
    addSimulationLog('📱 Simulating Customer USSD PIN confirmation...');
    
    // Add 1.5s delay to make ledger writing visual
    setTimeout(async () => {
      try {
        const res = await EcoCashService.confirmPayment(order.id, activeTxId);
        if (res.success) {
          addSimulationLog('💸 Double-Entry Ledger updated: debited central gateway, credited customer escrow.');
          addSimulationLog('🔒 Payment Held: Funds secured in multi-sig escrow wallet.');
          
          const fresh = await OrderService.getOrderById(order.id);
          setLiveOrder(fresh);
          setShowEcoCashOverlay(false);
        } else {
          setEcocashError(res.error || 'Failed to process payment');
          addSimulationLog(`❌ Ledger Error: ${res.error}`);
        }
      } catch (err: any) {
        setEcocashError(err.message || 'Payment confirm error');
      } finally {
        setIsProcessingEcoCash(false);
      }
    }, 2000);
  };

  const handleDeclinePayment = async () => {
    if (!order || !activeTxId) return;
    setIsProcessingEcoCash(true);
    
    addSimulationLog('❌ Simulated Customer USSD PIN declined.');
    
    try {
      await EcoCashService.cancelPayment(order.id, activeTxId);
      await OrderService.updateOrderStatus(order.id, 'cancelled', 'EcoCash USSD payment declined by customer');
      
      const fresh = await OrderService.getOrderById(order.id);
      setLiveOrder(fresh);
      setShowEcoCashOverlay(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingEcoCash(false);
    }
  };

  // CLIENT RELEASE ESCROW VIA PIN CODE
  const handleVerifyEscrowReleasePin = async () => {
    if (!liveOrder || !verificationPin) return;
    setSubmittingPin(true);
    setPinError('');

    addSimulationLog(`🛡️ Verifying Escrow PIN handover for ${liveOrder.reference_code}...`);

    try {
      const res = await OrderService.verifyDeliveryPin(liveOrder.id, verificationPin);
      if (res.success) {
        setPinVerified(true);
        addSimulationLog('🔒 Escrow verification succeeded!');
        addSimulationLog('💸 Ledger updated: debited customer escrow, credited rider wallet.');
        
        const fresh = await OrderService.getOrderById(liveOrder.id);
        setLiveOrder(fresh);
      } else {
        setPinError(res.error || 'Invalid PIN code');
        addSimulationLog(`❌ Escrow Error: ${res.error}`);
      }
    } catch (e: any) {
      setPinError(e.message || 'Error releasing escrow');
    } finally {
      setSubmittingPin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (error || !liveOrder) {
    return (
      <div className="container max-w-lg p-6 text-center" style={{ marginTop: '10vh' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
        <h2 className="title" style={{ marginBottom: '10px' }}>Tracking Error</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error || 'Unable to trace this order'}</p>
        <Link href="/dashboard" className="btn btn--primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const order = liveOrder;

  // Compute Timeline Items based on current status
  const getTimeline = () => {
    const steps = [
      { status: 'booked', description: 'Order created', completed: true },
      { status: 'payment_held', description: 'EcoCash Escrow secured', completed: ['payment_held', 'rider_assigned', 'rider_en_route_pickup', 'at_pickup', 'en_route_delivery', 'at_delivery', 'completed'].includes(order.status) },
      { status: 'rider_assigned', description: 'Biker matched', completed: ['rider_assigned', 'rider_en_route_pickup', 'at_pickup', 'en_route_delivery', 'at_delivery', 'completed'].includes(order.status) },
      { status: 'at_pickup', description: 'Package picked up', completed: ['at_pickup', 'en_route_delivery', 'at_delivery', 'completed'].includes(order.status) },
      { status: 'at_delivery', description: 'Arrived at destination', completed: ['at_delivery', 'completed'].includes(order.status) },
      { status: 'completed', description: 'Funds released to Rider', completed: order.status === 'completed' }
    ];
    
    // For cash orders, skip the payment_held state or adjust names
    if (order.payment_method === 'cash') {
      steps[1] = { status: 'payment_held', description: 'COD Cash Collection confirmed', completed: order.status === 'completed' };
    }
    
    return steps;
  };

  const timeline = getTimeline();

  return (
    <div className={`container ${styles.page}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard" className="btn btn--secondary btn--sm">
            ←
          </Link>
          <div>
            <h1 className={styles.title}>Track Package</h1>
            <span className={styles.refCode}>{order.reference_code}</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className="badge badge--success" style={{ textTransform: 'capitalize' }}>
            {order.status.replace(/_/g, ' ')}
          </span>
          {order.syncStatus !== 'synced' && (
            <span className="badge badge--warning">Syncing...</span>
          )}
        </div>
      </div>

      {/* Tabs for mobile */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'map' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('map')}
        >
          📍 Map Tracker
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('details')}
        >
          📋 Details
        </button>
      </div>

      <div className={styles.content}>
        {/* Left Column: Map Tracker (Dynamic) */}
        <div className={`${styles.mapArea} ${activeTab === 'map' ? styles.mapAreaVisible : ''}`}>
          <div className={styles.mapPlaceholder}>
            {/* Visual simulation mapping grids */}
            <div className={styles.mapContainer}>
              {/* Harare Simulated Vector Map grid lines */}
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.15 }}>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--text-primary)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Pickup Marker */}
            <div className={styles.mapDotPickup} title="Pickup Point">🏪</div>

            {/* Rider Vector Marker */}
            {riderLocation && (
              <div 
                className={styles.mapDotRider}
                style={{
                  top: `${45 + (riderLocation.lat + 17.8292) * 500}%`,
                  left: `${45 + (riderLocation.lng - 31.0522) * 500}%`,
                  transition: 'all 2s ease-in-out'
                }}
                title="Your Biker Rider"
              >
                🏍️
              </div>
            )}

            {/* Dropoff Marker */}
            <div className={styles.mapDotDropoff} title="Dropoff Destination">🏠</div>

            <div className={styles.mapLabel}>
              Harare Metro Dispatch Grid Map (Simulated)
            </div>
          </div>

          {/* Real-time simulation log ticker for transparency */}
          <div className="card p-4" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Developer Console Log
              </h4>
              <span className="badge badge--primary btn--xs">SANDBOX</span>
            </div>
            
            <div style={{
              height: '90px',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              padding: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              {simulationLogs.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Awaiting system events...</div>
              ) : (
                simulationLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '2px' }}>{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Information & Controls Panel */}
        <div className={`${styles.infoPanel} ${activeTab === 'details' ? styles.infoPanelVisible : ''}`}>
          
          {/* EcoCash Payment Held Banner/Action */}
          {order.status === 'payment_pending' && (
            <div className="alert alert--warning" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700 }}>⚠️ Awaiting payment validation</div>
              <p style={{ fontSize: '12px' }}>
                Your order is currently pending payment. Confirm the EcoCash push request on your phone.
              </p>
              <button 
                className="btn btn--primary btn--sm" 
                onClick={() => triggerEcoCashUSSDPush(order, ecocashPhone || '0771234567')}
              >
                Open USSD Push Simulator
              </button>
            </div>
          )}

          {/* Delivery Release PIN Verification Card (Customer View) */}
          {order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'payment_pending' && (
            <div className={styles.pinCard}>
              <div className={styles.pinHeader}>
                <span>🔒 Secure Escrow PIN</span>
              </div>
              
              <div className={styles.pinDigits}>
                {String(order.delivery_pin || '----').split('').map((char, i) => (
                  <div key={i} className={styles.pinDigit}>{char}</div>
                ))}
              </div>

              <p className={styles.pinNote}>
                {order.payment_method === 'cash' 
                  ? 'Give this 4-digit code to the rider only after they verify cash collection.' 
                  : 'Give this 4-digit verification code to the rider upon receipt to release escrow funds.'}
              </p>

              {/* Developer Bypass simulation shortcut */}
              <div className="divider" style={{ margin: '16px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  🧑‍💻 Developer Escrow Release Simulator:
                </div>
                <input 
                  type="text" 
                  maxLength={6} 
                  className="input" 
                  placeholder="Enter PIN to complete delivery"
                  value={verificationPin}
                  onChange={(e) => setVerificationPin(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '14px', fontFamily: 'var(--font-mono)', height: '36px' }}
                />
                
                {pinError && (
                  <div className="alert alert--danger" style={{ fontSize: '11px', padding: '6px' }}>
                    ⚠️ {pinError}
                  </div>
                )}
                
                <button 
                  className="btn btn--success btn--full btn--sm"
                  onClick={handleVerifyEscrowReleasePin}
                  disabled={submittingPin || !verificationPin}
                >
                  {submittingPin ? 'Releasing Escrow...' : 'Release Escrow Funds'}
                </button>
              </div>
            </div>
          )}

          {/* Rider profile card */}
          {order.assigned_rider_id && (
            <div className={styles.riderCard}>
              <div className={styles.riderInfo}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '1.2rem' }}>
                  🚴
                </div>
                <div>
                  <div className={styles.riderName}>{order.rider?.full_name || 'Tinashe M.'}</div>
                  <div className={styles.riderMeta}>
                    <span>⭐ 4.8</span>
                    <span>•</span>
                    <span className={styles.riderVehicle}>{order.rider?.phone || '+263 77 482 9102'}</span>
                  </div>
                </div>
              </div>

              <div className={styles.riderActions}>
                <a href={`tel:${order.rider?.phone || ''}`} className="btn btn--secondary btn--sm font-medium">📞 Call Rider</a>
                <button className="btn btn--secondary btn--sm font-medium">💬 Message</button>
              </div>
            </div>
          )}

          {/* Route details */}
          <div className={styles.routeCard}>
            <div className={styles.routePoint}>
              <div className={styles.routeDot} style={{ background: 'var(--color-primary-500)' }} />
              <div>
                <div className={styles.routeLabel}>PICKUP FROM</div>
                <div className={styles.routeAddress}>{order.pickup_address}</div>
                {order.pickup_contact_name && (
                  <div className={styles.routeNote}>
                    Contact: {order.pickup_contact_name} ({order.pickup_contact_phone})
                  </div>
                )}
              </div>
            </div>

            <div className={styles.routeLine} />

            <div className={styles.routePoint}>
              <div className={styles.routeDot} style={{ background: '#ec4899' }} />
              <div>
                <div className={styles.routeLabel}>DELIVER TO</div>
                <div className={styles.routeAddress}>{order.dropoff_address}</div>
                {order.dropoff_contact_name && (
                  <div className={styles.routeNote}>
                    Contact: {order.dropoff_contact_name} ({order.dropoff_contact_phone})
                  </div>
                )}
                {order.dropoff_gate_color && (
                  <div className={styles.routeNote} style={{ fontWeight: 600 }}>
                    Gate description: {order.dropoff_gate_color}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className={styles.timelineSection}>
            <div className={styles.timelineTitle}>Tracking History</div>
            <div className="timeline">
              {timeline.map((item, i) => (
                <div key={i} className={`timeline-item ${item.completed ? 'timeline-item--completed' : ''}`}>
                  <div className="timeline-badge-container">
                    <div 
                      className={`timeline-badge ${item.completed ? 'timeline-badge--completed' : ''}`} 
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
            {!pinVerified && liveOrder?.status !== 'cancelled' && (
              <button 
                className="btn btn--danger btn--full btn--sm"
                onClick={async () => {
                  if (!liveOrder) return;
                  if (confirm('Are you sure you want to cancel this order?')) {
                    setLoading(true);
                    await OrderService.updateOrderStatus(liveOrder.id, 'cancelled', 'Order cancelled by customer');
                    const fresh = await OrderService.getOrderById(liveOrder.id);
                    setLiveOrder(fresh);
                    setLoading(false);
                  }
                }}
              >
                Cancel order
              </button>
            )}
          </div>
        </div>
      </div>

      {showEcoCashOverlay && (
        <div className={styles.ecocashOverlay}>
          <div className={styles.ecocashModal}>
            <div className={styles.ecocashHeader}>
              <div className={styles.ecocashBrandIcon}>📱</div>
              <div>
                <div className={styles.ecocashTitle}>EcoCash Payment</div>
                <div className={styles.ecocashSubtitle}>USSD Push Notification Simulator</div>
              </div>
            </div>
            
            <div className={styles.ecocashBody}>
              <div className={styles.ecocashSandboxBadge}>DEVELOPER SANDBOX</div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.4' }}>
                A simulated USSD push prompt has been broadcasted to the customer's mobile device:
              </p>
              
              <div className={styles.ecocashDetails}>
                <div className={styles.ecocashDetailRow}>
                  <span className={styles.ecocashDetailLabel}>Phone Number:</span>
                  <span className={styles.ecocashDetailValue}>{ecocashPhone}</span>
                </div>
                <div className={styles.ecocashDetailRow}>
                  <span className={styles.ecocashDetailLabel}>Amount Due:</span>
                  <span className={styles.ecocashDetailValue}>${order.pricing.total.toFixed(2)} USD</span>
                </div>
                <div className={styles.ecocashDetailRow}>
                  <span className={styles.ecocashDetailLabel}>Reference Code:</span>
                  <span className={styles.ecocashDetailValue} style={{ fontFamily: 'var(--font-mono)' }}>{order.reference_code}</span>
                </div>
              </div>
              
              <div className={styles.ecocashStatusBox}>
                {isProcessingEcoCash ? (
                  <>
                    <div className="spinner spinner--md" style={{ color: 'var(--color-primary-500)' }} />
                    <div className={styles.ecocashStatusTitle} style={{ marginTop: '8px' }}>Processing Ledger Updates...</div>
                  </>
                ) : (
                  <>
                    <div className={styles.ecocashTimer}>{ecocashTimer}s</div>
                    <div className={styles.ecocashStatusTitle}>Awaiting USSD PIN authorization...</div>
                    <p className={styles.ecocashStatusDesc}>Please approve the EcoCash push prompt on the simulator device below</p>
                  </>
                )}
              </div>
              
              {ecocashError && (
                <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px' }}>
                  ⚠️ {ecocashError}
                </div>
              )}
            </div>
            
            <div className={styles.ecocashActions}>
              <button 
                className="btn btn--primary btn--full"
                onClick={handleApprovePayment}
                disabled={isProcessingEcoCash}
              >
                {isProcessingEcoCash ? 'Please wait...' : 'Approve Simulated Payment'}
              </button>
              <button 
                className="btn btn--secondary btn--full"
                onClick={handleDeclinePayment}
                disabled={isProcessingEcoCash}
              >
                Decline & Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
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
