'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PricingService, PricingEstimate } from '@/lib/pricing';
import { OrderService } from '@/lib/order-service';
import Link from 'next/link';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { useProfile } from '@/context/ProfileContext';
import { reverseGeocode, searchAddress } from '@/lib/geocoding';
import styles from './new-order.module.css';
import SurgeMeter from '@/components/SurgeMeter';
import SmartOrderChat, { SmartOrderChatToggle } from '@/components/SmartOrderChat';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import PaymentMethodSelector, { PaymentMethodType } from '@/components/PaymentMethodSelector';
import EscrowBadge from '@/components/EscrowBadge';
import PremiumIcon from '@/components/primitives/PremiumIcon';

const pinSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px; height:40px;">` +
  `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>` +
  `<circle cx="12" cy="10" r="3" fill="white"/>` +
  `</svg>`;

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
  const [mapMode, setMapMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [drawerState, setDrawerState] = useState<'min' | 'mid' | 'max'>('mid');

  const mapModeRef = useRef<'pickup' | 'dropoff'>('pickup');
  useEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  const cycleDrawerState = () => {
    if (drawerState === 'min') setDrawerState('mid');
    else if (drawerState === 'mid') setDrawerState('max');
    else setDrawerState('min');
  };

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

  const getProbabilityPercent = () => {
    if (!suggestedBasePrice || suggestedBasePrice <= 0) return 100;
    const ratio = userOfferPrice / suggestedBasePrice;
    if (ratio >= 1.2) return 98;
    if (ratio >= 1.0) {
      return Math.min(95, Math.round(75 + (ratio - 1.0) * 100));
    }
    if (ratio >= 0.8) {
      return Math.round(30 + ((ratio - 0.8) / 0.2) * 45);
    }
    return Math.max(5, Math.round(10 + ((ratio - 0.6) / 0.2) * 20));
  };

  const getProbabilityText = () => {
    const pct = getProbabilityPercent();
    if (pct >= 85) return 'Excellent offer. Riders will accept this instantly.';
    if (pct >= 70) return 'Good offer. High chance of finding a rider quickly.';
    if (pct >= 45) return 'Fair offer. Acceptance might take a few minutes.';
    return 'Low offer. Riders may decline or request higher bids.';
  };

  const getProbabilityColor = () => {
    const pct = getProbabilityPercent();
    if (pct >= 70) return '#1FA46F'; // Electric Lime
    if (pct >= 45) return '#f59e0b'; // Amber / Orange
    return '#ef4444'; // Red
  };

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
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(pickupCoords, 14);

    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    // Click on map to set pickup or drop-off coordinates
    map.on('click', async (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      hasGeolocatedRef.current = true;

      const currentMode = mapModeRef.current;
      if (currentMode === 'pickup') {
        setPickupCoords([lat, lng]);
        try {
          const addr = await reverseGeocode(lat, lng);
          setPickupAddress(addr);
          setPickupSearch(addr);
        } catch (err) {
          console.error(err);
        }
      } else {
        setDropoffCoords([lat, lng]);
        try {
          const addr = await reverseGeocode(lat, lng);
          setDropoffAddress(addr);
          setDropoffSearch(addr);
        } catch (err) {
          console.error(err);
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

  // Draw Route Polyline & Bounds on map change
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear old markers
    if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
    if (dropoffMarkerRef.current) dropoffMarkerRef.current.remove();
    if (routePolylineRef.current) routePolylineRef.current.remove();

    // Clear nearby rider markers in Step 2 to declutter map
    if (step === 'fare_details') {
      nearbyRiderMarkersRef.current.forEach(m => m.remove());
      nearbyRiderMarkersRef.current = [];
    }

    // Define icons using pinSvg helper
    const pickupIcon = L.divIcon({
      html: `<div class="biker-pin" style="--pin-color: #2563eb">${pinSvg('#2563eb')}</div>`,
      className: 'leaflet-pickup-icon',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });
    const dropoffIcon = L.divIcon({
      html: `<div class="biker-pin" style="--pin-color: #16a34a">${pinSvg('#16a34a')}</div>`,
      className: 'leaflet-dropoff-icon',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });

    // Add pickup marker
    if (pickupCoords) {
      pickupMarkerRef.current = L.marker(pickupCoords, { icon: pickupIcon }).addTo(mapRef.current);
    }

    // Add dropoff marker
    if (dropoffCoords) {
      dropoffMarkerRef.current = L.marker(dropoffCoords, { icon: dropoffIcon }).addTo(mapRef.current);
    }

    // If both exist, fetch route and fit bounds
    if (pickupCoords && dropoffCoords) {
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
        const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      });
    } else if (pickupCoords && !dropoffCoords) {
      mapRef.current.setView(pickupCoords, 14);
    }
  }, [step, pickupCoords, dropoffCoords, leafletLoaded]);

  // Debounced search query triggers for Autocomplete with auto-pick
  useEffect(() => {
    if (!pickupSearch || pickupSearch.length < 2 || !isPickupFocused) {
      setPickupSuggestions([]);
      return;
    }
    if (pickupSearch === pickupAddress) {
      return;
    }
    setSearchingPickup(true);
    const delay = setTimeout(async () => {
      const res = await searchAddress(pickupSearch, country || 'ZW');
      setPickupSuggestions(res);
      setSearchingPickup(false);
      // Auto-pick first suggestion immediately as the user types
      if (res.length > 0) {
        setPickupCoords([res[0].lat, res[0].lng]);
        setPickupAddress(res[0].address);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [pickupSearch, isPickupFocused, pickupAddress, country]);

  useEffect(() => {
    if (!dropoffSearch || dropoffSearch.length < 2 || !isDropoffFocused) {
      setDropoffSuggestions([]);
      return;
    }
    if (dropoffSearch === dropoffAddress) {
      return;
    }
    setSearchingDropoff(true);
    const delay = setTimeout(async () => {
      const res = await searchAddress(dropoffSearch, country || 'ZW');
      setDropoffSuggestions(res);
      setSearchingDropoff(false);
      // Auto-pick first suggestion immediately as the user types
      if (res.length > 0) {
        setDropoffCoords([res[0].lat, res[0].lng]);
        setDropoffAddress(res[0].address);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [dropoffSearch, isDropoffFocused, dropoffAddress, country]);

  // Blur and keypress handlers to finalize auto-picked values
  const handlePickupBlur = () => {
    setTimeout(() => {
      setIsPickupFocused(false);
      if (pickupSuggestions.length > 0) {
        const s = pickupSuggestions[0];
        setPickupCoords([s.lat, s.lng]);
        setPickupAddress(s.address);
        setPickupSearch(s.address);
        setPickupSuggestions([]);
      } else if (pickupAddress) {
        setPickupSearch(pickupAddress);
      }
    }, 200);
  };

  const handleDropoffBlur = () => {
    setTimeout(() => {
      setIsDropoffFocused(false);
      if (dropoffSuggestions.length > 0) {
        const s = dropoffSuggestions[0];
        setDropoffCoords([s.lat, s.lng]);
        setDropoffAddress(s.address);
        setDropoffSearch(s.address);
        setDropoffSuggestions([]);
      } else if (dropoffAddress) {
        setDropoffSearch(dropoffAddress);
      }
    }, 200);
  };

  const handlePickupKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pickupSuggestions.length > 0) {
        handleSelectPickupSuggestion(pickupSuggestions[0]);
      } else {
        setIsPickupFocused(false);
      }
    }
  };

  const handleDropoffKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (dropoffSuggestions.length > 0) {
        handleSelectDropoffSuggestion(dropoffSuggestions[0]);
      } else {
        setIsDropoffFocused(false);
      }
    }
  };

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

    // Client-side fraud prevention: check order velocity
    try {
      const fingerprint = getDeviceFingerprint();
      const velocityCheck = await OrderService.checkOrderVelocity(userId, fingerprint);
      if (!velocityCheck.allowed) {
        setError(velocityCheck.details || 'Dispatch limit exceeded. You can only place up to 3 orders every 10 minutes.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('Failed to run order velocity check:', err);
    }

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
      {step === 'location' ? (
        <div className={styles.stepContentSplit}>
          {/* Map Container */}
          <div className={styles.mapContainer}>
            <div id={mapId} className={styles.map} />
            {!leafletLoaded && (
              <div className={styles.mapLoading}>
                <span className="spinner spinner--lg" />
                <span>Loading Map Engine...</span>
              </div>
            )}
            
            {/* Active Selection Overlay Instruction Banner */}
            {leafletLoaded && (
              <div className="map-instructions-banner">
                {mapMode === 'pickup' ? (
                  <div className="banner-content banner-content--pickup">
                    <span className="banner-icon">📍</span>
                    <span className="banner-text">Tap on map to set <strong>Pickup Location</strong> (Blue Pin)</span>
                  </div>
                ) : (
                  <div className="banner-content banner-content--dropoff">
                    <span className="banner-icon">🟢</span>
                    <span className="banner-text">Tap on map to set <strong>Drop-off Location</strong> (Green Pin)</span>
                  </div>
                )}
              </div>
            )}

            {/* GPS FAB */}
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
          </div>

          {/* Form Container (Bottom Drawer on Mobile) */}
          <div className={`${styles.formContainer} ${styles['drawer_' + drawerState]}`}>
            {/* Drawer Handle */}
            <div className={styles.drawerHandle} onClick={cycleDrawerState}>
              <div className={styles.handleBar} />
              <div className={styles.drawerSummary}>
                <div className={styles.summaryTitle}>Instant Booking</div>
                <div className={styles.summaryAddresses}>
                  {pickupAddress ? `📍 ${pickupAddress}` : 'Set pickup'} → {dropoffAddress ? `🟢 ${dropoffAddress}` : 'Set drop-off'}
                </div>
              </div>
            </div>

            {/* Drawer Controls */}
            <div className={styles.drawerControls}>
              <button type="button" className={`${styles.controlBtn} ${drawerState === 'min' ? styles.controlBtnActive : ''}`} onClick={() => setDrawerState('min')}>Map</button>
              <button type="button" className={`${styles.controlBtn} ${drawerState === 'mid' ? styles.controlBtnActive : ''}`} onClick={() => setDrawerState('mid')}>Search</button>
              <button type="button" className={`${styles.controlBtn} ${drawerState === 'max' ? styles.controlBtnActive : ''}`} onClick={() => setDrawerState('max')}>Form</button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className={styles.drawerScrollable}>
              {error && (
                <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PremiumIcon name="AlertTriangle" variant="danger" size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Mode Toggle Button Group */}
              <div className={styles.modeToggleGroup}>
                <button
                  type="button"
                  className={`${styles.modeToggleBtn} ${mapMode === 'pickup' ? styles.modeToggleBtnActivePickup : ''}`}
                  onClick={() => setMapMode('pickup')}
                >
                  📍 Set Pickup
                </button>
                <button
                  type="button"
                  className={`${styles.modeToggleBtn} ${mapMode === 'dropoff' ? styles.modeToggleBtnActiveDropoff : ''}`}
                  onClick={() => setMapMode('dropoff')}
                >
                  🟢 Set Dropoff
                </button>
              </div>

              {locationAccessBlocked && (
                <div className="alert alert--warning" style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <PremiumIcon name="MapPin" variant="warning" size={14} />
                  <div>
                    <strong>Location Access Blocked</strong>: Auto GPS tracking is blocked. Please enable location permission or type address.
                  </div>
                </div>
              )}

              {/* Address Search Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className={styles.searchContainer}>
                  <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pickup location (Tap map or search)
                  </label>
                  <div className={styles.searchInputWrapper}>
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Type pickup place..."
                      value={pickupSearch}
                      onChange={(e) => setPickupSearch(e.target.value)}
                      onFocus={() => {
                        setIsPickupFocused(true);
                        setMapMode('pickup');
                      }}
                      onBlur={handlePickupBlur}
                      onKeyDown={handlePickupKeyDown}
                    />
                  </div>
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
                  <div className={styles.searchInputWrapper}>
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search destination landmarks..."
                      value={dropoffSearch}
                      onChange={(e) => setDropoffSearch(e.target.value)}
                      onFocus={() => {
                        setIsDropoffFocused(true);
                        setMapMode('dropoff');
                      }}
                      onBlur={handleDropoffBlur}
                      onKeyDown={handleDropoffKeyDown}
                    />
                  </div>
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

              {/* SurgeMeter & SmartOrderChat */}
              <SurgeMeter country={country} compact />
              {showChatMode ? (
                <SmartOrderChat country={country} onOrderParsed={handleChatOrderParsed} onClose={() => setShowChatMode(false)} />
              ) : (
                <SmartOrderChatToggle onClick={() => setShowChatMode(true)} />
              )}

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
                          className="input"
                          placeholder="Item name (e.g. Bread)"
                          value={item.name}
                          onChange={(e) => {
                            const copy = [...shoppingItems];
                            copy[idx].name = e.target.value;
                            setShoppingItems(copy);
                          }}
                          style={{ flex: 1, height: '32px', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          className="input"
                          value={item.quantity}
                          min="1"
                          onChange={(e) => {
                            const copy = [...shoppingItems];
                            copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                            setShoppingItems(copy);
                          }}
                          style={{ width: '60px', height: '32px', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          className="input"
                          placeholder="Price"
                          value={item.estPrice || ''}
                          onChange={(e) => {
                            const copy = [...shoppingItems];
                            copy[idx].estPrice = Math.max(0, parseFloat(e.target.value) || 0);
                            setShoppingItems(copy);
                          }}
                          style={{ width: '80px', height: '32px', fontSize: '12px' }}
                        />
                        {shoppingItems.length > 1 && (
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => setShoppingItems(shoppingItems.filter((_, i) => i !== idx))}
                            style={{ padding: '0 8px', height: '32px' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setShoppingItems([...shoppingItems, { name: '', quantity: 1, estPrice: 0.0 }])}
                      style={{ fontSize: '11px', alignSelf: 'flex-start', padding: '4px 10px' }}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              {itemCategory !== 'buy_for_me' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="label" style={{ fontSize: '11px', fontWeight: 700 }}>Item details (size, weight, description)</label>
                  <textarea
                    className="input"
                    placeholder="E.g., Small box containing keys, handle with care..."
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    style={{ height: '60px', fontSize: '12.5px', resize: 'none' }}
                  />
                </div>
              )}

              {/* Continue button */}
              <button
                type="button"
                className="btn btn--primary btn--lg btn--full"
                onClick={handleConfirmLocations}
                disabled={loading}
                style={{ marginTop: '10px' }}
              >
                {loading ? <span className="spinner" /> : 'Choose Bid & Details →'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: BIDDING AND CONTACT DETAILS */
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          {/* We show the map backdrop on step 2 too, but we render a center form card instead of bottom drawer */}
          <div className="card shadow-2xl p-6" style={{ width: '92%', maxWidth: '520px', background: 'var(--bg-card)', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Review & Dispatch 🚀</h2>
              <span className="badge badge--primary" style={{ fontSize: '10px' }}>Step 2 of 2</span>
            </div>

            {error && (
              <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PremiumIcon name="AlertTriangle" variant="danger" size={14} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Trip summary */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: 'var(--color-primary-500)' }}>📍</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Pickup: {pickupAddress}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: 'var(--color-success-500)' }}>🏠</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Dropoff: {dropoffAddress}</span>
                </div>
              </div>

              {/* Speeds & Modes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="label" style={{ fontSize: '11px', fontWeight: 700 }}>Fulfillment Speed</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${fulfillmentMode === 'standard' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                    style={{ flex: 1, fontSize: '11px' }}
                    onClick={() => setFulfillmentMode('standard')}
                  >
                    🚴 Standard
                  </button>
                  <button
                    type="button"
                    className={`btn ${fulfillmentMode === 'jet' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                    style={{ flex: 1, fontSize: '11px' }}
                    onClick={() => setFulfillmentMode('jet')}
                  >
                    ⚡ Jet (+$1.50)
                  </button>
                  <button
                    type="button"
                    className={`btn ${fulfillmentMode === 'scheduled_saver' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                    style={{ flex: 1, fontSize: '11px' }}
                    onClick={() => setFulfillmentMode('scheduled_saver')}
                  >
                    📅 Saver (-15%)
                  </button>
                </div>
              </div>

              {/* Fare Bidding block */}
              <div className={styles.fareBidContainer} style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <span className={styles.fareLabel}>Name Your Payout Bid</span>
                <div className={styles.fareDisplayContainer}>
                  <span className={styles.fareCurrency}>$</span>
                  <span className={styles.fareValue}>{userOfferPrice.toFixed(2)}</span>
                </div>
                <div className={styles.sliderWrapper}>
                  <input
                    type="range"
                    min={Math.max(2.5, suggestedBasePrice * 0.6)}
                    max={suggestedBasePrice * 2.0}
                    step="0.5"
                    className={styles.rangeSlider}
                    value={userOfferPrice}
                    onChange={(e) => setUserOfferPrice(parseFloat(e.target.value) || suggestedBasePrice)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', width: '100%' }}>
                    <span>Min: ${Math.max(2.5, suggestedBasePrice * 0.6).toFixed(1)}</span>
                    <span style={{ color: 'var(--color-primary-500)', fontWeight: 700 }}>Recommended: ${suggestedBasePrice.toFixed(1)}</span>
                    <span>Max: ${(suggestedBasePrice * 2.0).toFixed(1)}</span>
                  </div>
                </div>

                {/* Match probability meter */}
                <div className={styles.probabilityWrapper} style={{ width: '100%', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                    <span>Match Probability:</span>
                    <span style={{ color: getProbabilityColor() }}>{getProbabilityPercent()}%</span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <div
                      className={styles.progressBarFill}
                      style={{
                        width: `${getProbabilityPercent()}%`,
                        backgroundColor: getProbabilityColor(),
                      }}
                    />
                  </div>
                  <p className={styles.probabilityText}>{getProbabilityText()}</p>
                </div>
              </div>

              {/* Escrow Protection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="label" style={{ fontSize: '11px', fontWeight: 700 }}>Escrow Protection</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${protectionLevel === 'none' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                    style={{ flex: 1, fontSize: '11px' }}
                    onClick={() => setProtectionLevel('none')}
                  >
                    No Protection (Free)
                  </button>
                  <button
                    type="button"
                    className={`btn ${protectionLevel === 'protected' ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                    style={{ flex: 1, fontSize: '11px' }}
                    onClick={() => setProtectionLevel('protected')}
                  >
                    🛡️ Biker Protect (+$0.50)
                  </button>
                </div>
                {protectionLevel === 'protected' && <EscrowBadge status="pending" />}
              </div>

              {/* Sender & Recipient Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="pName">Sender Name</label>
                  <input
                    id="pName"
                    type="text"
                    className="input"
                    placeholder="E.g. John"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label input-label--required" htmlFor="pPhone">Sender Phone *</label>
                  <input
                    id="pPhone"
                    type="tel"
                    className="input"
                    placeholder="77 123 4567"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="dName">Recipient Name</label>
                  <input
                    id="dName"
                    type="text"
                    className="input"
                    placeholder="E.g. Sarah"
                    value={dropoffName}
                    onChange={(e) => setDropoffName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label input-label--required" htmlFor="dPhone">Recipient Phone *</label>
                  <input
                    id="dPhone"
                    type="tel"
                    className="input"
                    placeholder="77 987 6543"
                    value={dropoffPhone}
                    onChange={(e) => setDropoffPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="dGate">Recipient Gate Color / Landmark (Optional)</label>
                <input
                  id="dGate"
                  type="text"
                  className="input"
                  placeholder="E.g. White gate, next to church"
                  value={dropoffGateColor}
                  onChange={(e) => setDropoffGateColor(e.target.value)}
                />
              </div>

              {/* Payment Method */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="input-label">Payment Method</label>
                <PaymentMethodSelector selected={paymentMethod} onChange={setPaymentMethod} />
              </div>

              {/* Back / Submit Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--lg"
                  onClick={() => setStep('location')}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn--primary btn--lg"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : 'Confirm & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
