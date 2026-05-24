'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDeliveryRequest, checkExistingActiveDelivery } from './actions';
import { useProfile } from '@/context/ProfileContext';
import { searchAddress, reverseGeocode, GeocodeResult } from '@/lib/geocoding';
import styles from './order-new.module.css';
import { FLAGS } from '@/lib/flags';

export default function NewOrderPage() {
  const router = useRouter();
  const { session, profile, country, balance } = useProfile();
  
  const userId = session?.user_id;

  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [fulfillmentMode, setFulfillmentMode] = useState<'standard' | 'jet' | 'scheduled_saver'>('standard');
  const [protectionLevel, setProtectionLevel] = useState<'none' | 'protected' | 'premium_secure'>('none');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash'>('wallet');
  const [itemDescription, setItemDescription] = useState('');

  const [pickupResults, setPickupResults] = useState<GeocodeResult[]>([]);
  const [dropoffResults, setDropoffResults] = useState<GeocodeResult[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [pricing, setPricing] = useState<{ baseFee: number; speedFee: number; insuranceFee: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  // Address lookup state control
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDropoffDropdown, setShowDropoffDropdown] = useState(false);

  // Map state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // Check if user already has an active order
  useEffect(() => {
    const verifyActiveOrder = async () => {
      if (!userId) {
        setVerifying(false);
        return;
      }
      try {
        const hasActive = await checkExistingActiveDelivery(userId);
        if (hasActive) {
          alert('You have an ongoing delivery request. Redirecting to tracking...');
          router.push('/dashboard/tracking');
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setVerifying(false);
      }
    };
    verifyActiveOrder();
  }, [userId, router]);

  // Load Leaflet libraries dynamically
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

  // Initialize and update Map
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const mapElement = document.getElementById('booking-leaflet-map');
    if (!mapElement) return;

    if (!mapRef.current) {
      // Default to Harare or Lusaka depending on regional country profile
      const defaultCenter: [number, number] = country === 'ZM' ? [-15.3875, 28.3228] : [-17.8292, 31.0522];
      
      const map = L.map('booking-leaflet-map', {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView(defaultCenter, 13);
      
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Support map pin selection by clicking
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        // Check which input was last focused or default to pickup, then dropoff
        if (!pickupCoords) {
          setLoading(true);
          const address = await reverseGeocode(lat, lng);
          setPickupCoords([lat, lng]);
          setPickup(address);
          setLoading(false);
        } else if (!dropoffCoords) {
          setLoading(true);
          const address = await reverseGeocode(lat, lng);
          setDropoffCoords([lat, lng]);
          setDropoff(address);
          setLoading(false);
        }
      });
    }

    const map = mapRef.current;

    // Update Pickup Marker
    if (pickupCoords) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng(pickupCoords);
      } else {
        const pickupIcon = L.divIcon({
          html: `<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏪</div>`,
          className: 'leaflet-pickup-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        pickupMarkerRef.current = L.marker(pickupCoords, { icon: pickupIcon, draggable: true })
          .addTo(map)
          .bindPopup('<b>Pickup Location</b>')
          .openPopup();

        pickupMarkerRef.current.on('dragend', async (event: any) => {
          const marker = event.target;
          const position = marker.getLatLng();
          setLoading(true);
          const address = await reverseGeocode(position.lat, position.lng);
          setPickupCoords([position.lat, position.lng]);
          setPickup(address);
          setLoading(false);
        });
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    // Update Dropoff Marker
    if (dropoffCoords) {
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLatLng(dropoffCoords);
      } else {
        const dropoffIcon = L.divIcon({
          html: `<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏠</div>`,
          className: 'leaflet-dropoff-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        dropoffMarkerRef.current = L.marker(dropoffCoords, { icon: dropoffIcon, draggable: true })
          .addTo(map)
          .bindPopup('<b>Dropoff Location</b>')
          .openPopup();

        dropoffMarkerRef.current.on('dragend', async (event: any) => {
          const marker = event.target;
          const position = marker.getLatLng();
          setLoading(true);
          const address = await reverseGeocode(position.lat, position.lng);
          setDropoffCoords([position.lat, position.lng]);
          setDropoff(address);
          setLoading(false);
        });
      }
    } else if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    // Update Route Polyline and zoom bounds
    if (pickupCoords && dropoffCoords) {
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
      }

      const fetchOSRMRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropoffCoords[1]},${dropoffCoords[0]}?geometries=geojson&overview=full`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            routePolylineRef.current = L.polyline(coords, { color: '#3b82f6', weight: 4 }).addTo(map);
            return;
          }
        } catch (err) {
          console.warn('Failed OSRM route fetch, drawing direct line:', err);
        }
        routePolylineRef.current = L.polyline([pickupCoords, dropoffCoords], { color: '#3b82f6', weight: 4 }).addTo(map);
      };
      
      fetchOSRMRoute();

      const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

  }, [leafletLoaded, pickupCoords, dropoffCoords]);

  // Geocoding query triggers with debounce
  useEffect(() => {
    if (pickup.length < 3 || pickupCoords) {
      setPickupResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingPickup(true);
      const res = await searchAddress(pickup, country);
      setPickupResults(res);
      setSearchingPickup(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [pickup, country, pickupCoords]);

  useEffect(() => {
    if (dropoff.length < 3 || dropoffCoords) {
      setDropoffResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingDropoff(true);
      const res = await searchAddress(dropoff, country);
      setDropoffResults(res);
      setSearchingDropoff(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [dropoff, country, dropoffCoords]);

  // Pricing calculations
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) {
      setRouteInfo(null);
      setPricing(null);
      return;
    }

    const calculateDistanceAndCost = async () => {
      let distanceKm = 0;
      let durationMin = 0;

      // Estimate distance using OSRM or Fallback to Haversine
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropoffCoords[1]},${dropoffCoords[0]}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.[0]) {
          distanceKm = Number((data.routes[0].distance / 1000).toFixed(2));
          durationMin = Math.ceil(data.routes[0].duration / 60);
        } else {
          throw new Error('OSRM pricing estimate failed');
        }
      } catch (err) {
        // Haversine fallback formula
        const R = 6371;
        const dLat = (dropoffCoords[0] - pickupCoords[0]) * Math.PI / 180;
        const dLng = (dropoffCoords[1] - pickupCoords[1]) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(pickupCoords[0] * Math.PI / 180) * Math.cos(dropoffCoords[0] * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Number((R * c * 1.25).toFixed(2)); // Apply 1.25 winding factor
        durationMin = Math.ceil(distanceKm * 2.5); // Average 24km/h in African cities
      }

      setRouteInfo({ distanceKm, durationMin });

      // Pricing structure
      const isZambia = country === 'ZM';
      const currencyMultiplier = isZambia ? 25 : 1; // ZK pricing
      
      const baseFee = (isZambia ? 15.00 : 2.50) + (distanceKm * (isZambia ? 3.00 : 0.40));
      
      let speedFee = 0;
      if (fulfillmentMode === 'jet') {
        speedFee = isZambia ? 20.00 : 2.00;
      } else if (fulfillmentMode === 'scheduled_saver') {
        speedFee = -(isZambia ? 5.00 : 0.50);
      }

      let insuranceFee = 0;
      if (protectionLevel === 'protected') {
        insuranceFee = isZambia ? 10.00 : 0.50;
      } else if (protectionLevel === 'premium_secure') {
        insuranceFee = isZambia ? 30.00 : 1.50;
      }

      const total = Math.max(isZambia ? 10.00 : 1.50, baseFee + speedFee + insuranceFee);

      setPricing({
        baseFee: Number(baseFee.toFixed(2)),
        speedFee: Number(speedFee.toFixed(2)),
        insuranceFee: Number(insuranceFee.toFixed(2)),
        total: Number(total.toFixed(2)),
      });
    };

    calculateDistanceAndCost();
  }, [pickupCoords, dropoffCoords, fulfillmentMode, protectionLevel, country]);

  const handleSelectPickupResult = (res: GeocodeResult) => {
    setPickup(res.address);
    setPickupCoords([res.lat, res.lng]);
    setPickupResults([]);
    setShowPickupDropdown(false);
  };

  const handleSelectDropoffResult = (res: GeocodeResult) => {
    setDropoff(res.address);
    setDropoffCoords([res.lat, res.lng]);
    setDropoffResults([]);
    setShowDropoffDropdown(false);
  };

  const handleClearPickup = () => {
    setPickup('');
    setPickupCoords(null);
    setPickupResults([]);
    setRouteInfo(null);
    setPricing(null);
  };

  const handleClearDropoff = () => {
    setDropoff('');
    setDropoffCoords(null);
    setDropoffResults([]);
    setRouteInfo(null);
    setPricing(null);
  };

  const formatPrice = (val: number) => {
    if (country === 'ZM') {
      return `ZK ${val.toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !pricing) {
      alert('Please fill out delivery routing details completely.');
      return;
    }

    if (paymentMethod === 'wallet' && balance < pricing.total) {
      alert('Insufficient wallet balance. Please top up or choose Cash on Delivery.');
      return;
    }

    setLoading(true);
    const mockRiderId = 'mock-rider-id';

    try {
      const res = await createDeliveryRequest({
        customer_id: userId || 'mock-customer',
        pickup_address: pickup,
        pickup_lat: pickupCoords[0],
        pickup_lng: pickupCoords[1],
        dropoff_address: dropoff,
        dropoff_lat: dropoffCoords[0],
        dropoff_lng: dropoffCoords[1],
        estimated_distance_km: routeInfo?.distanceKm || 0,
        estimated_duration_minutes: routeInfo?.durationMin || 0,
        service_type: 'send_item',
        delivery_fee: pricing.baseFee + pricing.speedFee,
        insurance_fee: pricing.insuranceFee,
        total_amount: pricing.total,
        rider_payout: (pricing.baseFee + pricing.speedFee) * 0.8, // 80% payout
        fulfillment_mode: fulfillmentMode,
        protection_level: protectionLevel,
        payment_method: paymentMethod,
        item_description: itemDescription || 'Deliverable Package',
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Database booking execution failed.');
      }

      alert('Delivery request posted successfully! Redirecting to radar dispatcher...');
      router.push('/dashboard/tracking');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Booking request encountered an unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <span className="spinner" />
        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Validating customer account state...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Book a Biker</h1>
        <p className={styles.subtitle}>On-demand reliable shipping across your city</p>
      </div>

      <div className={styles.grid}>
        
        {/* Booking Interactive Leaflet Map */}
        <div className={styles.mapContainer}>
          <div id="booking-leaflet-map" style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
          {!leafletLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              <span className="spinner" style={{ marginRight: '8px' }} /> Loading Map Engine...
            </div>
          )}
        </div>

        {/* Form Panel */}
        <div className={styles.card}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Pickup Input Group */}
            <div style={{ position: 'relative' }}>
              <label className="label">Pickup Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setPickupCoords(null);
                    setShowPickupDropdown(true);
                  }}
                  onFocus={() => setShowPickupDropdown(true)}
                  placeholder="e.g. Sam Levy's Village, Borrowdale"
                  disabled={loading}
                  required
                />
                {pickup && (
                  <button type="button" className={styles.clearBtn} onClick={handleClearPickup}>
                    ×
                  </button>
                )}
              </div>

              {showPickupDropdown && pickupResults.length > 0 && (
                <ul className={styles.dropdown}>
                  {pickupResults.map((r, i) => (
                    <li key={i} onClick={() => handleSelectPickupResult(r)} className={styles.dropdownItem}>
                      <span style={{ marginRight: '4px' }}>📍</span> {r.address}
                    </li>
                  ))}
                </ul>
              )}
              {searchingPickup && (
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Searching regional database...
                </div>
              )}
            </div>

            {/* Dropoff Input Group */}
            <div style={{ position: 'relative' }}>
              <label className="label">Dropoff Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  value={dropoff}
                  onChange={(e) => {
                    setDropoff(e.target.value);
                    setDropoffCoords(null);
                    setShowDropoffDropdown(true);
                  }}
                  onFocus={() => setShowDropoffDropdown(true)}
                  placeholder="e.g. Avondale Shops, King George Rd"
                  disabled={loading}
                  required
                />
                {dropoff && (
                  <button type="button" className={styles.clearBtn} onClick={handleClearDropoff}>
                    ×
                  </button>
                )}
              </div>

              {showDropoffDropdown && dropoffResults.length > 0 && (
                <ul className={styles.dropdown}>
                  {dropoffResults.map((r, i) => (
                    <li key={i} onClick={() => handleSelectDropoffResult(r)} className={styles.dropdownItem}>
                      <span style={{ marginRight: '4px' }}>🏁</span> {r.address}
                    </li>
                  ))}
                </ul>
              )}
              {searchingDropoff && (
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Searching regional database...
                </div>
              )}
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

            {/* Description */}
            <div>
              <label className="label">Item Description</label>
              <textarea
                className="input"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="What are we delivering? e.g. Documents, Spare parts"
                rows={2}
                style={{ resize: 'none', height: '54px' }}
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="label">Payment Method</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${paymentMethod === 'wallet' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setPaymentMethod('wallet')}
                >
                  💳 Wallet Balance ({formatPrice(balance)})
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${paymentMethod === 'cash' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  💵 Cash on Delivery
                </button>
              </div>
            </div>

            {/* Cost Details Summary */}
            {pricing && routeInfo && (
              <div className={styles.pricing}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>Distance & Est. Time:</span>
                  <span style={{ fontWeight: 600 }}>{routeInfo.distanceKm} km (~{routeInfo.durationMin} mins)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                  <span>Base Fee:</span>
                  <span>{formatPrice(pricing.baseFee)}</span>
                </div>
                {pricing.speedFee !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                    <span>Speed Premium:</span>
                    <span>{pricing.speedFee > 0 ? '+' : ''}{formatPrice(pricing.speedFee)}</span>
                  </div>
                )}
                {pricing.insuranceFee !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                    <span>Insurance Cover:</span>
                    <span>+{formatPrice(pricing.insuranceFee)}</span>
                  </div>
                )}
                <div style={{ height: '1px', background: 'var(--border-default)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800 }}>
                  <span>Total Cost:</span>
                  <span style={{ color: 'var(--color-primary-600)' }}>{formatPrice(pricing.total)}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              style={{ width: '100%', height: '42px', marginTop: '8px' }}
              disabled={loading || !pickupCoords || !dropoffCoords}
            >
              {loading ? <span className="spinner" /> : 'Confirm Biker Booking'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
