'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';
import { OrderService } from '@/lib/order-service';
import styles from './new-order.module.css';
import { useGeolocation } from '@/lib/geolocation';
import { reverseGeocode } from '@/lib/geocoding';
import type { ServiceType, FulfillmentMode } from '@/types';
import { GlassCard } from '@/components/primitives/GlassCard';
import { SegmentedControl } from '@/components/primitives/SegmentedControl';

const POPULAR_LOCATIONS = [
  { name: "Sam Levy's Village, Borrowdale", lat: -17.7502, lng: 31.0858 },
  { name: "Avondale Shops, King George Rd", lat: -17.7994, lng: 31.0378 },
  { name: "Eastgate Mall, Harare CBD", lat: -17.8312, lng: 31.0521 },
  { name: "Borrowdale Brooke Golf Estate", lat: -17.7289, lng: 31.1345 },
  { name: "Arundel Office Park, Mount Pleasant", lat: -17.7812, lng: 31.0531 },
  { name: "Joina City, Harare CBD", lat: -17.8306, lng: 31.0494 },
  { name: "Belgravia Shops, Second Street Extension", lat: -17.7932, lng: 31.0468 },
];

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get('type') as ServiceType | null;

  // Profile Context Session
  const { session } = useProfile();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Booking Flow Steps:
  // 'select_pickup' -> 'select_dropoff' -> 'enter_details'
  const [bookingMode, setBookingMode] = useState<'select_pickup' | 'select_dropoff' | 'enter_details'>('select_pickup');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  // Map and Geolocation
  const { coords: gpsCoords, requestLocation, error: gpsError } = useGeolocation();
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-17.8252, 31.0335]); // Harare CBD default
  const [resolvedAddress, setResolvedAddress] = useState('Loading location...');
  const [isDragging, setIsDragging] = useState(false);

  // Form selections
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLandmark, setPickupLandmark] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');

  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLandmark, setDropoffLandmark] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const [serviceType, setServiceType] = useState<ServiceType>(preselectedType || 'send_item');
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('standard');
  const [proposedFare, setProposedFare] = useState<number>(5.00); // InDrive proposed fare
  const [itemDescription, setItemDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ecocash' | 'cash'>('ecocash');

  const mapRef = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);
  const mapId = 'indrive-booking-map';
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Leaflet loader
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

  // Request GPS immediately on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Center map on GPS coords when they load for the first time
  useEffect(() => {
    if (gpsCoords && mapRef.current) {
      mapRef.current.setView(gpsCoords, 15);
      setMapCenter(gpsCoords);
    }
  }, [gpsCoords]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapId);
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }

    const initialCenter = gpsCoords || mapCenter;
    const map = L.map(mapId, {
      zoomControl: false, // Clean UI, manual overlay placement
      attributionControl: false,
    }).setView(initialCenter, 15);
    
    mapRef.current = map;

    // Add standard light-style map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Track map movements
    map.on('movestart', () => {
      setIsDragging(true);
    });

    map.on('move', () => {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
    });

    map.on('moveend', () => {
      setIsDragging(false);
      const center = map.getCenter();
      
      // Debounce nominatim reverse-geocoding calls
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setResolvedAddress('Resolving address...');

      debounceTimerRef.current = setTimeout(async () => {
        const address = await reverseGeocode(center.lat, center.lng);
        setResolvedAddress(address);
      }, 500);
    });

    // Initial reverse geocode
    reverseGeocode(initialCenter[0], initialCenter[1]).then(setResolvedAddress);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Handle GPS blue dot rendering
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !gpsCoords) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear previous marker
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.remove();
    }

    // Create blue pulsing GPS dot
    const gpsIcon = L.divIcon({
      html: `
        <div style="
          width: 16px;
          height: 16px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(37,99,235,0.6);
          position: relative;
        ">
          <div style="
            position: absolute;
            inset: -8px;
            background: rgba(37,99,235,0.3);
            border-radius: 50%;
            animation: pulse 2s infinite ease-out;
          "></div>
        </div>
      `,
      className: 'gps-pulse-dot',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker(gpsCoords, { icon: gpsIcon }).addTo(mapRef.current);
    gpsMarkerRef.current = marker;
  }, [leafletLoaded, gpsCoords]);

  // Recenter map on GPS position
  const handleRecenter = () => {
    if (gpsCoords && mapRef.current) {
      mapRef.current.flyTo(gpsCoords, 16, { animate: true, duration: 1.5 });
    } else {
      requestLocation();
    }
  };

  // Fly to target coordinates
  const flyToCoords = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
    }
  };

  // Step A Confirmation
  const handleConfirmPickup = () => {
    setPickupCoords(mapCenter);
    setPickupAddress(resolvedAddress);
    
    // Switch to Dropoff selecting mode
    setBookingMode('select_dropoff');
    
    // If dropoff exists, center there; otherwise fly slightly away for dynamic feel
    if (dropoffCoords) {
      flyToCoords(dropoffCoords[0], dropoffCoords[1]);
    } else {
      // Offset slightly to simulate panning
      flyToCoords(mapCenter[0] - 0.015, mapCenter[1] + 0.015);
    }
  };

  // Step B Confirmation
  const handleConfirmDropoff = () => {
    setDropoffCoords(mapCenter);
    setDropoffAddress(resolvedAddress);
    
    // Switch to detail specification
    setBookingMode('enter_details');
  };

  // Database-integrated booking submit
  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const customerId = session?.user_id || 'mock-customer-id';
      const pCoords = pickupCoords || [-17.7502, 31.0858];
      const dCoords = dropoffCoords || [-17.7289, 31.1345];

      const orderPayload = {
        customer_id: customerId,
        service_type: serviceType,
        fulfillment_mode: fulfillmentMode,
        protection_level: 'protected',
        pickup_address: pickupAddress,
        pickup_lat: pCoords[0],
        pickup_lng: pCoords[1],
        pickup_contact_name: session?.full_name || 'Customer',
        pickup_contact_phone: pickupPhone || session?.phone || '',
        dropoff_address: dropoffAddress,
        dropoff_lat: dCoords[0],
        dropoff_lng: dCoords[1],
        dropoff_contact_name: 'Receiver',
        dropoff_contact_phone: dropoffPhone,
        dropoff_gate_color: dropoffLandmark,
        item_description: itemDescription || 'Delivery Package',
        delivery_fee: proposedFare,
        service_fee: 0.38,
        protection_fee: 0.50,
        total_amount: proposedFare + 0.38 + 0.50,
        payment_method: paymentMethod,
      };

      const createdOrder = await OrderService.createOrder(orderPayload);
      triggerToast('Order submitted! Finding nearby riders...');

      setIsScanning(true);
      setScanStep(0);
      
      const timer1 = setTimeout(() => setScanStep(1), 1200);
      const timer2 = setTimeout(() => setScanStep(2), 2400);
      const timer3 = setTimeout(() => setScanStep(3), 3600);
      const timer4 = setTimeout(() => {
        router.push(
          `/dashboard/tracking?id=${createdOrder.id}&pLat=${pCoords[0]}&pLng=${pCoords[1]}&dLat=${dCoords[0]}&dLng=${dCoords[1]}&pAddr=${encodeURIComponent(pickupAddress)}&dAddr=${encodeURIComponent(dropoffAddress)}&fare=${proposedFare}&service=${serviceType}&paymentMethod=${paymentMethod}`
        );
      }, 4800);
    } catch (error) {
      console.error('Failed to create order:', error);
      triggerToast('Could not submit booking. Please check connection.');
      setIsSubmitting(false);
    }
  };

  // Radar screen renderer
  if (isScanning) {
    const scanSteps = [
      { text: paymentMethod === 'cash' ? 'Preparing secure COD collection...' : 'Securing escrow payment...', icon: '🔒' },
      { text: `Negotiating fare offer ($${proposedFare.toFixed(2)}) with riders...`, icon: '💰' },
      { text: 'Rider matched! Verifying path...', icon: '🤝' },
      { text: 'Takudzwa M. accepted your fare! Arriving soon...', icon: '✅' },
    ];

    return (
      <div className={styles.radarContainer}>
        <div className={styles.radarOuter}>
          <div className={`${styles.radarCircle} ${styles.radarCircle1}`} />
          <div className={`${styles.radarCircle} ${styles.radarCircle2}`} />
          <div className={`${styles.radarCircle} ${styles.radarCircle3}`} />
          <div className={styles.radarSweep} />
          <div className={styles.radarCore}>📦</div>
          {scanStep >= 1 && <div className={`${styles.radarRider} ${styles.radarRider1}`}>🚴</div>}
          {scanStep >= 2 && <div className={`${styles.radarRider} ${styles.radarRider2}`}>🚴</div>}
        </div>

        <h2 className={styles.scanStatusTitle}>Finding a Rider</h2>
        <p className={styles.scanStatusSubtitle}>
          {scanStep === 0 && (paymentMethod === 'cash' ? 'Setting up cash invoice...' : 'Connecting with escrow...')}
          {scanStep === 1 && 'Waiting for rider counter offers...'}
          {scanStep === 2 && 'Finalizing rider match...'}
          {scanStep === 3 && 'Biker is dispatched!'}
        </p>

        <div className={styles.logsContainer}>
          {scanSteps.map((stepInfo, idx) => {
            const isActive = scanStep === idx;
            const isDone = scanStep > idx;
            return (
              <div
                key={idx}
                className={`${styles.logLine} ${isActive ? styles.logLineActive : ''} ${isDone ? styles.logLineDone : ''}`}
              >
                <span className={styles.logIcon}>
                  {isDone ? '✓' : isActive ? '⏳' : '○'}
                </span>
                <span>{stepInfo.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {toastMsg && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ✨ {toastMsg}
        </div>
      )}
      {/* Map Element */}
      <div className={styles.mapWrapper}>
        <div id={mapId} className={styles.map} />
        {!leafletLoaded && (
          <div className={styles.mapLoading}>
            <span className="spinner spinner--lg" />
            <p>Initializing Live Tracking Map...</p>
          </div>
        )}
      </div>

      {/* Center Pin Overlay (only visible during map pick mode) */}
      {bookingMode !== 'enter_details' && (
        <div className={styles.centerPinContainer}>
          <div className={`${styles.pinAddressBubble}`}>
            {resolvedAddress}
          </div>
          <div className={`${styles.pinEmoji} ${isDragging ? styles.pinActive : ''}`}>
            {bookingMode === 'select_pickup' ? '📍' : '🏁'}
          </div>
          <div className={styles.pinShadow} />
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className={styles.fabContainer} style={{ bottom: bookingMode === 'enter_details' ? '460px' : '260px' }}>
        <button className={styles.fab} title="Center on GPS" onClick={handleRecenter}>
          🎯
        </button>
      </div>

      {/* InDrive-style Glassmorphic Bottom Sheet */}
      <div className={styles.bottomSheet}>
        <div className={styles.dragHandle} />

        {/* STEP 1: Select Pickup */}
        {bookingMode === 'select_pickup' && (
          <>
            <div className={styles.sheetHeader}>
              <h3 className={styles.sheetTitle}>Set Pickup Location</h3>
              <span className={styles.sheetStep}>Pickup</span>
            </div>

            <div className={styles.addressDisplayBox}>
              <span className={styles.addressIcon}>📍</span>
              <div className={styles.addressTextGroup}>
                <span className={styles.addressLabel}>Select location on map</span>
                <span className={styles.addressValue}>{resolvedAddress}</span>
                <input
                  type="text"
                  placeholder="Add gate color, apartment no. or notes"
                  className={styles.landmarkInput}
                  value={pickupLandmark}
                  onChange={(e) => setPickupLandmark(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.suggestionsScroll}>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  className={styles.chip}
                  onClick={() => flyToCoords(loc.lat, loc.lng)}
                >
                  🏫 {loc.name.split(',')[0]}
                </button>
              ))}
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pickup Phone</span>
                {session?.phone ? (
                  <button
                    type="button"
                    onClick={() => { setPickupPhone(session.phone || ''); triggerToast('Filled with your number!'); }}
                    style={{
                      background: 'rgba(37,99,235,0.1)',
                      color: '#2563eb',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    👤 Use my number
                  </button>
                ) : (
                  <span 
                    title="Add a phone number to your profile settings to auto-fill" 
                    style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'help' }}
                  >
                    ℹ️ Profile has no phone
                  </span>
                )}
              </div>
              <input
                type="tel"
                placeholder="Pickup Contact Phone (Optional)"
                className="input"
                value={pickupPhone}
                onChange={(e) => setPickupPhone(e.target.value)}
              />
            </div>

            <button className="btn btn--primary btn--lg btn--full" onClick={handleConfirmPickup}>
              Confirm Pickup Spot
            </button>
          </>
        )}

        {/* STEP 2: Select Dropoff */}
        {bookingMode === 'select_dropoff' && (
          <>
            <div className={styles.sheetHeader}>
              <h3 className={styles.sheetTitle}>Set Delivery Destination</h3>
              <span className={styles.sheetStep}>Destination</span>
            </div>

            <div className={styles.addressDisplayBox}>
              <span className={styles.addressIcon}>🏁</span>
              <div className={styles.addressTextGroup}>
                <span className={styles.addressLabel}>Select destination on map</span>
                <span className={styles.addressValue}>{resolvedAddress}</span>
                <input
                  type="text"
                  placeholder="Gate instructions, color or note"
                  className={styles.landmarkInput}
                  value={dropoffLandmark}
                  onChange={(e) => setDropoffLandmark(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.suggestionsScroll}>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  className={styles.chip}
                  onClick={() => flyToCoords(loc.lat, loc.lng)}
                >
                  🏫 {loc.name.split(',')[0]}
                </button>
              ))}
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Receiver Phone</span>
                {session?.phone ? (
                  <button
                    type="button"
                    onClick={() => { setDropoffPhone(session.phone || ''); triggerToast('Filled with your number!'); }}
                    style={{
                      background: 'rgba(37,99,235,0.1)',
                      color: '#2563eb',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    👤 Use my number
                  </button>
                ) : (
                  <span 
                    title="Add a phone number to your profile settings to auto-fill" 
                    style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'help' }}
                  >
                    ℹ️ Profile has no phone
                  </span>
                )}
              </div>
              <input
                type="tel"
                placeholder="Receiver Contact Phone"
                className="input"
                value={dropoffPhone}
                onChange={(e) => setDropoffPhone(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn--secondary btn--lg" style={{ flex: 1 }} onClick={() => setBookingMode('select_pickup')}>
                Back
              </button>
              <button className="btn btn--primary btn--lg" style={{ flex: 2 }} onClick={handleConfirmDropoff}>
                Confirm Destination
              </button>
            </div>
          </>
        )}

        {/* STEP 3: Enter Details & InDrive proposed price bid */}
        {bookingMode === 'enter_details' && (
          <>
            <div className={styles.sheetHeader}>
              <h3 className={styles.sheetTitle}>Confirm Booking</h3>
              <span className={styles.sheetStep}>3 of 3</span>
            </div>

            {/* Route Recap */}
            <div className={styles.routeSummary}>
              <div className={styles.routePoint}>
                <span style={{ fontSize: '14px' }}>📍</span>
                <span className={styles.routeAddress}>{pickupAddress}</span>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routePoint}>
                <span style={{ fontSize: '14px' }}>🏁</span>
                <span className={styles.routeAddress}>{dropoffAddress}</span>
              </div>
            </div>

            {/* InDrive-style proposed fare control */}
            <div className={styles.fareBidContainer}>
              <span className={styles.fareLabel}>Name Your Fare (Offer Price)</span>
              <div className={styles.fareControlGroup}>
                <button className={styles.fareBtn} onClick={() => setProposedFare(prev => Math.max(2, prev - 0.5))}>
                  -
                </button>
                <div className={styles.fareDisplay}>
                  <span className={styles.fareCurrency}>$</span>
                  {proposedFare.toFixed(2)}
                </div>
                <button className={styles.fareBtn} onClick={() => setProposedFare(prev => prev + 0.5)}>
                  +
                </button>
              </div>
              <span className={styles.fareHint}>Riders match based on your price. Higher bids match faster.</span>
            </div>

            {/* Service Type Picker */}
            <div className={styles.servicePicker}>
              <span className={styles.pickerLabel}>Fulfillment Speed Mode</span>
              <div className={styles.speedSelectRow}>
                <button
                  className={`${styles.speedSelectBtn} ${fulfillmentMode === 'standard' ? styles.speedSelectBtnSelected : ''}`}
                  onClick={() => { setFulfillmentMode('standard'); setProposedFare(5.00); }}
                >
                  🚴 Standard
                </button>
                <button
                  className={`${styles.speedSelectBtn} ${fulfillmentMode === 'jet' ? styles.speedSelectBtnSelected : ''}`}
                  onClick={() => { setFulfillmentMode('jet'); setProposedFare(6.50); }}
                >
                  ⚡ Biker Jet
                </button>
                <button
                  className={`${styles.speedSelectBtn} ${fulfillmentMode === 'scheduled_saver' ? styles.speedSelectBtnSelected : ''}`}
                  onClick={() => { setFulfillmentMode('scheduled_saver'); setProposedFare(4.00); }}
                >
                  📅 Saver
                </button>
              </div>
            </div>

            {/* Payment Method Picker */}
            <div className={styles.servicePicker}>
              <span className={styles.pickerLabel} style={{ marginBottom: '0.375rem', display: 'block' }}>Payment Method</span>
              <SegmentedControl
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as 'ecocash' | 'cash')}
                options={[
                  { value: 'ecocash', label: 'EcoCash', icon: '💳' },
                  { value: 'cash', label: 'Cash on Delivery', icon: '💵' },
                ]}
              />
              
              {paymentMethod === 'cash' && (
                <div style={{
                  marginTop: '0.625rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '0.75rem 0.875rem',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>🔒</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#34d399' }}>
                        Secure Cash Collection
                      </p>
                      <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4 }}>
                        Rider will collect <strong>${(proposedFare + 0.38 + 0.50).toFixed(2)}</strong> in cash at delivery. 
                        A secure 4-digit PIN is generated; provide it to the rider only after receiving your items.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Package details */}
            <div className={styles.detailsFields}>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="What are we delivering? (e.g. Laptop, Documents)"
                  className="input"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn--secondary btn--lg" style={{ flex: 1 }} onClick={() => setBookingMode('select_dropoff')}>
                Back
              </button>
              <button className="btn btn--primary btn--lg" style={{ flex: 2 }} onClick={handlePlaceOrder}>
                Send Offer to Riders
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-6"><span className="spinner spinner--lg" /></div>}>
      <NewOrderContent />
    </Suspense>
  );
}
