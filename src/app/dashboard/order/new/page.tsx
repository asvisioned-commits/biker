'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PricingService, PricingEstimate } from '@/lib/pricing';
import { OrderService } from '@/lib/order-service';
import Link from 'next/link';

export default function NewOrderPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [serviceType, setServiceType] = useState<'send_item' | 'buy_for_me'>('send_item');
  const [fulfillmentMode, setFulfillmentMode] = useState<'standard' | 'jet' | 'scheduled_saver'>('standard');
  const [protectionLevel, setProtectionLevel] = useState<'protected' | 'none'>('none');
  
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupName, setPickupName] = useState('');
  
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [dropoffName, setDropoffName] = useState('');
  const [dropoffGateColor, setDropoffGateColor] = useState('');
  
  const [itemDescription, setItemDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ecocash' | 'cash'>('ecocash');

  // Pricing estimate state
  const [estimate, setEstimate] = useState<PricingEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

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

  // Simple mocked geocoding based on name inputs to simulate lat/lng changes for distance calculations
  const calculateFareEstimate = () => {
    if (!pickupAddress || !dropoffAddress) return;
    
    setEstimating(true);
    
    // Hash addresses to stable pseudo-coordinates in Harare area to make simulation deterministic and beautiful
    const harareCenterLat = -17.8292;
    const harareCenterLng = 31.0522;
    
    const getHash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return hash;
    };
    
    const h1 = getHash(pickupAddress);
    const h2 = getHash(dropoffAddress);
    
    // Max 10km offset
    const pickupLat = harareCenterLat + (h1 % 100) / 1000;
    const pickupLng = harareCenterLng + (h1 % 80) / 1000;
    const dropoffLat = harareCenterLat + (h2 % 100) / 1000;
    const dropoffLng = harareCenterLng + (h2 % 80) / 1000;

    const est = PricingService.estimateFare({
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      fulfillmentMode,
      protectionLevel
    });

    setEstimate(est);
    setEstimating(false);
  };

  // Trigger recalculation on configuration change
  useEffect(() => {
    calculateFareEstimate();
  }, [fulfillmentMode, protectionLevel, pickupAddress, dropoffAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('You must be logged in to create an order');
      return;
    }

    if (!pickupAddress || !dropoffAddress || !pickupPhone || !dropoffPhone) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        customer_id: userId,
        service_type: serviceType,
        fulfillment_mode: fulfillmentMode,
        protection_level: protectionLevel,
        pickup_address: pickupAddress,
        pickup_contact_name: pickupName,
        pickup_contact_phone: pickupPhone,
        pickup_lat: -17.8292 + (pickupAddress.length % 10) / 100, // mock coordinates
        pickup_lng: 31.0522 + (pickupAddress.length % 8) / 100,
        dropoff_address: dropoffAddress,
        dropoff_contact_name: dropoffName,
        dropoff_contact_phone: dropoffPhone,
        dropoff_lat: -17.8292 + (dropoffAddress.length % 10) / 100,
        dropoff_lng: 31.0522 + (dropoffAddress.length % 8) / 100,
        dropoff_gate_color: dropoffGateColor || undefined,
        item_description: itemDescription,
        delivery_fee: estimate?.baseFare,
        service_fee: estimate?.serviceFee,
        protection_fee: estimate?.protectionFee,
        total_amount: estimate?.total,
        payment_method: paymentMethod,
      };

      const result = await OrderService.createOrder(payload);
      
      if (result) {
        // Direct routing based on payment mode
        if (paymentMethod === 'ecocash') {
          // Send to tracking flow with auto EcoCash launch search param
          router.push(`/dashboard/tracking?id=${result.id}&pay=ecocash&phone=${encodeURIComponent(pickupPhone)}`);
        } else {
          // Cash on delivery directly to tracking map
          router.push(`/dashboard/tracking?id=${result.id}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="btn btn--secondary btn--sm">
          ← Back
        </Link>
        <h1 className="title">Book a Biker Delivery</h1>
      </div>

      {error && (
        <div className="alert alert--danger mb-6">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Pickup/Dropoff addresses */}
        <div className="md:col-span-2 display-flex flex-column gap-4">
          <div className="card p-6">
            <h3 className="title title--sm mb-4">📍 Service Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Service Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className={`btn btn--full ${serviceType === 'send_item' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setServiceType('send_item')}
                  >
                    📦 Send Item
                  </button>
                  <button 
                    type="button" 
                    className={`btn btn--full ${serviceType === 'buy_for_me' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setServiceType('buy_for_me')}
                  >
                    🛒 Buy For Me
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Fulfillment Mode</label>
                <select 
                  className="input"
                  value={fulfillmentMode}
                  onChange={(e) => setFulfillmentMode(e.target.value as any)}
                >
                  <option value="standard">🚴 Standard Biker</option>
                  <option value="jet">🚀 Biker JET (Express)</option>
                  <option value="scheduled_saver">📅 Scheduled Saver</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">🛡️ Biker Protect Insurance</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className={`btn btn--full ${protectionLevel === 'protected' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setProtectionLevel('protected')}
                >
                  Enable Biker Protect ($0.50 cover)
                </button>
                <button 
                  type="button" 
                  className={`btn btn--full ${protectionLevel === 'none' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setProtectionLevel('none')}
                >
                  No protection
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                *Biker Protect covers transit damage and losses up to $100. Recommended for high-value items.
              </p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="title title--sm mb-4">🏪 Pickup Point Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="label">Pickup Address *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Sam Levy's Village, Borrowdale Road" 
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="label">Sender Name</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Tendai M." 
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="label">Sender Phone Number *</label>
                <input 
                  type="tel" 
                  className="input" 
                  placeholder="e.g. 0771234567" 
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="title title--sm mb-4">🏠 Dropoff Point Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="label">Recipient Address *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Avondale Shops, Harare" 
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="label">Recipient Name</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Chipo N." 
                  value={dropoffName}
                  onChange={(e) => setDropoffName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="label">Recipient Phone *</label>
                <input 
                  type="tel" 
                  className="input" 
                  placeholder="e.g. 0779876543" 
                  value={dropoffPhone}
                  onChange={(e) => setDropoffPhone(e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">🎨 Gate Color / Special Delivery Description</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. White gate with black stripes / Next to BP Garage" 
                  value={dropoffGateColor}
                  onChange={(e) => setDropoffGateColor(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Summary & Cost Calculations */}
        <div className="display-flex flex-column gap-4">
          <div className="card p-6 sticky" style={{ top: '24px' }}>
            <h3 className="title title--sm mb-4">🛒 Order Summary</h3>

            <div>
              <label className="label">Package Details</label>
              <textarea 
                className="input" 
                rows={3}
                placeholder="Describe the package items (e.g. Pharmacy medicine, documents, lunchbox)"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
            </div>

            <div className="divider" style={{ margin: '20px 0' }} />

            <h4 style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Fare Breakdown
            </h4>

            {estimating ? (
              <div className="flex items-center justify-center p-4">
                <span className="spinner spinner--md" />
              </div>
            ) : estimate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div className="flex justify-between">
                  <span>Distance:</span>
                  <span style={{ fontWeight: 600 }}>{estimate.distanceKm} km</span>
                </div>
                <div className="flex justify-between">
                  <span>Base delivery:</span>
                  <span style={{ fontWeight: 600 }}>${estimate.baseFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Biker fee:</span>
                  <span style={{ fontWeight: 600 }}>${estimate.serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Protection fee:</span>
                  <span style={{ fontWeight: 600 }}>${estimate.protectionFee.toFixed(2)}</span>
                </div>
                
                <div className="divider" style={{ margin: '8px 0' }} />
                
                <div className="flex justify-between" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  <span>Total cost:</span>
                  <span style={{ color: 'var(--color-primary-500)' }}>${estimate.total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                Enter pickup and dropoff points to calculate pricing.
              </div>
            )}

            <div className="divider" style={{ margin: '20px 0' }} />

            <div>
              <label className="label">Payment Mode</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button 
                  type="button" 
                  className={`btn btn--full ${paymentMethod === 'ecocash' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setPaymentMethod('ecocash')}
                >
                  📱 EcoCash
                </button>
                <button 
                  type="button" 
                  className={`btn btn--full ${paymentMethod === 'cash' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  💵 Cash (COD)
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                *EcoCash payments are held securely in escrow until successful PIN releases are completed.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn btn--primary btn--full"
              style={{ marginTop: '20px' }}
              disabled={loading || !estimate}
            >
              {loading ? 'Submitting booking...' : 'Confirm Delivery Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
