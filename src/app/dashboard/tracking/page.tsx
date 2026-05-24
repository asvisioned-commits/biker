'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';
import { createClient } from '@/lib/supabase/client';
import LiveTrackingMap, { NearbyRider } from '@/components/map/LiveTrackingMap';
import { FLAGS } from '@/lib/flags';
import styles from './tracking.module.css';

// Active delivery interface
interface ActiveDelivery {
  id: string;
  reference_code: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  service_type: string;
  delivery_fee: number;
  insurance_fee: number;
  total_amount: number;
  fulfillment_mode: string;
  protection_level: string;
  payment_method: string;
  item_description: string;
  status: string;
  assigned_rider_id?: string | null;
  created_at: string;
  verification_pin?: string;
  dispute_filed?: boolean;
  dispute_reason?: string;
  dispute_status?: string;
}

const MOCK_NEARBY_RIDERS: NearbyRider[] = [
  { id: 'nr-1', lat: -17.8210, lng: 31.0560, name: 'Blessing M.' },
  { id: 'nr-2', lat: -17.8340, lng: 31.0420, name: 'Tatenda K.' },
  { id: 'nr-3', lat: -17.8150, lng: 31.0630, name: 'Gift C.' },
];

export default function TrackingPage() {
  const router = useRouter();
  const { session, country } = useProfile();
  const userId = session?.user_id;

  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [simulating, setSimulating] = useState(false);
  
  // simulated rider path tracking
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);
  const [riderHeading, setRiderHeading] = useState<number | null>(null);
  const [nearbyRiders, setNearbyRiders] = useState<NearbyRider[] | null>(null);

  // dispute popup logic
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeMessage, setDisputeMessage] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // USSD payment simulator
  const [ussdSimStatus, setUssdSimStatus] = useState<'idle' | 'triggered' | 'paying' | 'success' | 'failed'>('idle');
  const [selectedMobileOperator, setSelectedMobileOperator] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);
  const simulatedLogsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (simulatedLogsEndRef.current) {
      simulatedLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatedLogs]);

  const addSimLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSimulatedLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  const getRiderInfo = () => {
    if (delivery?.assigned_rider_id === 'mock-rider-id') {
      return {
        full_name: 'Farai Moyo',
        rating: 4.9,
        motorcycle: 'Yamaha Crux 110 (AEE-4392)',
        phone: '+263 77 123 4567',
        avatar_url: null,
      };
    }
    return {
      full_name: 'Farai Moyo',
      rating: 4.9,
      motorcycle: 'Yamaha Crux 110 (AEE-4392)',
      phone: '+263 77 123 4567',
      avatar_url: null,
    };
  };

  const fetchActiveDelivery = async () => {
    if (!FLAGS.useLiveDb) {
      // Mock tracking state
      const mockDelivery: ActiveDelivery = {
        id: 'mock-del-123',
        reference_code: 'BKR-M8T5V3',
        pickup_address: "Sam Levy's Village, Borrowdale",
        pickup_lat: -17.7502,
        pickup_lng: 31.0858,
        dropoff_address: 'Avondale Shops, King George Rd',
        dropoff_lat: -17.7994,
        dropoff_lng: 31.0378,
        estimated_distance_km: 7.2,
        estimated_duration_minutes: 18,
        service_type: 'send_item',
        delivery_fee: 4.80,
        insurance_fee: 0.50,
        total_amount: 5.30,
        fulfillment_mode: 'standard',
        protection_level: 'protected',
        payment_method: 'wallet',
        item_description: 'Business documents package',
        status: 'searching',
        created_at: new Date().toISOString(),
        verification_pin: '4932',
      };
      setDelivery(mockDelivery);
      setNearbyRiders(MOCK_NEARBY_RIDERS);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const currentId = userId || 'mock-customer';
      const { data, error } = await supabase
        .from('delivery_requests')
        .select('*')
        .eq('customer_id', currentId)
        .in('status', ['searching', 'payment_pending', 'rider_assigned', 'at_pickup', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setDelivery(data[0] as ActiveDelivery);
        if (data[0].status === 'searching') {
          // Add nearby riders for visual pulsing radar search
          setNearbyRiders(country === 'ZM' ? [
            { id: 'nr-zm-1', lat: -15.3920, lng: 28.3100, name: 'Bwalya M.' },
            { id: 'nr-zm-2', lat: -15.3850, lng: 28.3280, name: 'Chanda K.' }
          ] : MOCK_NEARBY_RIDERS);
        } else {
          setNearbyRiders([]);
        }
      } else {
        setDelivery(null);
      }
    } catch (err) {
      console.error('Failed to load tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveDelivery();
  }, [userId, country]);

  // Real-time tracking channel subscriptions
  useEffect(() => {
    if (!userId || !FLAGS.useLiveDb || !delivery) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`delivery-tracking-${delivery.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_requests',
          filter: `id=eq.${delivery.id}`,
        },
        (payload) => {
          const updated = payload.new as ActiveDelivery;
          setDelivery(updated);
          
          if (updated.status === 'completed') {
            alert('Your biker completed the delivery safely! Payout escrow released.');
            router.push('/dashboard');
          }
          if (updated.status === 'cancelled') {
            alert('This delivery has been cancelled.');
            setDelivery(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, delivery?.id]);

  // Simulate rider heading towards pickup & dropoff
  useEffect(() => {
    if (!delivery || !delivery.assigned_rider_id) {
      setRiderCoords(null);
      setRiderHeading(null);
      return;
    }

    let intervalId: any;
    let step = 0;
    const totalSteps = 20;

    const startLat = delivery.pickup_lat + 0.015;
    const startLng = delivery.pickup_lng - 0.015;

    const runSimulation = () => {
      intervalId = setInterval(() => {
        step++;
        if (step <= 10) {
          // Heading to pickup point
          const t = step / 10;
          const lat = startLat + (delivery.pickup_lat - startLat) * t;
          const lng = startLng + (delivery.pickup_lng - startLng) * t;
          setRiderCoords([lat, lng]);
          setRiderHeading(45); // approximate angle
          
          if (step === 10 && FLAGS.useLiveDb) {
            updateLiveStatus('at_pickup');
          }
        } else if (step <= 20) {
          // Heading to dropoff point
          const t = (step - 10) / 10;
          const lat = delivery.pickup_lat + (delivery.dropoff_lat - delivery.pickup_lat) * t;
          const lng = delivery.pickup_lng + (delivery.dropoff_lng - delivery.pickup_lng) * t;
          setRiderCoords([lat, lng]);
          setRiderHeading(135);
          
          if (step === 11 && FLAGS.useLiveDb) {
            updateLiveStatus('in_transit');
          }

          if (step === 20) {
            clearInterval(intervalId);
            setRiderHeading(null);
            // End simulation, wait for client verification PIN entry
          }
        }
      }, 4000);
    };

    if (simulating) {
      runSimulation();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [delivery?.id, delivery?.assigned_rider_id, simulating]);

  const updateLiveStatus = async (status: string) => {
    if (!delivery || !FLAGS.useLiveDb) return;
    try {
      const supabase = createClient();
      await supabase
        .from('delivery_requests')
        .update({ status })
        .eq('id', delivery.id);
    } catch {}
  };

  const handleCancelDelivery = async () => {
    if (!delivery) return;
    const confirm = window.confirm('Are you sure you want to cancel this delivery request? Any held wallet balance will be refunded.');
    if (!confirm) return;

    setCancelling(true);
    
    if (!FLAGS.useLiveDb) {
      setTimeout(() => {
        setDelivery(null);
        setCancelling(false);
        alert('Booking request cancelled successfully.');
      }, 1000);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('delivery_requests')
        .update({ status: 'cancelled' })
        .eq('id', delivery.id);

      if (error) throw error;
      alert('Request cancelled successfully.');
      setDelivery(null);
    } catch (err: any) {
      console.error(err);
      alert('Cancellation failed: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleTriggerUssdPush = () => {
    if (!phoneNumber || !selectedMobileOperator) {
      alert('Please fill operator and phone details for sandbox USSD push');
      return;
    }

    setUssdSimStatus('triggered');
    setSimulatedLogs([]);
    addSimLog(`Initiating billing flow for ${selectedMobileOperator} account: ${phoneNumber}`);
    addSimLog(`Sending C2B push notification trigger request to network switch...`);

    // Stage 1: Trigger network
    setTimeout(() => {
      setUssdSimStatus('paying');
      addSimLog(`Network responded: Switch handshake established successfully.`);
      addSimLog(`[USSD STK Push] Sent payload challenge to device — Awaiting PIN confirmation...`);
    }, 1500);

    // Stage 2: Prompt payment confirmation simulation
    setTimeout(async () => {
      addSimLog(`Rider escrow balance successfully settled. PIN confirmation returned by operator.`);
      setUssdSimStatus('success');

      if (FLAGS.useLiveDb && delivery) {
        try {
          const supabase = createClient();
          await supabase
            .from('delivery_requests')
            .update({ status: 'searching' })
            .eq('id', delivery.id);
          
          setDelivery(prev => prev ? { ...prev, status: 'searching' } : null);
        } catch (err) {
          console.error(err);
        }
      } else {
        setDelivery(prev => prev ? { ...prev, status: 'searching' } : null);
      }
    }, 4500);
  };

  const handleSOSAlert = () => {
    const rName = getRiderInfo().full_name;
    const msg = `🚨 SOS CRITICAL ALERT: Platform dispatchers and security teams have been notified of emergency status for Biker trip ${delivery?.reference_code}. Rider (${rName}) GPS coordinates are locked. Emergency support details will be sent via SMS.`;
    alert(msg);
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason) {
      alert('Please state the nature or reason of your dispute request.');
      return;
    }

    setDisputeSubmitting(true);

    if (!FLAGS.useLiveDb) {
      setTimeout(() => {
        setDisputeSubmitting(false);
        setShowDisputeModal(false);
        setDelivery(prev => prev ? { ...prev, dispute_filed: true, dispute_reason: disputeReason, dispute_status: 'review_pending' } : null);
        alert('Dispute successfully filed. Escalating escrow hold to platform admins.');
      }, 1000);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('delivery_requests')
        .update({
          dispute_filed: true,
          dispute_reason: disputeReason,
          dispute_status: 'review_pending'
        })
        .eq('id', delivery?.id);

      if (error) throw error;
      alert('Dispute successfully filed. Escalating escrow hold to platform admins.');
      setShowDisputeModal(false);
      setDelivery(prev => prev ? { ...prev, dispute_filed: true, dispute_reason: disputeReason, dispute_status: 'review_pending' } : null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to register dispute. Please retry: ' + err.message);
    } finally {
      setDisputeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <span className="spinner" />
        <p>Loading interactive tracking center...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className={styles.noActiveContainer}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🏍️</div>
        <h2>No Active Deliveries</h2>
        <p>Book a local biker to transport items or buy items dynamically.</p>
        <Link href="/dashboard/order/new" className="btn btn--primary btn--lg" style={{ marginTop: '1rem' }}>
          Book a Biker Now
        </Link>
      </div>
    );
  }

  const formatPrice = (val: number) => {
    if (country === 'ZM') {
      return `ZK ${(val * 25).toFixed(0)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const rider = getRiderInfo();

  return (
    <div className={styles.page}>
      
      {/* Tracking Map first booking frame */}
      <div className={styles.mapGrid}>
        
        {/* Radar tracking map component */}
        <div className={styles.mapFrame}>
          <LiveTrackingMap
            pickupCoords={[delivery.pickup_lat, delivery.pickup_lng]}
            dropoffCoords={[delivery.dropoff_lat, delivery.dropoff_lng]}
            riderCoords={riderCoords}
            riderHeading={riderHeading}
            riderName={rider.full_name}
            nearbyRiders={nearbyRiders}
            className={styles.leafletTrackingMap}
          />
        </div>

        {/* Tracking control cards */}
        <div className={styles.sidebar}>
          
          {/* Main trip state card */}
          <div className={styles.statusCard}>
            <div className={styles.statusHeader}>
              <div>
                <span className={styles.statusLabel}>REF CODE</span>
                <h2 className={styles.refCode}>{delivery.reference_code}</h2>
              </div>
              <div className={`${styles.statusBadge} ${styles[`status_${delivery.status}`]}`}>
                {delivery.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>

            {/* Pulsing Match Overlay for searching state */}
            {delivery.status === 'searching' && (
              <div className={styles.radarMatchContainer}>
                <div className={styles.radarPulsingRing} />
                <div className={styles.radarWaveLine} />
                <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem', zIndex: 1 }}>📡</span>
                <strong>Pulsing Dispatch Radar...</strong>
                <p>Matching your request with nearest regional bikers. Keep map active.</p>
                <button
                  onClick={() => {
                    // Sandbox instant assign simulation
                    if (FLAGS.useLiveDb) {
                      updateLiveStatus('rider_assigned');
                      setDelivery(prev => prev ? { ...prev, status: 'rider_assigned', assigned_rider_id: 'mock-rider-id' } : null);
                    } else {
                      setDelivery(prev => prev ? { ...prev, status: 'rider_assigned', assigned_rider_id: 'mock-rider-id' } : null);
                    }
                    setSimulating(true);
                  }}
                  className="btn btn--secondary btn--sm"
                  style={{ marginTop: '0.75rem', zIndex: 1 }}
                >
                  [Sandbox Mode] Instant Rider Assign
                </button>
              </div>
            )}

            {/* Cash Payment Pending Box */}
            {delivery.status === 'payment_pending' && (
              <div className={styles.ussdTriggerContainer}>
                <span>🔐 Escrow Lock</span>
                <h4>Payment Pre-authorization Required</h4>
                <p>
                  To secure Biker Protect escrow payouts, you must authorize mobile money payment via your operator.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  <select
                    className="input"
                    value={selectedMobileOperator}
                    onChange={(e) => setSelectedMobileOperator(e.target.value)}
                    style={{ fontSize: '13px', height: '36px' }}
                  >
                    <option value="">Select Mobile Money Operator</option>
                    {country === 'ZM' ? (
                      <>
                        <option value="mtn_zambia">MTN Mobile Money Zambia</option>
                        <option value="airtel_zambia">Airtel Money Zambia</option>
                        <option value="zamtel_zambia">Zamtel Kwacha</option>
                      </>
                    ) : (
                      <>
                        <option value="ecocash_zim">EcoCash Zimbabwe</option>
                        <option value="onemoney_zim">OneMoney NetOne</option>
                        <option value="telecash_zim">Telecash Telecel</option>
                      </>
                    )}
                  </select>

                  <input
                    type="tel"
                    className="input"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +263 77 000 0000"
                    style={{ fontSize: '13px', height: '36px' }}
                  />

                  {ussdSimStatus === 'idle' && (
                    <button onClick={handleTriggerUssdPush} className="btn btn--primary btn--md">
                      Send USSD pre-auth push
                    </button>
                  )}

                  {/* Pre-auth progress bar */}
                  {ussdSimStatus === 'triggered' && (
                    <div style={{ textAlign: 'center', padding: '6px' }}>
                      <span className="spinner" style={{ marginRight: '6px' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pre-authorizing network...</span>
                    </div>
                  )}

                  {ussdSimStatus === 'paying' && (
                    <div style={{ textAlign: 'center', padding: '6px' }}>
                      <div className={styles.preAuthProgress}>
                        <div className={styles.preAuthProgressFill} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                        STK Push payload challenge sent to device. Awaiting operator PIN...
                      </span>
                    </div>
                  )}

                  {ussdSimStatus === 'success' && (
                    <div style={{ color: 'var(--color-success-600)', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>
                      ✅ Pre-auth Success! Escrow locked. Starting rider dispatch.
                    </div>
                  )}
                </div>

                {simulatedLogs.length > 0 && (
                  <div className={styles.ussdLogTerminal}>
                    <div className={styles.terminalHeader}>
                      <span>CONSOLE LOGGER</span>
                    </div>
                    <div className={styles.terminalBody}>
                      {simulatedLogs.map((log, index) => (
                        <div key={index} className={styles.logLine}>{log}</div>
                      ))}
                      <div ref={simulatedLogsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rider profile if assigned */}
            {delivery.assigned_rider_id && (
              <div className={styles.riderCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={styles.riderAvatar}>
                    {rider.full_name[0]}
                  </div>
                  <div>
                    <h3 className={styles.riderName}>{rider.full_name}</h3>
                    <div className={styles.riderRate}>⭐ {rider.rating}</div>
                  </div>
                  <a href={`tel:${rider.phone}`} className={styles.phoneBtn}>📞 Call</a>
                </div>
                
                <div className={styles.vehicleDetails}>
                  <p><strong>Motorcycle:</strong> {rider.motorcycle}</p>
                </div>

                {/* Safety quiz overlay / SOS emergency switch */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button onClick={handleSOSAlert} className={`${styles.bottomControlBtn} ${styles.sosBtn}`}>
                    ⚠️ Trigger SOS Alert
                  </button>
                  {delivery.dispute_filed ? (
                    <div className={styles.disputeStatusLabel}>
                      ⚖️ Escrow Held: Dispute Registered
                    </div>
                  ) : (
                    <button onClick={() => setShowDisputeModal(true)} className={`${styles.bottomControlBtn} ${styles.disputeBtn}`}>
                      🛡️ File Escrow Dispute
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Trip endpoints */}
            <div className={styles.routeDetails}>
              <div className={styles.endpoint}>
                <span className={styles.endpointDot} data-type="pickup" />
                <div>
                  <span className={styles.endpointLabel}>PICKUP</span>
                  <p className={styles.endpointAddr}>{delivery.pickup_address}</p>
                </div>
              </div>

              <div className={styles.endpoint}>
                <span className={styles.endpointDot} data-type="dropoff" />
                <div>
                  <span className={styles.endpointLabel}>DROPOFF</span>
                  <p className={styles.endpointAddr}>{delivery.dropoff_address}</p>
                </div>
              </div>
            </div>

            {/* Details & Pin */}
            <div className={styles.tripMetaGrid}>
              <div>
                <span className={styles.metaLabel}>Fulfillment</span>
                <p className={styles.metaVal}>{delivery.fulfillment_mode.toUpperCase()}</p>
              </div>
              <div>
                <span className={styles.metaLabel}>Protection</span>
                <p className={styles.metaVal}>{delivery.protection_level.toUpperCase()}</p>
              </div>
              <div>
                <span className={styles.metaLabel}>Distance</span>
                <p className={styles.metaVal}>{delivery.estimated_distance_km} km</p>
              </div>
              <div>
                <span className={styles.metaLabel}>Total Payout</span>
                <p className={styles.metaVal} style={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
                  {formatPrice(delivery.total_amount)}
                </p>
              </div>
            </div>

            {/* Item description */}
            <div className={styles.itemBox}>
              <span className={styles.metaLabel}>Delivering Parcel:</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 600 }}>{delivery.item_description}</p>
            </div>

            {/* PIN release instructions */}
            {delivery.status !== 'searching' && delivery.status !== 'payment_pending' && (
              <div className={styles.pinBox}>
                <div style={{ flex: 1 }}>
                  <h4>Verification PIN</h4>
                  <p>Provide this 4-digit PIN to the rider only after package inspection at dropoff to release escrow.</p>
                </div>
                <div className={styles.pinCode}>{delivery.verification_pin || '----'}</div>
              </div>
            )}

            {/* Actions */}
            {delivery.status === 'searching' && (
              <button
                onClick={handleCancelDelivery}
                className="btn btn--secondary btn--lg"
                style={{ width: '100%', marginTop: '16px' }}
                disabled={cancelling}
              >
                {cancelling ? <span className="spinner" /> : 'Cancel Delivery Booking'}
              </button>
            )}

            {/* Simulation Dispatch Tool */}
            {delivery.assigned_rider_id && !simulating && (
              <div className={styles.simDispatchPanel}>
                <h4>Sandbox simulation dispatcher</h4>
                <p>Simulate the biker driving live on the map from pickup to dropoff.</p>
                <button
                  onClick={() => setSimulating(true)}
                  className="btn btn--primary btn--md"
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  🚀 Run GPS simulation
                </button>
              </div>
            )}

            {simulating && (
              <div className={styles.simDispatchPanel}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="animate-pulse" style={{ color: 'var(--color-success-500)' }}>●</span>
                  GPS Simulator active...
                </h4>
                <p>Biker is currently driving on routing path. Watch the map live.</p>
                
                {/* Visual simulator controls for verification validation */}
                <button
                  onClick={async () => {
                    setSimulating(false);
                    setRiderCoords([delivery.dropoff_lat, delivery.dropoff_lng]);
                    
                    if (FLAGS.useLiveDb) {
                      try {
                        const supabase = createClient();
                        await supabase
                          .from('delivery_requests')
                          .update({ status: 'completed' })
                          .eq('id', delivery.id);
                        setDelivery(prev => prev ? { ...prev, status: 'completed' } : null);
                        alert('Pre-simulation complete. Escape lock validation approved.');
                        router.push('/dashboard');
                      } catch {}
                    } else {
                      setDelivery(prev => prev ? { ...prev, status: 'completed' } : null);
                      alert('Pre-simulation complete. Escape lock validation approved.');
                      router.push('/dashboard');
                    }
                  }}
                  className="btn btn--secondary btn--sm"
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  [Sandbox Mode] Auto Complete Trip
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Escrow dispute Modal */}
      {showDisputeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>File Escrow Dispute</h3>
              <button onClick={() => setShowDisputeModal(false)} className={styles.modalClose}>×</button>
            </div>
            <form onSubmit={handleFileDispute}>
              <div className={styles.modalBody}>
                <p>
                  Filing a dispute pauses the release of Biker Protect escrow payouts to the rider. The platform administration will inspect and mediate.
                </p>
                <div style={{ marginTop: '8px' }}>
                  <label className="label">Reason for Dispute</label>
                  <textarea
                    className="input"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="e.g. Package damaged during transit, rider demanded extra cash, rider did not arrive..."
                    rows={4}
                    required
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="btn btn--secondary btn--md"
                  disabled={disputeSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary btn--md"
                  disabled={disputeSubmitting}
                >
                  {disputeSubmitting ? 'Registering hold...' : 'Escalate Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
