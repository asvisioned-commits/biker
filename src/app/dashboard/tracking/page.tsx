'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { OrderService, BikerOrder } from '@/lib/order-service';
import { EcoCashService, EcoCashTransaction } from '@/lib/ecocash';
import { createClient } from '@/lib/supabase/client';
import { getCounterOffersForOrder, respondToCounterOffer } from '../earnings/actions';
import { FLAGS } from '@/lib/flags';
import { CallSimulator } from '@/components/CallSimulator';
import { ChatDrawer } from '@/components/ChatDrawer';
import { useProfile } from '@/context/ProfileContext';
import LiveTrackingMap from '@/components/map/LiveTrackingMap';
import styles from './tracking.module.css';

const getModalStyles = (method: string) => {
  switch (method) {
    case 'mtn_momo':
      return {
        modal: { background: '#FFCC00', color: '#000000', borderColor: '#E6B800' },
        title: { color: '#000000' },
        subtitle: { color: 'rgba(0, 0, 0, 0.6)' },
        body: { color: '#000000' },
        details: { background: 'rgba(0, 0, 0, 0.05)', color: '#000000' },
        detailLabel: { color: 'rgba(0, 0, 0, 0.6)' },
        detailValue: { color: '#000000' },
        statusBox: { background: 'rgba(0, 0, 0, 0.03)', borderColor: 'rgba(0, 0, 0, 0.2)', color: '#000000' },
        statusTitle: { color: '#000000' },
        statusDesc: { color: 'rgba(0, 0, 0, 0.6)' },
        timer: { color: '#000000' },
        sandboxBadge: { background: 'rgba(0, 0, 0, 0.1)', color: '#000000' },
        brandIcon: { background: '#000000', color: '#FFCC00' },
        primaryBtn: { background: '#000000', color: '#FFCC00', border: 'none' },
        secondaryBtn: { background: 'transparent', color: '#000000', border: '1px solid rgba(0, 0, 0, 0.3)' }
      };
    case 'airtel_money':
      return {
        modal: { background: '#E11900', color: '#FFFFFF', borderColor: '#B31400' },
        title: { color: '#FFFFFF' },
        subtitle: { color: 'rgba(255, 255, 255, 0.7)' },
        body: { color: '#FFFFFF' },
        details: { background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' },
        detailLabel: { color: 'rgba(255, 255, 255, 0.7)' },
        detailValue: { color: '#FFFFFF' },
        statusBox: { background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' },
        statusTitle: { color: '#FFFFFF' },
        statusDesc: { color: 'rgba(255, 255, 255, 0.7)' },
        timer: { color: '#FFFFFF' },
        sandboxBadge: { background: 'rgba(255, 255, 255, 0.2)', color: '#FFFFFF' },
        brandIcon: { background: '#FFFFFF', color: '#E11900' },
        primaryBtn: { background: '#FFFFFF', color: '#E11900', border: 'none' },
        secondaryBtn: { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.5)' }
      };
    default: // ecocash
      return {
        modal: {},
        title: {},
        subtitle: {},
        body: {},
        details: {},
        detailLabel: {},
        detailValue: {},
        statusBox: {},
        statusTitle: {},
        statusDesc: {},
        timer: {},
        sandboxBadge: {},
        brandIcon: {},
        primaryBtn: {},
        secondaryBtn: {}
      };
  }
};

function TrackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('id');
  
  const { session, country } = useProfile();
  
  const launchPay = searchParams.get('pay');
  const launchEcoCash = launchPay === 'ecocash';
  const launchMtnMomo = launchPay === 'mtn_momo';
  const launchAirtelMoney = launchPay === 'airtel_money';
  const ecocashPhoneParam = searchParams.get('phone') || '';

  const formatPrice = (usdVal: number) => {
    if (country === 'ZM') {
      return `ZK ${(usdVal * 25).toFixed(2)}`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const [initialOrder, setInitialOrder] = useState<BikerOrder | null>(null);
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

  // Counter Offers State
  const [counterOffers, setCounterOffers] = useState<any[]>([]);
  const [respondingToOfferId, setRespondingToOfferId] = useState<string | null>(null);

  // Simulation controls
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [scanningTime, setScanningTime] = useState(0);

  // Increment scanning time when order is in scanning phase
  useEffect(() => {
    if (!liveOrder || liveOrder.status !== 'payment_held') {
      setScanningTime(0);
      return;
    }
    const interval = setInterval(() => {
      setScanningTime(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [liveOrder?.status]);

  const getScanningStatusText = () => {
    if (scanningTime < 5) return 'Scanning for nearby riders...';
    if (scanningTime < 10) return 'Expanding search radius...';
    if (scanningTime < 15) return 'Optimizing route dispatch...';
    return 'Deep scan initiated. Contacting premium riders...';
  };

  const getNearbyRiders = () => {
    const lat = liveOrder?.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292);
    const lng = liveOrder?.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522);
    return [
      { id: 'nr1', name: 'Tinashe M.', lat: lat + 0.003, lng: lng - 0.004 },
      { id: 'nr2', name: 'Farai K.', lat: lat - 0.002, lng: lng + 0.003 },
      { id: 'nr3', name: 'Alfonso Z.', lat: lat + 0.004, lng: lng + 0.002 }
    ];
  };
  
  // Map markers & state tracking
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  // Realtime subscription ref
  const subscriptionRef = useRef<any>(null);

  // Safety & Trust states
  const [showCallSimulator, setShowCallSimulator] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  
  // Dispute submission form states
  const [disputeType, setDisputeType] = useState('wrong_item');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeRefundAmount, setDisputeRefundAmount] = useState('');
  const [disputeSeverity, setDisputeSeverity] = useState('medium');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Poll safety alerts every 5 seconds
  useEffect(() => {
    if (!orderId) return;
    
    const loadAlerts = async () => {
      try {
        const alerts = await OrderService.getSafetyAlerts();
        const currentAlerts = alerts.filter(
          (a: any) => a.order_id === orderId && a.status === 'active'
        );
        setActiveAlerts(currentAlerts);
      } catch (e) {
        console.error('Failed to load safety alerts:', e);
      }
    };
    
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleCustomerSos = async () => {
    const order = liveOrder as BikerOrder;
    if (!order) return;
    if (!confirm('🚨 EMERGENCY WARNING: Are you sure you want to trigger a Red SOS Distress Alert? This will immediately alert Biker dispatch operations.')) {
      return;
    }
    
    try {
      addSimulationLog('🆘 SOS EMERGENCY: Dispatching alert to Ops Control Center...');
      const alert = await OrderService.createSafetyAlert({
        order_id: order.id,
        user_id: session?.user_id || 'customer',
        type: 'sos_alert',
        gps_lat: order.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
        gps_lng: order.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)
      });
      if (alert) {
        addSimulationLog('🆘 SOS Alert logged successfully. Active security dispatched.');
        const alerts = await OrderService.getSafetyAlerts();
        setActiveAlerts(alerts.filter((a: any) => a.order_id === order.id && a.status === 'active'));
      }
    } catch (e) {
      console.error('Failed to trigger Customer SOS:', e);
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    const order = liveOrder as BikerOrder;
    if (!order || !session?.user_id) return;
    setSubmittingDispute(true);
    
    try {
      addSimulationLog(`⚖️ Filing dispute for order ${order.reference_code}...`);
      const dispute = await OrderService.createDispute({
        request_id: order.id,
        initiated_by: session.user_id,
        dispute_type: disputeType,
        description: disputeDescription,
        refund_amount: Number(disputeRefundAmount) || Number(order.total_amount || 0),
        severity: disputeSeverity,
        against_user_id: order.assigned_rider_id || undefined
      });
      
      if (dispute) {
        addSimulationLog('⚖️ Dispute filed successfully. Order status is now "disputed".');
        
        if (disputeEvidence.trim()) {
          await OrderService.addDisputeEvidence(dispute.id, disputeEvidence.trim());
          addSimulationLog(`⚖️ Attached evidence: ${disputeEvidence}`);
        }
        
        const fresh = await OrderService.getOrderById(order.id);
        setLiveOrder(fresh);
        setShowDisputeModal(false);
        setDisputeDescription('');
        setDisputeRefundAmount('');
        setDisputeEvidence('');
      }
    } catch (err: any) {
      console.error('Failed to file dispute:', err);
      alert('Failed to file dispute: ' + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Load Order Details
  useEffect(() => {
    if (!orderId) {
      setError('Missing order ID parameter');
      setLoading(false);
      return;
    }

    const currentOrderId = orderId as string;

    async function loadOrder() {
      try {
        const o = await OrderService.getOrderById(currentOrderId);
        if (!o) {
          // If not found in DB or LocalStorage, try to load simulated mocks for visualization
          if (currentOrderId.startsWith('mock-')) {
            const mockO: BikerOrder = {
              id: currentOrderId,
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
            setInitialOrder(mockO);
            setLiveOrder(mockO);
            setLoading(false);
            return;
          }
          setError('Order not found');
          setLoading(false);
          return;
        }

        setInitialOrder(o);
        setLiveOrder(o);
        
        if (o.status === 'completed' || o.delivery_pin_verified) {
          setPinVerified(true);
        }

        // Set default EcoCash phone if empty
        if (!ecocashPhone && o.pickup_contact_phone) {
          setEcocashPhone(o.pickup_contact_phone);
        }

        // Auto trigger payment checkout overlay if requested
        if ((launchEcoCash || launchMtnMomo || launchAirtelMoney) && o.status === 'payment_pending') {
          triggerEcoCashUSSDPush(o, ecocashPhoneParam || o.pickup_contact_phone || (country === 'ZM' ? '0971234567' : '0771234567'));
        }

        // Initialize rider location coordinates if rider is assigned
        if (o.assigned_rider_id) {
          setRiderLocation({
            lat: o.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
            lng: o.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)
          });
        }

        // Load active counter offers if order is in payment_held status
        if (o.status === 'payment_held' || o.status === 'draft') {
          const res = await getCounterOffersForOrder(currentOrderId);
          if (res.success) {
            setCounterOffers(res.data);
          }
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
    let broadcastLocationChannel: any = null;
    if (liveOrder?.assigned_rider_id) {
      locationChannel = supabase
        .channel(`rider-location-db-${liveOrder.assigned_rider_id}`)
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
            setRiderLocation({ lat: cp.lat, lng: cp.lng, heading: cp.heading });
            addSimulationLog(`📍 Location Checkpoint received (DB): [${cp.lat.toFixed(5)}, ${cp.lng.toFixed(5)}]`);
          }
        )
        .subscribe();

      broadcastLocationChannel = supabase
        .channel(`rider-location-${orderId}`)
        .on(
          'broadcast',
          { event: 'location' },
          (payload) => {
            const data = payload.payload;
            if (data && data.lat && data.lng) {
              setRiderLocation({ lat: data.lat, lng: data.lng, heading: data.heading });
              addSimulationLog(`📍 Realtime Location Broadcast received: [${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}]`);
            }
          }
        )
        .subscribe();
    }

    // Listen to new counter offers
    const offersChannel = supabase
      .channel(`order-offers-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_offers',
          filter: `order_id=eq.${orderId}`
        },
        async () => {
          const res = await getCounterOffersForOrder(orderId);
          if (res.success) {
            setCounterOffers(res.data);
          }
          addSimulationLog(`⚡ Realtime DB Update: Counter offers updated`);
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (locationChannel) {
        supabase.removeChannel(locationChannel);
      }
      if (broadcastLocationChannel) {
        supabase.removeChannel(broadcastLocationChannel);
      }
      if (offersChannel) {
        supabase.removeChannel(offersChannel);
      }
    };
  }, [orderId, liveOrder?.assigned_rider_id]);

  // Simulated matching/negotiation trigger for developer sandbox / offline mode
  useEffect(() => {
    if (OrderService.isOnline || !liveOrder || liveOrder.status !== 'payment_held' || liveOrder.assigned_rider_id) return;

    addSimulationLog('🤖 Match Engine: Broadcast dispatching order offers to nearby riders...');

    // Trigger a counter-offer after 4 seconds
    const counterOfferTimer = setTimeout(() => {
      handleSimulateCounterOffer();
      addSimulationLog('🚴 Rider Tinashe M. proposed a counter-bid of ' + formatPrice(Number(liveOrder.delivery_fee || 5.0) * 1.3) + '.');
    }, 4000);

    // Trigger auto-accept of the base price at 22 seconds if the user declined the bid
    const autoAcceptTimer = setTimeout(async () => {
      const fresh = await OrderService.getOrderById(orderId as string);
      if (fresh && fresh.status === 'payment_held' && !fresh.assigned_rider_id) {
        addSimulationLog('🚴 Match Engine: Rider "Farai K." accepted the base offer.');
        const updated = {
          ...fresh,
          status: 'rider_assigned',
          assigned_rider_id: 'mock-rider-farai',
          rider: {
            full_name: 'Farai K.',
            avatar_url: '',
            phone: country === 'ZM' ? '+260 97 999 8888' : '+263 77 999 8888'
          }
        };
        await OrderService.updateOrderStatus(fresh.id, 'rider_assigned', 'Rider Farai K. accepted base offer');
        setLiveOrder(updated);
        setRiderLocation({
          lat: fresh.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
          lng: fresh.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)
        });
        addSimulationLog('🟢 Status Changed: "Rider Assigned" (Farai K. is en route to pickup)');
      }
    }, 22000);

    return () => {
      clearTimeout(counterOfferTimer);
      clearTimeout(autoAcceptTimer);
    };
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
        lat: liveOrder.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292),
        lng: liveOrder.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522),
        heading: 180
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

  const handleRespondToOffer = async (offerId: string, action: 'accept' | 'decline') => {
    setRespondingToOfferId(offerId);
    try {
      const res = await respondToCounterOffer(offerId, action);
      if (res.success) {
        addSimulationLog(`Offer ${action}ed successfully!`);
        // Refresh order
        const fresh = await OrderService.getOrderById(orderId as string);
        if (fresh) {
          setLiveOrder(fresh);
        }
        // Refresh counter offers
        const offersRes = await getCounterOffersForOrder(orderId as string);
        if (offersRes.success) {
          setCounterOffers(offersRes.data);
        }
      } else {
        alert(res.message || `Failed to ${action} offer.`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action} offer.`);
    } finally {
      setRespondingToOfferId(null);
    }
  };

  const handleSimulateCounterOffer = async () => {
    addSimulationLog('🚴 Simulating rider counter offer...');
    const key = `biker_order_offers_${orderId}`;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      const offers = stored ? JSON.parse(stored) : [];
      const newOffer = {
        id: `offer-${Date.now()}`,
        order_id: orderId,
        rider_id: 'mock-rider-tinashe',
        status: 'counter_offered',
        counter_offer_amount: Number(order.delivery_fee || 5.0) * 1.3,
        estimated_rider_payout: Number(order.delivery_fee || 5.0) * 1.3,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 120 * 1000).toISOString(),
        rider_name: 'Tinashe M. (Simulated Bid)',
        rider_rating: 4.9,
        rider_avatar: ''
      };
      offers.push(newOffer);
      localStorage.setItem(key, JSON.stringify(offers));
      
      // Update local state
      const res = await getCounterOffersForOrder(orderId as string);
      if (res.success) {
        setCounterOffers(res.data);
      }
    }
  };

  // Poll counter offers in offline mode
  useEffect(() => {
    if (!orderId || OrderService.isOnline) return;
    
    const interval = setInterval(async () => {
      if (liveOrder?.status === 'payment_held') {
        const res = await getCounterOffersForOrder(orderId as string);
        if (res.success) {
          setCounterOffers(res.data);
        }
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [orderId, liveOrder?.status]);

  // USSD PUSH INITIATION FLOW
  const triggerEcoCashUSSDPush = async (ord: BikerOrder, phone: string) => {
    setEcocashError('');
    setShowEcoCashOverlay(true);
    setEcocashTimer(30);
    
    const method = ord.payment_method || (launchMtnMomo ? 'mtn_momo' : launchAirtelMoney ? 'airtel_money' : 'ecocash');
    const providerName = method === 'mtn_momo' ? 'MTN MoMo' : method === 'airtel_money' ? 'Airtel Money' : 'EcoCash';
    
    addSimulationLog(`📱 Initiating ${providerName} USSD Push request for ${phone}...`);
    
    try {
      const tx = await EcoCashService.initiatePayment(
        ord.id,
        phone,
        ord.total_amount || 5.00,
        ord.reference_code,
        method
      );
      setActiveTxId(tx.id);
      addSimulationLog(`📱 USSD Push prompt dispatched. TxRef: ${tx.id}. Status: Awaiting PIN.`);
    } catch (e: any) {
      setEcocashError(e.message || 'Failed to dispatch USSD Push prompt');
      addSimulationLog(`❌ Payment Error: ${e.message}`);
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
    if (activeTxId && initialOrder) {
      await EcoCashService.cancelPayment(initialOrder.id, activeTxId);
    }
  };

  const handleApprovePayment = async () => {
    if (!initialOrder || !activeTxId) return;
    setIsProcessingEcoCash(true);
    setEcocashError('');
    
    addSimulationLog('📱 Simulating Customer USSD PIN confirmation...');
    
    const method = initialOrder.payment_method || (launchMtnMomo ? 'mtn_momo' : launchAirtelMoney ? 'airtel_money' : 'ecocash');
    
    // Add 1.5s delay to make ledger writing visual
    setTimeout(async () => {
      try {
        const res = await EcoCashService.confirmPayment(initialOrder.id, activeTxId, method);
        if (res.success) {
          addSimulationLog('💸 Double-Entry Ledger updated: debited central gateway, credited customer escrow.');
          addSimulationLog('🔒 Payment Held: Funds secured in multi-sig escrow wallet.');
          
          const fresh = await OrderService.getOrderById(initialOrder.id);
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
    if (!initialOrder || !activeTxId) return;
    setIsProcessingEcoCash(true);
    
    addSimulationLog('❌ Simulated Customer USSD PIN declined.');
    
    try {
      await EcoCashService.cancelPayment(initialOrder.id, activeTxId);
      await OrderService.updateOrderStatus(initialOrder.id, 'cancelled', 'EcoCash USSD payment declined by customer');
      
      const fresh = await OrderService.getOrderById(initialOrder.id);
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

  const order = liveOrder as BikerOrder;

  // Compute Timeline Items based on current status
  const getTimeline = () => {
    const steps: { status: string; description: string; completed: boolean; time?: string }[] = [
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

      {/* Safety Distress Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className="alert alert--danger" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <span>🆘 ACTIVE SAFETY ALERT</span>
          </div>
          {activeAlerts.map((alert) => (
            <div key={alert.id} style={{ fontSize: '13px' }}>
              • {alert.type === 'sos_alert' ? 'Distress SOS trigger signal received from device.' : 'Transit check-in missed by Biker rider.'} Status: Active Ops Dispatch.
            </div>
          ))}
        </div>
      )}


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
        <div className={`${styles.mapArea} ${activeTab === 'map' ? styles.mapAreaVisible : ''}`} style={{ minHeight: '350px', position: 'relative' }}>
          <LiveTrackingMap
            pickupCoords={[order.pickup_lat || (country === 'ZM' ? -15.3875 : -17.8292), order.pickup_lng || (country === 'ZM' ? 28.3228 : 31.0522)]}
            dropoffCoords={[order.dropoff_lat || (country === 'ZM' ? -15.3994 : -17.7994), order.dropoff_lng || (country === 'ZM' ? 28.3078 : 31.0378)]}
            riderCoords={riderLocation ? [riderLocation.lat, riderLocation.lng] : null}
            riderHeading={riderLocation?.heading ?? null}
            riderName={order.rider?.full_name || 'Tinashe M.'}
            nearbyRiders={order.status === 'payment_held' ? getNearbyRiders() : null}
          />

          {/* Floating Top-Center Payment Pending Card */}
          {order.status === 'payment_pending' && (
            <div className={styles.topPaymentBanner}>
              <div className={styles.topPaymentCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 850, fontSize: '13px', color: 'var(--text-primary)' }}>Awaiting Payment Escrow</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Approve the MoMo/EcoCash push prompt to secure escrow and scan riders.
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  className="btn btn--primary btn--xs"
                  onClick={() => triggerEcoCashUSSDPush(order, ecocashPhone || (country === 'ZM' ? '0971234567' : '0771234567'))}
                  style={{ width: '100%', padding: '6px', fontSize: '11px', marginTop: '6px', fontWeight: 'bold' }}
                >
                  📱 Open USSD Push Simulator
                </button>
              </div>
            </div>
          )}

          {/* Floating Bids Overlay (InDrive layout on map) */}
          {order.status === 'payment_held' && counterOffers.length > 0 && (
            <div className={styles.floatingBidsContainer}>
              {counterOffers.map((offer) => (
                <div key={offer.id} className={styles.floatingBidCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.5rem' }}>🏍️</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{offer.rider_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>⭐ {offer.rider_rating} rating</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--color-success-500)' }}>
                        {formatPrice(Number(offer.counter_offer_amount))}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>counter offer</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      className="btn btn--success btn--sm btn--full"
                      style={{ fontSize: '12px', padding: '6px' }}
                      disabled={respondingToOfferId !== null}
                      onClick={() => handleRespondToOffer(offer.id, 'accept')}
                    >
                      {respondingToOfferId === offer.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      className="btn btn--secondary btn--sm"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      disabled={respondingToOfferId !== null}
                      onClick={() => handleRespondToOffer(offer.id, 'decline')}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pulsing Radar Scanning Overlay over Map */}
          {order.status === 'payment_held' && (
            <div className={styles.radarOverlay}>
              {/* Giant transparent radial pulsing lines centered on map area */}
              <div className={styles.largeRadarSweep}></div>
              <div className={`${styles.largeRadarCircle} ${styles.radarCircle1}`}></div>
              <div className={`${styles.largeRadarCircle} ${styles.radarCircle2}`}></div>
              <div className={`${styles.largeRadarCircle} ${styles.radarCircle3}`}></div>

              {/* Compact Floating Matching Card */}
              <div className={styles.radarCardCompact}>
                <div className={styles.radarMiniPulse}>
                  <div className={styles.miniCore}>🔍</div>
                  <div className={styles.miniPulseCircle}></div>
                </div>
                <div className={styles.radarInfoCompact}>
                  <h3 className={styles.scanStatusTitle}>{getScanningStatusText()}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <span className={styles.scanOfferBadge}>
                      Offer: {formatPrice(order.delivery_fee ?? 5.0)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--xs"
                      onClick={async () => {
                        await OrderService.updateOrderStatus(order.id, 'cancelled', 'Cancelled search by customer');
                        router.push('/dashboard');
                      }}
                      style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold' }}
                    >
                      Cancel Search
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time simulation log ticker for transparency */}
          <div className="card p-4" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
                onClick={() => triggerEcoCashUSSDPush(order, ecocashPhone || (country === 'ZM' ? '0971234567' : '0771234567'))}
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

          {/* Counter Offers Panel */}
          {order.status === 'payment_held' && (
            <div className="card p-5" style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03))',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '16px',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.25rem' }}>🤝</span>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: '#f59e0b' }}>
                  Incoming Counter Bids ({counterOffers.length})
                </h3>
              </div>
              
              {counterOffers.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                  Awaiting counter-offers from nearby riders...
                  {!OrderService.isOnline && (
                    <button
                      className="btn btn--secondary btn--xs btn--full"
                      style={{ marginTop: '8px' }}
                      onClick={handleSimulateCounterOffer}
                    >
                      💡 Simulate Rider Bid
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {counterOffers.map((offer) => (
                    <div key={offer.id} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-700)' }}>
                            {offer.rider_name ? offer.rider_name[0] : 'R'}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{offer.rider_name || 'Rider'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>⭐ {offer.rider_rating || '4.8'} rating</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--color-success-400)' }}>
                            {formatPrice(Number(offer.counter_offer_amount))}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>payout</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          className="btn btn--success btn--sm btn--full"
                          style={{ fontSize: '0.75rem', padding: '6px' }}
                          disabled={respondingToOfferId !== null}
                          onClick={() => handleRespondToOffer(offer.id, 'accept')}
                        >
                          {respondingToOfferId === offer.id ? 'Accepting...' : 'Accept Bid'}
                        </button>
                        <button
                          className="btn btn--secondary btn--sm"
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          disabled={respondingToOfferId !== null}
                          onClick={() => handleRespondToOffer(offer.id, 'decline')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rider profile card */}
          {order.assigned_rider_id && (
            <div className={styles.riderCard}>
              <div className={styles.riderInfo}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
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
                <button 
                  type="button" 
                  className="btn btn--secondary btn--sm font-medium"
                  onClick={() => setShowCallSimulator(true)}
                >
                  📞 Call Rider
                </button>
                <button 
                  type="button" 
                  className="btn btn--secondary btn--sm font-medium"
                  onClick={() => setShowChatDrawer(true)}
                >
                  💬 Message
                </button>
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
              <span>{formatPrice(order.delivery_fee ?? 0)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Service fee</span>
              <span>{formatPrice(order.service_fee ?? 0)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>🛡️ Protection fee</span>
              <span>{formatPrice(order.protection_fee ?? 0)}</span>
            </div>
            <hr className="divider" />
            <div className={`${styles.priceRow} ${styles.priceTotal}`}>
              <span>Total</span>
              <span>{formatPrice(order.total_amount ?? 0)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button 
              type="button" 
              className="btn btn--secondary btn--full"
              onClick={() => setShowDisputeModal(true)}
            >
              ⚖️ Report Issue / File Dispute
            </button>
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <button 
                type="button" 
                className="btn btn--danger btn--full font-bold"
                onClick={handleCustomerSos}
                style={{ background: '#dc2626', color: '#ffffff', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)' }}
              >
                🆘 Trigger SOS Emergency
              </button>
            )}
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
                Cancel Order
              </button>
            )}
          </div>
        </div>
      </div>
      {showEcoCashOverlay && (() => {
        const activeMethod = order.payment_method || (launchMtnMomo ? 'mtn_momo' : launchAirtelMoney ? 'airtel_money' : 'ecocash');
        const theme = getModalStyles(activeMethod);
        const providerName = activeMethod === 'mtn_momo' ? 'MTN MoMo' : activeMethod === 'airtel_money' ? 'Airtel Money' : 'EcoCash';
        
        return (
          <div className={styles.ecocashOverlay}>
            <div className={styles.ecocashModal} style={theme.modal}>
              <div className={styles.ecocashHeader}>
                <div className={styles.ecocashBrandIcon} style={theme.brandIcon}>
                  {activeMethod === 'mtn_momo' ? '🟡' : activeMethod === 'airtel_money' ? '🔴' : '📱'}
                </div>
                <div>
                  <div className={styles.ecocashTitle} style={theme.title}>{providerName} Payment</div>
                  <div className={styles.ecocashSubtitle} style={theme.subtitle}>USSD Push Notification Simulator</div>
                </div>
              </div>
              
              <div className={styles.ecocashBody}>
                <div className={styles.ecocashSandboxBadge} style={theme.sandboxBadge}>DEVELOPER SANDBOX</div>
                <p style={{ fontSize: '13px', color: theme.body?.color || 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.4' }}>
                  A simulated USSD push prompt has been broadcasted to the customer's mobile device:
                </p>
                
                <div className={styles.ecocashDetails} style={theme.details}>
                  <div className={styles.ecocashDetailRow}>
                    <span className={styles.ecocashDetailLabel} style={theme.detailLabel}>Phone Number:</span>
                    <span className={styles.ecocashDetailValue} style={theme.detailValue}>{ecocashPhone}</span>
                  </div>
                  <div className={styles.ecocashDetailRow}>
                    <span className={styles.ecocashDetailLabel} style={theme.detailLabel}>Amount Due:</span>
                    <span className={styles.ecocashDetailValue} style={theme.detailValue}>{formatPrice(order.total_amount ?? 0)}</span>
                  </div>
                  <div className={styles.ecocashDetailRow}>
                    <span className={styles.ecocashDetailLabel} style={theme.detailLabel}>Reference Code:</span>
                    <span className={styles.ecocashDetailValue} style={{ ...theme.detailValue, fontFamily: 'var(--font-mono)' }}>{order.reference_code}</span>
                  </div>
                </div>
                
                <div className={styles.ecocashStatusBox} style={theme.statusBox}>
                  {isProcessingEcoCash ? (
                    <>
                      <div className="spinner spinner--md" style={{ color: activeMethod === 'mtn_momo' ? '#000' : activeMethod === 'airtel_money' ? '#fff' : 'var(--color-primary-500)' }} />
                      <div className={styles.ecocashStatusTitle} style={{ ...theme.statusTitle, marginTop: '8px' }}>Processing Ledger Updates...</div>
                    </>
                  ) : (
                    <>
                      <div className={styles.ecocashTimer} style={theme.timer}>{ecocashTimer}s</div>
                      <div className={styles.ecocashStatusTitle} style={theme.statusTitle}>Awaiting USSD PIN authorization...</div>
                      <p className={styles.ecocashStatusDesc} style={theme.statusDesc}>Please approve the {providerName} push prompt on the simulator device below</p>
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
                  style={theme.primaryBtn}
                >
                  {isProcessingEcoCash ? 'Please wait...' : 'Approve Simulated Payment'}
                </button>
                <button 
                  className="btn btn--secondary btn--full"
                  onClick={handleDeclinePayment}
                  disabled={isProcessingEcoCash}
                  style={theme.secondaryBtn}
                >
                  Decline & Cancel Order
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showCallSimulator && (
        <CallSimulator
          orderId={order.id}
          callerId={session?.user_id || 'customer'}
          callerRole="customer"
          receiverName={order.rider?.full_name || 'Tinashe M.'}
          receiverPhone={order.rider?.phone || '+263 77 482 9102'}
          onClose={() => setShowCallSimulator(false)}
        />
      )}

      {showChatDrawer && (
        <ChatDrawer
          orderId={order.id}
          senderId={session?.user_id || 'customer'}
          senderName={session?.full_name || 'Customer'}
          onClose={() => setShowChatDrawer(false)}
        />
      )}

      {showDisputeModal && (
        <div className={styles.ecocashOverlay} style={{ zIndex: 1060 }}>
          <div className={styles.ecocashModal} style={{ maxWidth: '440px' }}>
            <div className={styles.ecocashHeader}>
              <div className={styles.ecocashBrandIcon}>⚖️</div>
              <div>
                <div className={styles.ecocashTitle}>File Order Dispute</div>
                <div className={styles.ecocashSubtitle}>Submit claim for Biker resolution</div>
              </div>
            </div>
            
            <form onSubmit={handleFileDispute}>
              <div className={styles.ecocashBody} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                <div className="form-group">
                  <label className="label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Dispute Reason</label>
                  <select 
                    className="select" 
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '8px', color: 'var(--text-primary)' }}
                  >
                    <option value="wrong_item">Wrong Item / Incorrect Package</option>
                    <option value="damaged">Damaged Package / Broken Content</option>
                    <option value="never_arrived">Never Arrived / Missed Delivery</option>
                    <option value="overcharged">Incorrect Pricing / Overcharged</option>
                    <option value="other">Other Issue</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Severity Level</label>
                  <select 
                    className="select" 
                    value={disputeSeverity}
                    onChange={(e) => setDisputeSeverity(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '8px', color: 'var(--text-primary)' }}
                  >
                    <option value="low">Low (Minor Delay/Pricing dispute)</option>
                    <option value="medium">Medium (Damaged/Wrong Item)</option>
                    <option value="high">High (Lost package/Fraud)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Refund Claimed Amount ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="input" 
                    placeholder={`Max $${(order.total_amount || 0).toFixed(2)}`}
                    value={disputeRefundAmount}
                    onChange={(e) => setDisputeRefundAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Description / Explanation</label>
                  <textarea 
                    className="input" 
                    rows={3}
                    placeholder="Provide details about the issue..."
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    required
                    style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Evidence File URL or Text Description</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Enter image link, photo evidence description, or text link"
                    value={disputeEvidence}
                    onChange={(e) => setDisputeEvidence(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
              </div>
              
              <div className={styles.ecocashActions} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button 
                  type="submit" 
                  className="btn btn--primary btn--full"
                  disabled={submittingDispute}
                >
                  {submittingDispute ? 'Submitting...' : 'File Dispute'}
                </button>
                <button 
                  type="button" 
                  className="btn btn--secondary btn--full"
                  onClick={() => setShowDisputeModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
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
