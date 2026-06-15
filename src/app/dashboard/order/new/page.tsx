'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PricingService, PricingEstimate } from '@/lib/pricing';
import { OrderService } from '@/lib/order-service';
import Link from 'next/link';
import { useProfile } from '@/context/ProfileContext';
import { reverseGeocode, searchAddress } from '@/lib/geocoding';
import styles from './new-order.module.css';
import SurgeMeter from '@/components/SurgeMeter';
import SmartOrderChat, { SmartOrderChatToggle } from '@/components/SmartOrderChat';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import PaymentMethodSelector, { PaymentMethodType } from '@/components/PaymentMethodSelector';
import EscrowBadge from '@/components/EscrowBadge';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface AutocompleteResult {
  address: string;
  lat: number;
  lng: number;
}

interface NearbyRider {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { country } = useProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Page Step: 'location' (selecting points) or 'fare_details' (confirming bid & contact details)
  const [step, setStep] = useState<'location' | 'fare_details'>('location');
  const hasGeolocatedRef = useRef(false);
  const [locationAccessBlocked, setLocationAccessBlocked] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [showChatMode, setShowChatMode] = useState(false);

  // Map & Geolocation States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<[number, number]>(
    country === 'ZM' ? [-15.3875, 28.3228] : [-17.8292, 31.0522] // Defaults
  );
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [nearbyRiders, setNearbyRiders] = useState<NearbyRider[]>([]);

  // Robust double-accuracy GPS snapper helper
  const snapToCurrentLocation = (explicitTrigger = false) => {
    if (!('geolocation' in navigator)) {
      if (explicitTrigger) alert('Geolocation is not supported by your browser.');
      reverseGeocode(pickupCoords[0], pickupCoords[1]).then(addr => {
        setPickupAddress(addr);
        setPickupSearch(addr);
      });
      return;
    }

    setIsGeolocating(true);
    setLocationAccessBlocked(false);

    const onSuccess = async (pos: any) => {
      const { latitude, longitude } = pos.coords;
      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 15);
      }
      setPickupCoords([latitude, longitude]);
      hasGeolocatedRef.current = true;
      setIsGeolocating(false);
      
      try {
        const addr = await reverseGeocode(latitude, longitude);
        setPickupAddress(addr);
        setPickupSearch(addr);
      } catch (e) {
        console.error(e);
      }
    };

    const onError = (err: any) => {
      console.warn(`Geolocation error (${err.code}): ${err.message}. Retrying with low accuracy...`);
      if (err.code === 1) { // PERMISSION_DENIED
        setLocationAccessBlocked(true);
        setIsGeolocating(false);
        if (explicitTrigger) {
          alert('📍 Location access is blocked. Please enable location permission in your browser address bar settings to snap GPS.');
        }
        reverseGeocode(pickupCoords[0], pickupCoords[1]).then(addr => {
          setPickupAddress(addr);
          setPickupSearch(addr);
        });
        return;
      }

      // Drop down to low accuracy WiFi/Cellular/IP triangulation
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err2) => {
          console.error(`Final Geolocation error (${err2.code}): ${err2.message}`);
          setIsGeolocating(false);
          if (err2.code === 1) {
            setLocationAccessBlocked(true);
          }
          if (explicitTrigger) {
            alert('📍 GPS signal lock timed out. Try typing your location or checking your internet connection.');
          }
          reverseGeocode(pickupCoords[0], pickupCoords[1]).then(addr => {
            setPickupAddress(addr);
            setPickupSearch(addr);
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000
        }
      );
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });
  };

  const handleChatOrderParsed = (order: any) => {
    if (order.pickupAddress) {
      setPickupAddress(order.pickupAddress);
      setPickupSearch(order.pickupAddress);
    }
    if (order.pickupCoords) {
      setPickupCoords(order.pickupCoords);
      if (mapRef.current) mapRef.current.setView(order.pickupCoords, 14);
    }
    if (order.dropoffAddress) {
      setDropoffAddress(order.dropoffAddress);
      setDropoffSearch(order.dropoffAddress);
    }
    if (order.dropoffCoords) {
      setDropoffCoords(order.dropoffCoords);
    }
    if (order.itemCategory) setItemCategory(order.itemCategory);
    if (order.fulfillmentMode) setFulfillmentMode(order.fulfillmentMode);
    if (order.confidence >= 100) {
      setShowChatMode(false);
    }
  };

  // Address Inputs & Autocomplete States
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<AutocompleteResult[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AutocompleteResult[]>([]);
  const [isPickupFocused, setIsPickupFocused] = useState(false);
  const [isDropoffFocused, setIsDropoffFocused] = useState(false);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  const [isMapDragging, setIsMapDragging] = useState(false);

  // Form States
  const [itemCategory, setItemCategory] = useState<'document' | 'food' | 'parcel' | 'car_part' | 'buy_for_me'>('parcel');
  const [shoppingItems, setShoppingItems] = useState<{ name: string; quantity: number; estPrice: number }[]>([
    { name: '', quantity: 1, estPrice: 0.0 }
  ]);
  const [cargoWeight, setCargoWeight] = useState<string>('1'); // for parcels/parts
  const [itemDescription, setItemDescription] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<'standard' | 'jet' | 'scheduled_saver'>('standard');
  const [protectionLevel, setProtectionLevel] = useState<'protected' | 'none' | 'premium_secure'>('none');
  
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [dropoffName, setDropoffName] = useState('');
  const [dropoffGateColor, setDropoffGateColor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('ecocash');

  // Bidding & Pricing States
  const [suggestedBasePrice, setSuggestedBasePrice] = useState(5.0);
  const [userOfferPrice, setUserOfferPrice] = useState<number>(5.0);
  const [estimate, setEstimate] = useState<PricingEstimate | null>(null);

  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const nearbyRiderMarkersRef = useRef<any[]>([]);
  const mapId = 'leaflet-booking-map';

  // Sync default payment mode and map center based on Country
  useEffect(() => {
    if (hasGeolocatedRef.current) return;
    if (country === 'ZM') {
      setPaymentMethod('ecocash');
      setPickupCoords([-15.3875, 28.3228]);
    } else {
      setPaymentMethod('ecocash');
      setPickupCoords([-17.8292, 31.0522]);
    }
  }, [country]);

  // Fetch logged in User
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUser();
  }, []);

  // Load Leaflet Libraries dynamically
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

    const map = L.map(mapId, {
      zoomControl: false,
      scrollWheelZoom: true,
    }).setView(pickupCoords, 14);

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Setup map drag listeners for center pin address reverse-geocoding
    map.on('movestart', () => {
      setIsMapDragging(true);
    });

    map.on('moveend', async () => {
      setIsMapDragging(false);
      if (step === 'location') {
        const center = map.getCenter();
        const lat = center.lat;
        const lng = center.lng;
        setPickupCoords([lat, lng]);
        hasGeolocatedRef.current = true;
        
        // Reverse Geocode centered coordinates
        try {
          const addr = await reverseGeocode(lat, lng);
          setPickupAddress(addr);
          setPickupSearch(addr);
        } catch (e) {
          console.error(e);
        }
      }
    });

    // Auto GPS geolocation on mount
    snapToCurrentLocation(false);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Generate & Render simulated nearby riders around pickup coordinates
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || step !== 'location') return;
    const L = (window as any).L;
    if (!L) return;

    // Remove old nearby rider markers
    nearbyRiderMarkersRef.current.forEach(m => m.remove());
    nearbyRiderMarkersRef.current = [];

    // Generate stable offsets around pickup
    const ridersData: NearbyRider[] = [
      { id: 'nr1', name: 'Tinashe M.', lat: pickupCoords[0] + 0.003, lng: pickupCoords[1] - 0.004 },
      { id: 'nr2', name: 'Farai K.', lat: pickupCoords[0] - 0.002, lng: pickupCoords[1] + 0.003 },
      { id: 'nr3', name: 'Alfonso Z.', lat: pickupCoords[0] + 0.004, lng: pickupCoords[1] + 0.002 },
      { id: 'nr4', name: 'Chipo D.', lat: pickupCoords[0] - 0.003, lng: pickupCoords[1] - 0.002 },
    ];
    setNearbyRiders(ridersData);

    // Render riders on map
    ridersData.forEach(r => {
      const icon = L.divIcon({
        html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); animation: floatRider 2s ease-in-out infinite alternate;">🏍️</div>`,
        className: 'leaflet-nearby-rider-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([r.lat, r.lng], { icon })
        .addTo(mapRef.current)
        .bindPopup(`<b>${r.name}</b> (Nearby Rider)`);
      nearbyRiderMarkersRef.current.push(marker);
    });
  }, [pickupCoords, step, leafletLoaded]);

  // Draw Route Polyline & Bounds on transition to Step 2 (fare_details)
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear nearby rider markers in Step 2 to declutter map
    if (step === 'fare_details') {
      nearbyRiderMarkersRef.current.forEach(m => m.remove());
      nearbyRiderMarkersRef.current = [];
    }

    // Manage standard markers
    if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
    if (dropoffMarkerRef.current) dropoffMarkerRef.current.remove();
    if (routePolylineRef.current) routePolylineRef.current.remove();

    if (step === 'fare_details' && dropoffCoords) {
      // 1. Create Pickup & Dropoff Markers
      const pickupIcon = L.divIcon({
        html: `<div style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏪</div>`,
        className: 'leaflet-pickup-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const dropoffIcon = L.divIcon({
        html: `<div style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏠</div>`,
        className: 'leaflet-dropoff-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      pickupMarkerRef.current = L.marker(pickupCoords, { icon: pickupIcon }).addTo(mapRef.current);
      dropoffMarkerRef.current = L.marker(dropoffCoords, { icon: dropoffIcon }).addTo(mapRef.current);

      // 2. Fetch optimal street route from OSRM
      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropoffCoords[1]},${dropoffCoords[0]}?geometries=geojson&overview=full`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            routePolylineRef.current = L.polyline(coords, {
              color: '#3b82f6',
              weight: 5,
              opacity: 0.85,
              className: 'movingRouteLine',
            }).addTo(mapRef.current);
            return;
          }
        } catch (e) {
          console.warn('OSRM routing failed, drawing straight line', e);
        }

        // Direct straight line fallback
        routePolylineRef.current = L.polyline([pickupCoords, dropoffCoords], {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
        }).addTo(mapRef.current);
      };

      fetchRoute().then(() => {
        // Zoom map bounds to fit both points
        const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      });
    }
  }, [step, pickupCoords, dropoffCoords, leafletLoaded]);

  // Debounced search query triggers for Autocomplete
  useEffect(() => {
    if (!pickupSearch || pickupSearch.length < 2 || !isPickupFocused) {
      setPickupSuggestions([]);
      return;
    }
    setSearchingPickup(true);
    const delay = setTimeout(async () => {
      const res = await searchAddress(pickupSearch, country || 'ZW');
      setPickupSuggestions(res);
      setSearchingPickup(false);
    }, 400);
    return () => clearTimeout(delay);
  }, [pickupSearch, isPickupFocused]);

  useEffect(() => {
    if (!dropoffSearch || dropoffSearch.length < 2 || !isDropoffFocused) {
      setDropoffSuggestions([]);
      return;
    }
    setSearchingDropoff(true);
    const delay = setTimeout(async () => {
      const res = await searchAddress(dropoffSearch, country || 'ZW');
      setDropoffSuggestions(res);
      setSearchingDropoff(false);
    }, 400);
    return () => clearTimeout(delay);
  }, [dropoffSearch, isDropoffFocused]);

  // Calculate pricing estimates when route coordinates change
  useEffect(() => {
    if (!dropoffCoords) return;

    const est = PricingService.estimateFare({
      pickupLat: pickupCoords[0],
      pickupLng: pickupCoords[1],
      dropoffLat: dropoffCoords[0],
      dropoffLng: dropoffCoords[1],
      fulfillmentMode,
      protectionLevel,
    });

    setEstimate(est);
    setSuggestedBasePrice(est.baseFare);
    setUserOfferPrice(est.baseFare);
  }, [pickupCoords, dropoffCoords, fulfillmentMode, protectionLevel]);

  // Format prices with currency tags based on active region
  const formatPrice = (usdVal: number) => {
    if (country === 'ZM') {
      return `ZK ${(usdVal * 25).toFixed(2)}`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const handleSelectPickupSuggestion = (s: AutocompleteResult) => {
    setPickupCoords([s.lat, s.lng]);
    setPickupAddress(s.address);
    setPickupSearch(s.address);
    setPickupSuggestions([]);
    setIsPickupFocused(false);
    hasGeolocatedRef.current = true;
    if (mapRef.current) {
      mapRef.current.setView([s.lat, s.lng], 15);
    }
  };

  const handleSelectDropoffSuggestion = (s: AutocompleteResult) => {
    setDropoffCoords([s.lat, s.lng]);
    setDropoffAddress(s.address);
    setDropoffSearch(s.address);
    setDropoffSuggestions([]);
    setIsDropoffFocused(false);
  };

  // Pricing controls (Increment/Decrement)
  const adjustBid = (amount: number) => {
    setUserOfferPrice(prev => {
      const next = prev + amount;
      return next > 1.0 ? Math.round(next * 10) / 10 : prev;
    });
  };

  const handleConfirmLocations = async () => {
    let resolvedPickupCoords = pickupCoords;
    let resolvedPickupAddress = pickupAddress;
    
    setLoading(true);
    setError('');

    // 1. Check if pickup needs resolution
    if (pickupSearch && pickupSearch.trim() !== pickupAddress.trim()) {
      try {
        const results = await searchAddress(pickupSearch, country || 'ZW');
        if (results && results.length > 0) {
          resolvedPickupCoords = [results[0].lat, results[0].lng];
          resolvedPickupAddress = results[0].address;
          setPickupCoords(resolvedPickupCoords);
          setPickupAddress(resolvedPickupAddress);
          setPickupSearch(resolvedPickupAddress);
          hasGeolocatedRef.current = true;
          if (mapRef.current) {
            mapRef.current.setView(resolvedPickupCoords, 15);
          }
        }
      } catch (e) {
        console.error('Failed to geocode pickup address', e);
      }
    }

    // 2. Check if dropoff needs resolution
    let resolvedDropoffCoords = dropoffCoords;
    let resolvedDropoffAddress = dropoffAddress;
    if (dropoffSearch && (!dropoffCoords || dropoffSearch.trim() !== dropoffAddress.trim())) {
      try {
        const results = await searchAddress(dropoffSearch, country || 'ZW');
        if (results && results.length > 0) {
          resolvedDropoffCoords = [results[0].lat, results[0].lng];
          resolvedDropoffAddress = results[0].address;
          setDropoffCoords(resolvedDropoffCoords);
          setDropoffAddress(resolvedDropoffAddress);
          setDropoffSearch(resolvedDropoffAddress);
        }
      } catch (e) {
        console.error('Failed to geocode dropoff address', e);
      }
    }

    setLoading(false);

    if (!resolvedPickupAddress || !resolvedDropoffCoords) {
      setError('Please choose a valid pickup and dropoff point');
      return;
    }

    setStep('fare_details');
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('You must be logged in to create an order');
      return;
    }
    if (!pickupAddress || !dropoffCoords || !pickupPhone || !dropoffPhone) {
      setError('Please fill in all contact phone numbers');
      return;
    }

    setLoading(true);
    setError('');

    // Compute dynamic fees scaled to the user's custom bid payout
    const bidScale = userOfferPrice / suggestedBasePrice;
    const finalServiceFee = estimate ? Math.round(estimate.serviceFee * bidScale * 100) / 100 : 0.38;
    const finalProtectionFee = estimate?.protectionFee ?? 0.0;
    const finalTotal = userOfferPrice + finalServiceFee + finalProtectionFee;

    // Custom items weight label formatting
    const finalItemDesc = itemCategory === 'document' 
      ? `📄 Document: ${itemDescription || 'Delivery papers'}`
      : itemCategory === 'food'
      ? `🍔 Food Order: ${itemDescription || 'Hot meal packaging'}`
      : itemCategory === 'buy_for_me'
      ? `🛒 Buy For Me: ${itemDescription || 'Shopping purchase'}`
      : `${itemCategory === 'car_part' ? '⚙️ Car Part' : '📦 Parcel'} (${cargoWeight} kg): ${itemDescription || 'Cargo parcel'}`;

    try {
      const payload: any = {
        customer_id: userId,
        service_type: itemCategory === 'document' ? 'document_run' : 
                      itemCategory === 'food' ? 'pickup_order' : 
                      itemCategory === 'buy_for_me' ? 'buy_for_me' : 'send_item',
        fulfillment_mode: fulfillmentMode,
        protection_level: protectionLevel,
        pickup_address: pickupAddress,
        pickup_contact_name: pickupName || 'Sender',
        pickup_contact_phone: pickupPhone,
        pickup_lat: pickupCoords[0],
        pickup_lng: pickupCoords[1],
        dropoff_address: dropoffAddress,
        dropoff_contact_name: dropoffName || 'Recipient',
        dropoff_contact_phone: dropoffPhone,
        dropoff_lat: dropoffCoords[0],
        dropoff_lng: dropoffCoords[1],
        dropoff_gate_color: dropoffGateColor || undefined,
        item_description: finalItemDesc,
        delivery_fee: userOfferPrice,
        service_fee: finalServiceFee,
        protection_fee: finalProtectionFee,
        total_amount: finalTotal,
        payment_method: paymentMethod,
      };

      if (itemCategory === 'buy_for_me') {
        const validItems = shoppingItems.filter(item => item.name.trim().length > 0);
        payload.shopping_list = validItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          est_price: item.estPrice,
          substitution_ok: true
        }));
        payload.estimated_item_cost = validItems.reduce((sum, item) => sum + (item.estPrice * item.quantity), 0);
      }

      const result = await OrderService.createOrder(payload);

      if (result) {
        // Redirect to tracking matching route, carrying payment trigger parameters
        const payParam = paymentMethod === 'cash' ? 'cash' : paymentMethod;
        router.push(`/dashboard/tracking?id=${result.id}&pay=${payParam}&phone=${encodeURIComponent(pickupPhone)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place delivery dispatch');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Full-screen Leaflet Map Backdrop */}
      <div className={styles.mapWrapper}>
        <div id={mapId} className={styles.map} />
        {!leafletLoaded && (
          <div className={styles.mapLoading}>
            <span className="spinner spinner--lg" />
            <span>Loading Map Engine...</span>
          </div>
        )}
      </div>

      {/* Floating Center Crosshair Pin - visible only when picking pickup in Step 1 */}
      {step === 'location' && leafletLoaded && (
        <div className={styles.centerPinContainer}>
          <div className={`${styles.pinAddressBubble} ${isMapDragging ? 'opacity-70' : ''}`}>
            {isMapDragging ? 'Snapping position...' : pickupAddress || 'My Location'}
          </div>
          <div className={`${styles.pinEmoji} ${isMapDragging ? styles.pinActive : ''}`} style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PremiumIcon name="MapPin" variant="danger" animate="bounce" size={36} glow />
          </div>
          <div className={styles.pinShadow} />
        </div>
      )}

      {/* Floating Header Navigation Back Button */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => {
            if (step === 'fare_details') {
              setStep('location');
            } else {
              router.push('/dashboard');
            }
          }}
          className="btn btn--secondary btn--sm shadow-lg font-bold"
          style={{ background: 'var(--bg-card)', backdropFilter: 'blur(10px)' }}
        >
          ← Back
        </button>
      </div>

      {/* Floating GPS Snap Button */}
      {leafletLoaded && (
        <button
          type="button"
          onClick={() => snapToCurrentLocation(true)}
          className={styles.gpsFab}
          title="Snap to Current Location"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <PremiumIcon name="Compass" variant="primary" animate="spin-slow" size={24} glow />
        </button>
      )}

      {/* Floating Glassmorphic Booking Console Sheet */}
      <BottomSheet
        isOpen={true}
        onClose={() => router.push('/dashboard')}
        snapPoints={['half', 'full']}
        defaultSnap="half"
        showCloseButton={false}
        overlayClassName={styles.mapOverlaySheet}
      >
        {error && (
          <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PremiumIcon name="AlertTriangle" variant="danger" size={14} />
            <span>{error}</span>
          </div>
        )}

        {step === 'location' ? (
          /* ================= STEP 1: LOCATIONS & CATEGORY ================= */
          <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>Instant Send ⚡</h2>
              <span className={styles.sheetStep}>Step 1 of 2</span>
            </div>

            <SurgeMeter country={country} compact />

            {showChatMode ? (
              <SmartOrderChat country={country} onOrderParsed={handleChatOrderParsed} onClose={() => setShowChatMode(false)} />
            ) : (
              <SmartOrderChatToggle onClick={() => setShowChatMode(true)} />
            )}

            {locationAccessBlocked && (
              <div className="alert alert--warning" style={{ fontSize: '11px', padding: '6px 10px', margin: '4px 0 8px 0', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <PremiumIcon name="MapPin" variant="warning" size={14} />
                <div>
                  <strong>Location Access Blocked</strong>: Auto GPS tracking is blocked. Please enable location permission in your browser address bar or type address manually.
                </div>
              </div>
            )}
            {isGeolocating && (
              <div style={{ fontSize: '11px', color: 'var(--color-primary-500)', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 10px 0' }}>
                <span style={{ width: '12px', height: '12px', border: '2px solid var(--color-primary-500)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> Snapping to GPS location...
              </div>
            )}

            {/* Address Search Engine Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className={styles.searchContainer}>
                <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pickup location (Drag map or search)
                </label>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Type pickup place..."
                  value={pickupSearch}
                  onChange={(e) => setPickupSearch(e.target.value)}
                  onFocus={() => setIsPickupFocused(true)}
                  onBlur={() => setTimeout(() => setIsPickupFocused(false), 200)}
                />
                {searchingPickup && <span className={styles.searchSpinner}>⏳</span>}
                {isPickupFocused && pickupSuggestions.length > 0 && (
                  <div className={styles.searchSuggestions}>
                    {pickupSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        className={styles.suggestionItem}
                        onClick={() => handleSelectPickupSuggestion(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}
                      >
                        <PremiumIcon name="MapPin" variant="info" size={14} />
                        <span>{s.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.searchContainer}>
                <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Where are you sending to? *
                </label>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search destination landmarks..."
                  value={dropoffSearch}
                  onChange={(e) => setDropoffSearch(e.target.value)}
                  onFocus={() => setIsDropoffFocused(true)}
                  onBlur={() => setTimeout(() => setIsDropoffFocused(false), 200)}
                />
                {searchingDropoff && <span className={styles.searchSpinner}>⏳</span>}
                {isDropoffFocused && dropoffSuggestions.length > 0 && (
                  <div className={styles.searchSuggestions}>
                    {dropoffSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        className={styles.suggestionItem}
                        onClick={() => handleSelectDropoffSuggestion(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}
                      >
                        <PremiumIcon name="Flag" variant="danger" size={14} />
                        <span>{s.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category Selectors */}
            <div className={styles.servicePicker}>
              <span className={styles.pickerLabel}>What type of item?</span>
              <div className={styles.serviceGrid} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'document' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('document')}
                >
                  <span className={styles.serviceIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PremiumIcon name="FileText" variant="info" size={20} glow={itemCategory === 'document'} />
                  </span>
                  <span className={styles.serviceName}>Document</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'food' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('food')}
                >
                  <span className={styles.serviceIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PremiumIcon name="Utensils" variant="success" size={20} glow={itemCategory === 'food'} />
                  </span>
                  <span className={styles.serviceName}>Food</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'parcel' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('parcel')}
                >
                  <span className={styles.serviceIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PremiumIcon name="Package" variant="primary" size={20} glow={itemCategory === 'parcel'} />
                  </span>
                  <span className={styles.serviceName}>Parcel</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'car_part' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('car_part')}
                >
                  <span className={styles.serviceIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PremiumIcon name="Settings" variant="neutral" size={20} glow={itemCategory === 'car_part'} />
                  </span>
                  <span className={styles.serviceName}>Car Part</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'buy_for_me' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('buy_for_me')}
                >
                  <span className={styles.serviceIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PremiumIcon name="ShoppingCart" variant="warning" size={20} glow={itemCategory === 'buy_for_me'} />
                  </span>
                  <span className={styles.serviceName}>Buy For Me</span>
                </button>
              </div>
            </div>

            {/* Dynamic items builder for "Buy For Me" */}
            {itemCategory === 'buy_for_me' && (
              <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" style={{ fontSize: '12px', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PremiumIcon name="ShoppingCart" variant="warning" size={16} />
                    <span>Items to Purchase</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Total Budget: {formatPrice(shoppingItems.reduce((sum, item) => sum + (item.estPrice * item.quantity), 0))}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {shoppingItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Item name (e.g. Milk)"
                        className="input"
                        value={item.name}
                        onChange={(e) => {
                          const next = [...shoppingItems];
                          next[idx].name = e.target.value;
                          setShoppingItems(next);
                        }}
                        style={{ flex: 3, height: '34px', fontSize: '13px', padding: '6px' }}
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        className="input"
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const next = [...shoppingItems];
                          next[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                          setShoppingItems(next);
                        }}
                        style={{ flex: 1, height: '34px', fontSize: '13px', padding: '6px', textAlign: 'center' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1.5, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {country === 'ZM' ? 'ZK' : '$'}
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Price"
                          className="input"
                          value={item.estPrice === 0 ? '' : (country === 'ZM' ? (item.estPrice * 25).toString() : item.estPrice.toString())}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.0;
                            const next = [...shoppingItems];
                            if (country === 'ZM') {
                              next[idx].estPrice = val / 25;
                            } else {
                              next[idx].estPrice = val;
                            }
                            setShoppingItems(next);
                          }}
                          style={{ width: '100%', height: '34px', fontSize: '13px', padding: '6px 6px 6px 18px' }}
                        />
                      </div>
                      {shoppingItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setShoppingItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                        >
                          <PremiumIcon name="Trash2" variant="danger" size={16} animate="spring" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  className="btn btn--secondary btn--xs"
                  onClick={() => setShoppingItems(prev => [...prev, { name: '', quantity: 1, estPrice: 0.0 }])}
                  style={{ width: '100%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <PremiumIcon name="Plus" variant="primary" size={14} />
                  <span>Add Shopping Item</span>
                </button>
              </div>
            )}

            {/* Dynamic weight fields for Cargo (Parcel & Parts) */}
            {(itemCategory === 'parcel' || itemCategory === 'car_part') && (
              <div className="card p-4" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Cargo Weight (kg)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="input"
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(e.target.value)}
                    style={{ height: '38px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ flex: 2, fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <PremiumIcon name="Scale" variant="warning" size={16} />
                  <span>Motorcycle capacity is capped at 30kg. Ensure cargo is boxable.</span>
                </div>
              </div>
            )}

            <button
              onClick={handleConfirmLocations}
              disabled={!pickupAddress || !dropoffCoords}
              className="btn btn--primary btn--lg btn--full"
              style={{ marginTop: '8px' }}
            >
              Continue to Dispatch Details
            </button>
          </>
        ) : (
          /* ================= STEP 2: BIDDING & CONTACTS ================= */
          <form onSubmit={handleSubmitBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>Confirm Dispatch Details</h2>
              <span className={styles.sheetStep}>Step 2 of 2</span>
            </div>

            <div className={styles.routeSummary}>
              <div className={styles.routePoint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PremiumIcon name="Store" variant="primary" size={16} />
                <span className={styles.routeAddress}>{pickupAddress}</span>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routePoint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PremiumIcon name="Flag" variant="danger" size={16} />
                <span className={styles.routeAddress}>{dropoffAddress}</span>
              </div>
            </div>

            {/* InDrive-style Name Your Price Bid card */}
            <div className={styles.fareBidContainer}>
              <span className={styles.fareLabel}>Name Your Payout Offer</span>
              
              <div className={styles.fareControlGroup}>
                <button type="button" className={styles.fareBtn} onClick={() => adjustBid(country === 'ZM' ? -10 : -0.5)}>
                  -
                </button>
                <div className={styles.fareDisplay}>
                  <span className={styles.fareCurrency}>{country === 'ZM' ? 'ZK' : '$'}</span>
                  <span>{country === 'ZM' ? (userOfferPrice * 25).toFixed(0) : userOfferPrice.toFixed(2)}</span>
                </div>
                <button type="button" className={styles.fareBtn} onClick={() => adjustBid(country === 'ZM' ? 10 : 0.5)}>
                  +
                </button>
              </div>

              <span className={styles.fareHint}>
                Recommended Base: {formatPrice(suggestedBasePrice)} ({estimate?.distanceKm} km trip)
              </span>
            </div>

            {/* Input Details Grid */}
            <div className={styles.detailsFields}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Sender Name</label>
                  <input
                    type="text"
                    placeholder="Sender name"
                    className="input"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    style={{ fontSize: '14px', height: '38px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Sender Phone *</label>
                  <input
                    type="tel"
                    placeholder={country === 'ZM' ? 'e.g. 0971234567' : 'e.g. 0771234567'}
                    className="input"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    required
                    style={{ fontSize: '14px', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Recipient Name</label>
                  <input
                    type="text"
                    placeholder="Recipient name"
                    className="input"
                    value={dropoffName}
                    onChange={(e) => setDropoffName(e.target.value)}
                    style={{ fontSize: '14px', height: '38px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Recipient Phone *</label>
                  <input
                    type="tel"
                    placeholder={country === 'ZM' ? 'e.g. 0971234567' : 'e.g. 0771234567'}
                    className="input"
                    value={dropoffPhone}
                    onChange={(e) => setDropoffPhone(e.target.value)}
                    required
                    style={{ fontSize: '14px', height: '38px' }}
                  />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: '11px' }}>🎨 Gate Color / Landmark Info</label>
                <input
                  type="text"
                  placeholder="e.g. Green gate next to school"
                  className="input"
                  value={dropoffGateColor}
                  onChange={(e) => setDropoffGateColor(e.target.value)}
                  style={{ fontSize: '14px', height: '38px' }}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: '11px' }}>Package Description / Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Keys inside envelope / Fragile items"
                  className="input"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  style={{ fontSize: '14px', height: '38px' }}
                />
              </div>

              {/* Service & Protection Config */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Delivery Speed</label>
                  <select
                    className="input"
                    value={fulfillmentMode}
                    onChange={(e) => setFulfillmentMode(e.target.value as any)}
                    style={{ fontSize: '13px', height: '38px' }}
                  >
                    <option value="standard">🚴 Standard Biker</option>
                    <option value="jet">🚀 Biker JET (Express)</option>
                    <option value="scheduled_saver">📅 Scheduled Saver</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: '11px' }}>Protect Insurance</label>
                  <select
                    className="input"
                    value={protectionLevel}
                    onChange={(e) => setProtectionLevel(e.target.value as any)}
                    style={{ fontSize: '13px', height: '38px' }}
                  >
                    <option value="none">❌ None</option>
                    <option value="protected">🛡️ Protect (+{formatPrice(0.5)})</option>
                    <option value="premium_secure">✨ Protect+ (+{formatPrice(1.5)})</option>
                  </select>
                </div>
              </div>

              {/* Payment Mode Selection */}
              <PaymentMethodSelector
                selected={paymentMethod}
                onChange={(method) => setPaymentMethod(method)}
              />

              <div style={{ marginTop: '4px' }}>
                <EscrowBadge
                  status={paymentMethod === 'cash' ? 'pending' : 'held'}
                  amount={userOfferPrice}
                  paymentMethod={
                    paymentMethod === 'ecocash' ? 'EcoCash' :
                    paymentMethod === 'onemoney' ? 'OneMoney' :
                    paymentMethod === 'innbucks' ? 'InnBucks' :
                    paymentMethod === 'wallet' ? 'Biker Wallet' :
                    paymentMethod === 'card' ? 'Card' :
                    'Cash'
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !estimate}
              className="btn btn--primary btn--lg btn--full"
              style={{ marginTop: '12px' }}
            >
              {loading ? 'Dispatching...' : 'Dispatch Instant Rider'}
            </button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
