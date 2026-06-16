'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderService, BikerOrder } from '@/lib/order-service';
import { getProfile, insertLocationCheckpoint } from '@/lib/database';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useProfile } from '@/context/ProfileContext';
import { CallSimulator } from '@/components/CallSimulator';
import { ChatDrawer } from '@/components/ChatDrawer';
import LiveTrackingMap from '@/components/map/LiveTrackingMap';
import PhotoProofUploader from '@/components/PhotoProofUploader';
import ReceiptOcrUploader from '@/components/ReceiptOcrUploader';
import QrPinModal from '@/components/QrPinModal';
import PremiumIcon from '@/components/primitives/PremiumIcon';


// Haversine distance helper (in kilometers)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export default function ActiveOrderRiderPage() {
  const router = useRouter();
  const [order, setOrder] = useState<BikerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  
  // Geolocation & Realtime tracking states
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);
  const [riderHeading, setRiderHeading] = useState<number | null>(null);
  
  // COD properties
  const [pinCode, setPinCode] = useState('');
  const [cashCollected, setCashCollected] = useState('');
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Stored base64 photo proofs
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState<string | null>(null);

  // Safety & Secure Communication
  const { session, country } = useProfile();
  const [showCallSimulator, setShowCallSimulator] = useState(false);
  const [isQrPinOpen, setIsQrPinOpen] = useState(false);

  const formatPrice = (usdVal: number) => {
    if (country === 'ZM') {
      return `ZK ${(usdVal * 25).toFixed(2)}`;
    }
    return `$${usdVal.toFixed(2)}`;
  };
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showTransitCheckinTimer, setShowTransitCheckinTimer] = useState(false);
  const [checkinCountdown, setCheckinCountdown] = useState(10);
  const [hasPromptedCheckin, setHasPromptedCheckin] = useState(false);

  // Transit check-in trigger
  useEffect(() => {
    if (order?.status === 'en_route_delivery' && !hasPromptedCheckin) {
      setShowTransitCheckinTimer(true);
      setCheckinCountdown(10);
      setHasPromptedCheckin(true);
    } else if (order?.status !== 'en_route_delivery') {
      setHasPromptedCheckin(false);
    }
  }, [order?.status, hasPromptedCheckin]);

  // Transit check-in countdown timer
  useEffect(() => {
    if (!showTransitCheckinTimer) return;
    if (checkinCountdown <= 0) {
      handleMissedCheckin();
      setShowTransitCheckinTimer(false);
      return;
    }
    const interval = setInterval(() => {
      setCheckinCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [showTransitCheckinTimer, checkinCountdown]);

  // Geolocation watch and Realtime coordinates broadcasting
  useEffect(() => {
    if (!order || !['rider_en_route_pickup', 'en_route_delivery'].includes(order.status)) {
      setRiderCoords(null);
      setRiderHeading(null);
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      return;
    }

    const supabase = createClient();
    const locationChannel = supabase.channel(`rider-location-${order.id}`);

    locationChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to broadcast rider location channel');
      }
    });

    let lastCheckpointTime = 0;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const currentCoords: [number, number] = [latitude, longitude];
        
        setRiderCoords(currentCoords);
        setRiderHeading(heading);

        // Automatic Geofencing
        const distanceToPickup = order.pickup_lat && order.pickup_lng 
          ? calculateDistance(latitude, longitude, order.pickup_lat, order.pickup_lng) 
          : null;
        const distanceToDropoff = order.dropoff_lat && order.dropoff_lng 
          ? calculateDistance(latitude, longitude, order.dropoff_lat, order.dropoff_lng) 
          : null;

        if (order.status === 'rider_en_route_pickup' && distanceToPickup !== null && distanceToPickup <= 0.05) {
          console.log('📍 Geofence: Rider arrived at pickup point.');
          handleStatusTransition('at_pickup');
        } else if (order.status === 'en_route_delivery' && distanceToDropoff !== null && distanceToDropoff <= 0.05) {
          console.log('📍 Geofence: Rider arrived at dropoff point.');
          handleStatusTransition('at_delivery');
        }

        // Broadcast coordinates to Realtime channel
        locationChannel.send({
          type: 'broadcast',
          event: 'location',
          payload: {
            lat: latitude,
            lng: longitude,
            heading: heading ?? null,
            speed: speed ?? null,
          }
        });

        // Throttle database inserts to every 10 seconds
        const now = Date.now();
        if (now - lastCheckpointTime >= 10000) {
          lastCheckpointTime = now;
          try {
            await insertLocationCheckpoint({
              rider_id: riderId || 'rider',
              order_id: order.id,
              event_type: 'checkpoint_periodic',
              lat: latitude,
              lng: longitude,
              heading: heading ?? undefined,
              speed_kmh: speed ? speed * 3.6 : undefined,
            });
          } catch (err) {
            console.error('Failed to log location checkpoint:', err);
          }
        }
      },
      (error) => {
        console.error('Geolocation watcher error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(locationChannel);
    };
  }, [order?.id, order?.status, riderId]);

  const handleMissedCheckin = async () => {
    if (!order) return;
    try {
      await OrderService.createSafetyAlert({
        order_id: order.id,
        user_id: riderId || 'rider',
        type: 'missed_checkin',
        gps_lat: order.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
        gps_lng: order.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)
      });
      alert('⚠️ Missed Transit Check-in: Safety Alert has been flagged to Biker Operations.');
    } catch (e) {
      console.error('Failed to log missed check-in:', e);
    }
  };

  const handleCheckinOk = () => {
    setShowTransitCheckinTimer(false);
  };

  const handleRiderSos = async () => {
    if (!order) return;
    if (!confirm('🚨 EMERGENCY WARNING: Are you sure you want to trigger a Red SOS Distress Alert? Biker Operations will be dispatched immediately.')) {
      return;
    }
    try {
      await OrderService.createSafetyAlert({
        order_id: order.id,
        user_id: riderId || 'rider',
        type: 'sos_alert',
        gps_lat: order.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
        gps_lng: order.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)
      });
      alert('🆘 SOS Emergency Triggered! Active security dispatched.');
    } catch (e) {
      console.error('Failed to trigger Rider SOS:', e);
    }
  };


  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setRiderId(user.id);
      
      // Fetch any active order for this rider
      const orders = await OrderService.getOrders(user.id, 'rider');
      const active = orders.find(
        o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'disputed'
      );
      
      if (active) {
        setOrder(active);
      }
      setLoading(false);
    }
    init();
  }, [router]);

  const logTransitionCheckpoint = async (eventType: string, lat: number, lng: number) => {
    if (!order) return;
    try {
      await insertLocationCheckpoint({
        rider_id: riderId || 'rider',
        order_id: order.id,
        event_type: eventType,
        lat,
        lng,
        heading: riderHeading ?? undefined
      });
    } catch (err) {
      console.error(`Failed to log ${eventType} checkpoint:`, err);
    }
  };

  const handleStatusTransition = async (nextStatus: string) => {
    if (!order) return;
    
    // Upload pickup photo proof on transition to en_route_delivery
    if (nextStatus === 'en_route_delivery' && pickupPhotoUrl) {
      try {
        await OrderService.uploadProof({
          request_id: order.id,
          uploaded_by: riderId || 'rider',
          proof_type: 'pickup_photo',
          file_url: pickupPhotoUrl,
          notes: statusNotes || 'Pickup photo proof uploaded'
        });
      } catch (err) {
        console.error('Failed to upload pickup photo proof:', err);
      }
    }

    setLoading(true);
    const success = await OrderService.updateOrderStatus(order.id, nextStatus, statusNotes || `Rider transitioned to ${nextStatus}`);
    if (success) {
      const fresh = await OrderService.getOrderById(order.id);
      setOrder(fresh);
      setStatusNotes('');

      // Log DB checkpoint for status transitions if coords are available
      if (riderCoords) {
        let eventType = '';
        if (nextStatus === 'rider_en_route_pickup') eventType = 'accepted_job';
        else if (nextStatus === 'at_pickup') eventType = 'arrived_pickup';
        else if (nextStatus === 'en_route_delivery') eventType = 'left_pickup';
        else if (nextStatus === 'at_delivery') eventType = 'arrived_dropoff';
        
        if (eventType) {
          await logTransitionCheckpoint(eventType, riderCoords[0], riderCoords[1]);
        }
      }
    }
    setLoading(false);
  };

  const handleVerifyDeliveryPin = async () => {
    if (!order || !pinCode) return;
    
    // Upload delivery proof photo if captured
    if (deliveryPhotoUrl) {
      try {
        await OrderService.uploadProof({
          request_id: order.id,
          uploaded_by: riderId || 'rider',
          proof_type: 'delivery_photo',
          file_url: deliveryPhotoUrl,
          notes: 'Delivery photo proof verified with PIN'
        });
      } catch (err) {
        console.error('Failed to upload delivery photo proof:', err);
      }
    }

    setSubmittingPin(true);
    setPinError('');
    
    try {
      const res = await OrderService.verifyDeliveryPin(order.id, pinCode);
      if (res.success) {
        setPinSuccess(true);
        const fresh = await OrderService.getOrderById(order.id);
        setOrder(fresh);
        if (riderCoords) {
          await logTransitionCheckpoint('delivery_complete', riderCoords[0], riderCoords[1]);
        }
      } else {
        setPinError(res.error || 'Verification failed. Please try again.');
      }
    } catch (e: any) {
      setPinError(e.message || 'Verification error');
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleCompleteCod = async () => {
    if (!order || !riderId || !pinCode || !cashCollected) return;

    // Upload delivery proof photo if captured
    if (deliveryPhotoUrl) {
      try {
        await OrderService.uploadProof({
          request_id: order.id,
          uploaded_by: riderId,
          proof_type: 'delivery_photo',
          file_url: deliveryPhotoUrl,
          notes: 'Delivery photo proof verified with PIN (COD)'
        });
      } catch (err) {
        console.error('Failed to upload delivery photo proof:', err);
      }
    }

    setSubmittingPin(true);
    setPinError('');

    const amt = parseFloat(cashCollected);
    if (isNaN(amt)) {
      setPinError('Please enter a valid cash amount');
      setSubmittingPin(false);
      return;
    }

    const usdCollected = country === 'ZM' ? amt / 25 : amt;

    try {
      const res = await OrderService.completeCodDelivery({
        orderId: order.id,
        riderId,
        pin: pinCode,
        cashCollected: usdCollected,
        hasDiscrepancy: hasDiscrepancy || Math.abs(usdCollected - (order.total_amount || 0)) > 0.01,
        expectedAmount: order.total_amount || 0
      });

      if (res.success) {
        setPinSuccess(true);
        const fresh = await OrderService.getOrderById(order.id);
        setOrder(fresh);
        if (riderCoords) {
          await logTransitionCheckpoint('delivery_complete', riderCoords[0], riderCoords[1]);
        }
      } else {
        setPinError(res.error || 'Failed to complete COD delivery');
        if (res.attemptsRemaining !== undefined) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
      }
    } catch (e: any) {
      setPinError(e.message || 'Error processing cash delivery');
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleVerifyPinFromModal = async (enteredPin: string): Promise<boolean> => {
    if (!order) return false;

    // Upload delivery proof photo if captured
    if (deliveryPhotoUrl) {
      try {
        await OrderService.uploadProof({
          request_id: order.id,
          uploaded_by: riderId || 'rider',
          proof_type: 'delivery_photo',
          file_url: deliveryPhotoUrl,
          notes: 'Delivery photo proof verified via QR/PIN modal'
        });
      } catch (err) {
        console.error('Failed to upload delivery photo proof:', err);
      }
    }

    setSubmittingPin(true);
    setPinError('');

    if (isCOD) {
      const amt = parseFloat(cashCollected);
      if (isNaN(amt)) {
        setPinError('Please enter actual cash collected before scanning');
        setSubmittingPin(false);
        return false;
      }
      const usdCollected = country === 'ZM' ? amt / 25 : amt;

      try {
        const res = await OrderService.completeCodDelivery({
          orderId: order.id,
          riderId: riderId || 'rider',
          pin: enteredPin,
          cashCollected: usdCollected,
          hasDiscrepancy: hasDiscrepancy || Math.abs(usdCollected - (order.total_amount || 0)) > 0.01,
          expectedAmount: order.total_amount || 0
        });

        if (res.success) {
          setPinSuccess(true);
          const fresh = await OrderService.getOrderById(order.id);
          setOrder(fresh);
          if (riderCoords) {
            await logTransitionCheckpoint('delivery_complete', riderCoords[0], riderCoords[1]);
          }
          return true;
        } else {
          setPinError(res.error || 'Failed to complete COD delivery');
          if (res.attemptsRemaining !== undefined) {
            setAttemptsRemaining(res.attemptsRemaining);
          }
          return false;
        }
      } catch (e: any) {
        setPinError(e.message || 'Error processing cash delivery');
        return false;
      } finally {
        setSubmittingPin(false);
      }
    } else {
      try {
        const res = await OrderService.verifyDeliveryPin(order.id, enteredPin);
        if (res.success) {
          setPinSuccess(true);
          const fresh = await OrderService.getOrderById(order.id);
          setOrder(fresh);
          if (riderCoords) {
            await logTransitionCheckpoint('delivery_complete', riderCoords[0], riderCoords[1]);
          }
          return true;
        } else {
          setPinError(res.error || 'Invalid PIN code');
          return false;
        }
      } catch (e: any) {
        setPinError(e.message || 'Error releasing escrow');
        return false;
      } finally {
        setSubmittingPin(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-lg p-6 text-center" style={{ marginTop: '10vh' }}>
        <div style={{ marginBottom: '20px' }}>
          <PremiumIcon name="Bike" variant="neutral" size={64} className="opacity-50" />
        </div>
        <h2 className="title" style={{ marginBottom: '10px' }}>No Active Orders</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          You do not have any active delivery request assigned to you right now. Go online to receive matching requests.
        </p>
        <Link href="/dashboard" className="btn btn--primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isCOD = order.payment_method === 'cash';

  return (
    <div className="container max-w-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="title">Active Delivery</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <button 
              type="button" 
              className="btn btn--danger font-bold btn--sm"
              onClick={handleRiderSos}
              style={{ background: '#dc2626', color: '#ffffff', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PremiumIcon name="ShieldAlert" variant="danger" animate="pulse" size={14} glow />
              <span>SOS</span>
            </button>
          )}
          <span className="badge badge--primary font-mono">{order.reference_code}</span>
        </div>
      </div>

      <div className="card p-4 mb-6" style={{ padding: '16px', marginBottom: '24px' }}>
        <h3 className="title title--sm" style={{ marginBottom: '12px' }}>Live Transit Map</h3>
        <LiveTrackingMap
          pickupCoords={[order.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292), order.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)]}
          dropoffCoords={[order.dropoff_lat || (country === 'ZM' ? -15.3994 : -17.7994), order.dropoff_lng || (country === 'ZM' ? 28.3078 : 31.0378)]}
          riderCoords={riderCoords}
          riderHeading={riderHeading}
          riderName="You"
        />
      </div>

      <div className="card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Status: <span style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="badge badge--success">{order.service_type.replace(/_/g, ' ')}</span>
        </div>

        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Pickup From</div>
            <div style={{ fontWeight: 600 }}>{order.pickup_address}</div>
            {order.pickup_contact_name && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <PremiumIcon name="User" variant="info" size={12} />
                <span>{order.pickup_contact_name} ({order.pickup_contact_phone})</span>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Deliver To</div>
            <div style={{ fontWeight: 600 }}>{order.dropoff_address}</div>
            {order.dropoff_contact_name && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <PremiumIcon name="User" variant="info" size={12} />
                <span>{order.dropoff_contact_name} ({order.dropoff_contact_phone})</span>
              </div>
            )}
            {order.dropoff_gate_color && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <PremiumIcon name="Paintbrush" variant="primary" size={12} />
                <span>Gate Color: {order.dropoff_gate_color}</span>
              </div>
            )}
          </div>
        </div>

        <div className="divider" style={{ margin: '16px 0' }} />

        <div className="flex justify-between" style={{ fontSize: '14px' }}>
          <span>Payment Mode:</span>
          <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{order.payment_method}</span>
        </div>
        <div className="flex justify-between" style={{ fontSize: '14px', marginTop: '4px' }}>
          <span>Total Delivery Fee:</span>
          <span style={{ fontWeight: 700 }}>{formatPrice(order.total_amount ?? 0)}</span>
        </div>
        
        <div className="divider" style={{ margin: '16px 0' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn--secondary btn--full btn--sm"
            onClick={() => setShowCallSimulator(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <PremiumIcon name="Phone" variant="success" size={14} />
            <span>Call Customer (Masked)</span>
          </button>
          <button 
            type="button" 
            className="btn btn--secondary btn--full btn--sm"
            onClick={() => setShowChatDrawer(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <PremiumIcon name="MessageSquare" variant="primary" size={14} />
            <span>Message Customer</span>
          </button>
        </div>
      </div>

      {order.status !== 'completed' && (
        <div className="card p-6 mb-6">
          <h3 className="title title--sm" style={{ marginBottom: '16px' }}>Manage Order Actions</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {order.status === 'rider_assigned' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('rider_en_route_pickup')}>
                Start Heading to Pickup
              </button>
            )}

            {order.status === 'rider_en_route_pickup' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('at_pickup')}>
                Arrived at Pickup Location
              </button>
            )}

            {order.status === 'at_pickup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {order.service_type === 'buy_for_me' ? (
                  <ReceiptOcrUploader
                    label="Scan Store Receipt (Required)"
                    targetAmount={order.estimated_item_cost}
                    country={country}
                    required={true}
                    onOcrComplete={async (ocrData) => {
                      // 1. Log the receipt proof in database (with offline queue support)
                      if (riderId) {
                        try {
                          await OrderService.uploadProof({
                            request_id: order.id,
                            uploaded_by: riderId,
                            proof_type: 'receipt_photo',
                            file_url: ocrData.receiptUrl,
                            notes: `Merchant: ${ocrData.merchantName}, Total: ${ocrData.totalAmount.toFixed(2)}, Items: ${ocrData.items.length}`,
                          });
                        } catch (err) {
                          console.error('Failed to upload receipt proof:', err);
                        }
                      }
                      
                      // 2. Update order purchase details in local storage + DB
                      await OrderService.updateOrderPurchaseDetails(
                        order.id, 
                        ocrData.totalAmount, 
                        ocrData.items
                      );
                      
                      setStatusNotes(`Receipt uploaded: ${ocrData.merchantName} - Total: $${ocrData.totalAmount.toFixed(2)}`);
                    }}
                  />
                ) : (
                  <PhotoProofUploader
                    label="Take Pickup Photo Proof"
                    targetLat={order.pickup_lat}
                    targetLng={order.pickup_lng}
                    onUploadSuccess={(url) => {
                      setPickupPhotoUrl(url);
                      setStatusNotes('Pickup photo proof uploaded successfully');
                    }}
                    required={true}
                  />
                )}
                
                <button 
                  className="btn btn--primary btn--full" 
                  onClick={() => handleStatusTransition('en_route_delivery')}
                  disabled={order.service_type === 'buy_for_me' && !statusNotes.includes('Receipt uploaded')}
                >
                  {order.service_type === 'buy_for_me' ? 'Confirm Purchase & Start Delivery' : 'Confirm Pickup & Start Delivery'}
                </button>
              </div>
            )}

            {order.status === 'en_route_delivery' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('at_delivery')}>
                Arrived at Customer Location
              </button>
            )}

            {order.status === 'at_delivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <PhotoProofUploader
                  label="Take Delivery Photo Proof"
                  targetLat={order.dropoff_lat}
                  targetLng={order.dropoff_lng}
                  onUploadSuccess={(url) => {
                    setDeliveryPhotoUrl(url);
                    setStatusNotes('Delivery photo proof uploaded successfully');
                  }}
                  required={true}
                />

                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isCOD ? <PremiumIcon name="Banknote" variant="success" size={18} /> : <PremiumIcon name="ShieldCheck" variant="protect" size={18} />}
                    <span>{isCOD ? 'Cash on Delivery Completion' : 'Escrow PIN Release Verification'}</span>
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {isCOD 
                      ? 'Please verify the delivery PIN code from the merchant/customer and count the cash collected.' 
                      : 'Ask the recipient for their 4-digit verification PIN to release the escrow funds atomically.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isCOD && (
                      <>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Actual Cash Collected ({country === 'ZM' ? 'ZK' : '$'})</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="input" 
                            placeholder={`Expected: ${formatPrice(order.total_amount ?? 0)}`}
                            value={cashCollected}
                            onChange={(e) => setCashCollected(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2" style={{ margin: '4px 0' }}>
                          <input 
                            type="checkbox" 
                            id="discrepancy" 
                            checked={hasDiscrepancy}
                            onChange={(e) => setHasDiscrepancy(e.target.checked)}
                          />
                          <label htmlFor="discrepancy" style={{ fontSize: '13px', cursor: 'pointer' }}>
                            Flag Cash Discrepancy / Shortchange
                          </label>
                        </div>
                      </>
                    )}

                    {pinError && (
                      <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PremiumIcon name="AlertTriangle" variant="danger" size={14} />
                        <span>{pinError} {attemptsRemaining !== null && `(${attemptsRemaining} attempts left)`}</span>
                      </div>
                    )}

                    <button 
                      type="button"
                      className="btn btn--success btn--full"
                      onClick={() => setIsQrPinOpen(true)}
                      disabled={isCOD && !cashCollected}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <PremiumIcon name="QrCode" variant="primary" size={14} />
                      <span>Open PIN / QR Scanner</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {order.status === 'completed' && (
        <div className="alert alert--success text-center">
          <h3>🎉 Delivery Completed!</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Verification succeeded and payout has been released to your wallet ledger.
          </p>
        </div>
      )}

      {showTransitCheckinTimer && (
        <div className="modal-overlay" style={{ zIndex: 1200, background: 'rgba(15, 23, 42, 0.95)' }}>
          <div className="modal modal--glass" style={{ maxWidth: '360px', padding: '32px 24px', textAlign: 'center', borderRadius: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <PremiumIcon name="AlertTriangle" variant="danger" animate="bounce" size={48} glow />
            </div>
            <h2 className="title" style={{ color: '#ffffff', marginBottom: '8px' }}>Are you OK?</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
              Transit check-in active. Please confirm you are safe.
            </p>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b', marginBottom: '32px', fontFamily: 'var(--font-mono)' }}>
              {checkinCountdown}s
            </div>
            <button 
              type="button"
              className="btn btn--success btn--full btn--lg font-bold"
              onClick={handleCheckinOk}
              style={{ height: '56px', borderRadius: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <PremiumIcon name="Check" variant="success" size={16} />
              <span>Yes, I am Safe</span>
            </button>
          </div>
        </div>
      )}

      {showCallSimulator && (
        <CallSimulator
          orderId={order.id}
          callerId={riderId || 'rider'}
          callerRole="rider"
          receiverName={order.pickup_contact_name || 'Customer'}
          receiverPhone={order.pickup_contact_phone || '+263 77 123 4567'}
          onClose={() => setShowCallSimulator(false)}
        />
      )}

      {showChatDrawer && (
        <ChatDrawer
          orderId={order.id}
          senderId={riderId || 'rider'}
          senderName="Rider"
          onClose={() => setShowChatDrawer(false)}
        />
      )}

      <QrPinModal
        isOpen={isQrPinOpen}
        onClose={() => setIsQrPinOpen(false)}
        pin={order.delivery_pin || '1234'}
        onVerifyPin={handleVerifyPinFromModal}
        referenceCode={order.reference_code}
      />
    </div>
  );
}
