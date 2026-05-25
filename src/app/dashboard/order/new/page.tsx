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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasGeolocatedRef = useRef(false);

  // Map & Geolocation States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<[number, number]>(
    country === 'ZM' ? [-15.3875, 28.3228] : [-17.8292, 31.0522] // Defaults
  );
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [nearbyRiders, setNearbyRiders] = useState<NearbyRider[]>([]);

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
  const [itemCategory, setItemCategory] = useState<'document' | 'food' | 'parcel' | 'car_part'>('parcel');
  const [cargoWeight, setCargoWeight] = useState<string>('1'); // for parcels/parts
  const [itemDescription, setItemDescription] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<'standard' | 'jet' | 'scheduled_saver'>('standard');
  const [protectionLevel, setProtectionLevel] = useState<'protected' | 'none' | 'premium_secure'>('none');
  
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [dropoffName, setDropoffName] = useState('');
  const [dropoffGateColor, setDropoffGateColor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ecocash' | 'mtn_momo' | 'airtel_money' | 'cash'>('ecocash');

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
      setPaymentMethod('mtn_momo');
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
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
          setPickupCoords([latitude, longitude]);
          hasGeolocatedRef.current = true;
          
          try {
            const addr = await reverseGeocode(latitude, longitude);
            setPickupAddress(addr);
            setPickupSearch(addr);
          } catch (e) {
            console.error(e);
          }
        },
        () => {
          // Fallback geocode default center if denied
          reverseGeocode(pickupCoords[0], pickupCoords[1]).then(addr => {
            setPickupAddress(addr);
            setPickupSearch(addr);
          });
        }
      );
    } else {
      reverseGeocode(pickupCoords[0], pickupCoords[1]).then(addr => {
        setPickupAddress(addr);
        setPickupSearch(addr);
      });
    }

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

  const handleConfirmLocations = () => {
    if (!pickupAddress || !dropoffCoords) {
      setError('Please choose a valid pickup and dropoff point');
      return;
    }
    setError('');
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
      : `${itemCategory === 'car_part' ? '⚙️ Car Part' : '📦 Parcel'} (${cargoWeight} kg): ${itemDescription || 'Cargo parcel'}`;

    try {
      const payload = {
        customer_id: userId,
        service_type: itemCategory === 'document' ? 'document_run' : itemCategory === 'food' ? 'pickup_order' : 'send_item',
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

      const result = await OrderService.createOrder(payload);

      if (result) {
        // Redirect to tracking matching route, carrying payment trigger parameters
        const payParam = paymentMethod === 'cash' ? 'cash' : paymentMethod;
        router.push(`/dashboard/tracking?id=${result.id}&pay=${payParam}&phone=${encodeURIComponent(pickupPhone)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place delivery booking');
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
          <div className={`${styles.pinEmoji} ${isMapDragging ? styles.pinActive : ''}`}>📍</div>
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
          onClick={() => {
            if ('geolocation' in navigator && mapRef.current) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const { latitude, longitude } = pos.coords;
                  mapRef.current.setView([latitude, longitude], 15);
                  setPickupCoords([latitude, longitude]);
                  hasGeolocatedRef.current = true;
                  try {
                    const addr = await reverseGeocode(latitude, longitude);
                    setPickupAddress(addr);
                    setPickupSearch(addr);
                  } catch (e) {
                    console.error(e);
                  }
                },
                () => {
                  alert('GPS Location access denied or unavailable.');
                }
              );
            } else {
              alert('Geolocation is not supported by your browser.');
            }
          }}
          className={styles.gpsFab}
          title="Snap to Current Location"
        >
          🎯
        </button>
      )}

      {/* Floating Glassmorphic Booking Console Sheet */}
      <div className={`${styles.bottomSheet} ${isCollapsed ? styles.bottomSheetCollapsed : ''}`}>
        <div className={styles.dragHandleWrapper} onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className={styles.dragHandle} />
          <div className={styles.toggleText}>
            {isCollapsed ? '▲ Expand Form Details' : '▼ Hide Form'}
          </div>
        </div>
        
        {error && (
          <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px 12px', margin: 0 }}>
            ⚠️ {error}
          </div>
        )}

        {step === 'location' ? (
          /* ================= STEP 1: LOCATIONS & CATEGORY ================= */
          <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>Request a Biker</h2>
              <span className={styles.sheetStep}>Step 1 of 2</span>
            </div>

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
                      >
                        📍 {s.address}
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
                      >
                        🏁 {s.address}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category Selectors */}
            <div className={styles.servicePicker}>
              <span className={styles.pickerLabel}>What type of item?</span>
              <div className={styles.serviceGrid}>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'document' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('document')}
                >
                  <span className={styles.serviceIcon}>📄</span>
                  <span className={styles.serviceName}>Document</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'food' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('food')}
                >
                  <span className={styles.serviceIcon}>🍔</span>
                  <span className={styles.serviceName}>Food</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'parcel' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('parcel')}
                >
                  <span className={styles.serviceIcon}>📦</span>
                  <span className={styles.serviceName}>Parcel</span>
                </button>
                <button
                  type="button"
                  className={`${styles.serviceBtn} ${itemCategory === 'car_part' ? styles.serviceBtnSelected : ''}`}
                  onClick={() => setItemCategory('car_part')}
                >
                  <span className={styles.serviceIcon}>⚙️</span>
                  <span className={styles.serviceName}>Car Part</span>
                </button>
              </div>
            </div>

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
                <div style={{ flex: 2, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  ⚖️ Motorcycle capacity is capped at 30kg. Ensure cargo is boxable.
                </div>
              </div>
            )}

            <button
              onClick={handleConfirmLocations}
              disabled={!pickupAddress || !dropoffCoords}
              className="btn btn--primary btn--lg btn--full"
              style={{ marginTop: '8px' }}
            >
              Continue to Fare & Details
            </button>
          </>
        ) : (
          /* ================= STEP 2: BIDDING & CONTACTS ================= */
          <form onSubmit={handleSubmitBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>Set Offer & Details</h2>
              <span className={styles.sheetStep}>Step 2 of 2</span>
            </div>

            <div className={styles.routeSummary}>
              <div className={styles.routePoint}>
                <span style={{ fontSize: '14px' }}>🏪</span>
                <span className={styles.routeAddress}>{pickupAddress}</span>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routePoint}>
                <span style={{ fontSize: '14px' }}>🏁</span>
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
              <div>
                <label className="label" style={{ fontSize: '11px', marginBottom: '6px' }}>Escrow Payment Mode</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {country === 'ZW' ? (
                    <button
                      type="button"
                      className={`btn ${paymentMethod === 'ecocash' ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setPaymentMethod('ecocash')}
                      style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                    >
                      📱 EcoCash
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`btn ${paymentMethod === 'mtn_momo' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setPaymentMethod('mtn_momo')}
                        style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                      >
                        🟡 MTN MoMo
                      </button>
                      <button
                        type="button"
                        className={`btn ${paymentMethod === 'airtel_money' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setPaymentMethod('airtel_money')}
                        style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                      >
                        🔴 Airtel
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`btn ${paymentMethod === 'cash' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setPaymentMethod('cash')}
                    style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  >
                    💵 Cash (COD)
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !estimate}
              className="btn btn--primary btn--lg btn--full"
              style={{ marginTop: '12px' }}
            >
              {loading ? 'Publishing Request...' : 'Create Request & Scan riders'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
