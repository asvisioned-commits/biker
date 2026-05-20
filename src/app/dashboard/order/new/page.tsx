'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './new-order.module.css';
import type { ServiceType, FulfillmentMode, ProtectionLevel, HandoverMode, ShoppingItem } from '@/types';
import MapPickerModal from '@/components/map/MapPickerModal';

const LOCATION_COORDINATES: Record<string, [number, number]> = {
  "Sam Levy's Village, Borrowdale": [-17.7502, 31.0858],
  "Avondale Shops, King George Rd": [-17.7994, 31.0378],
  "Eastgate Mall, Harare CBD": [-17.8312, 31.0521],
  "Borrowdale Brooke Golf Estate": [-17.7289, 31.1345],
  "Arundel Office Park, Mount Pleasant": [-17.7812, 31.0531],
  "Joina City, Harare CBD": [-17.8306, 31.0494],
  "Belgravia Shops, Second Street Extension": [-17.7932, 31.0468],
  "Kensington Shops, Avondale": [-17.8015, 31.0298],
  "Westgate Shopping Mall, Harare": [-17.7667, 30.9856],
  "Harare International Airport (RG Mugabe)": [-17.9312, 31.0928],
};

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get('type') as ServiceType | null;

  const [step, setStep] = useState<number>(preselectedType ? 2 : 1);
  const [loading, setLoading] = useState(false);

  // Scanning simulation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  // Autocomplete state
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);

  const POPULAR_LOCATIONS = [
    "Sam Levy's Village, Borrowdale",
    "Avondale Shops, King George Rd",
    "Eastgate Mall, Harare CBD",
    "Borrowdale Brooke Golf Estate",
    "Arundel Office Park, Mount Pleasant",
    "Joina City, Harare CBD",
    "Belgravia Shops, Second Street Extension",
    "Kensington Shops, Avondale",
    "Westgate Shopping Mall, Harare",
    "Harare International Airport (RG Mugabe)",
  ];

  const getFilteredLocations = (query: string) => {
    if (!query) return POPULAR_LOCATIONS;
    return POPULAR_LOCATIONS.filter(loc =>
      loc.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Order form state
  const [serviceType, setServiceType] = useState<ServiceType>(preselectedType || 'send_item');
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('standard');
  const [protectionLevel, setProtectionLevel] = useState<ProtectionLevel>('none');
  const [handoverMode, setHandoverMode] = useState<HandoverMode>('hand_to_recipient');

  // Map picker state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'pickup' | 'dropoff'>('pickup');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);

  const handleMapPickerConfirm = (coords: [number, number], address: string, landmarkNote: string) => {
    if (pickerType === 'pickup') {
      setPickupCoords(coords);
      setPickupAddress(address);
      if (landmarkNote) {
        setPickupLandmark(landmarkNote);
      }
    } else {
      setDropoffCoords(coords);
      setDropoffAddress(address);
      if (landmarkNote) {
        setDropoffGateColor(landmarkNote);
      }
    }
  };

  // Addresses
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLandmark, setPickupLandmark] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');

  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLandmark, setDropoffLandmark] = useState('');
  const [dropoffGateColor, setDropoffGateColor] = useState('');
  const [dropoffNote, setDropoffNote] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');

  // Shopping items (buy_for_me)
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [budget, setBudget] = useState<number>(20);
  const [bufferPct, setBufferPct] = useState(10);

  // Description for general
  const [itemDescription, setItemDescription] = useState('');

  const services = [
    { type: 'send_item' as ServiceType, icon: '📦', label: 'Send Item', desc: 'Pickup & deliver a parcel' },
    { type: 'buy_for_me' as ServiceType, icon: '🛒', label: 'Buy For Me', desc: 'We buy & bring it to you' },
    { type: 'pickup_order' as ServiceType, icon: '🏪', label: 'Pick Up Order', desc: 'Collect from a vendor' },
    { type: 'document_run' as ServiceType, icon: '📄', label: 'Document Run', desc: 'Sensitive documents handled safely' },
    { type: 'queue_service' as ServiceType, icon: '⏳', label: 'Queue Service', desc: 'Someone stands in line for you' },
    { type: 'multi_stop' as ServiceType, icon: '📍', label: 'Multi-Stop', desc: 'Multiple pickups & deliveries' },
  ];

  const speeds = [
    {
      mode: 'jet' as FulfillmentMode,
      icon: '⚡',
      label: 'Biker Jet',
      desc: 'Priority dispatch, direct route',
      priceLabel: '+$1.50',
      features: ['Priority matching', 'Direct route', 'Higher rider share'],
    },
    {
      mode: 'standard' as FulfillmentMode,
      icon: '🚴',
      label: 'Standard',
      desc: 'Balanced speed & price',
      priceLabel: 'Base price',
      features: ['On-demand dispatch', 'Live tracking', 'Proof chain'],
    },
    {
      mode: 'scheduled_saver' as FulfillmentMode,
      icon: '📅',
      label: 'Scheduled Saver',
      desc: 'Pick a window, save money',
      priceLabel: '-15%',
      features: ['Flexible time window', 'Batch routing savings', 'All protection included'],
    },
  ];

  const protections = [
    {
      level: 'none' as ProtectionLevel,
      label: 'No Protection',
      desc: 'Standard delivery without escrow hold.',
      price: 'Free',
      features: ['Basic tracking', 'Cash on delivery option'],
    },
    {
      level: 'protected' as ProtectionLevel,
      label: 'Biker Protect',
      desc: 'Escrow + proof chain + dispute resolution.',
      price: '$0.50',
      features: ['Funds held until PIN confirmation', 'Mandatory proof photos', '4-hour dispute window', 'Auto-resolution'],
    },
    {
      level: 'premium_secure' as ProtectionLevel,
      label: 'Biker Protect+',
      desc: 'Full coverage, extended dispute, priority ops.',
      price: '$1.00',
      features: ['Everything in Protect', '12-hour dispute window', 'Dedicated ops review', 'Priority refund processing'],
    },
  ];

  const addItem = () => {
    if (!newItemName) return;
    setItems([...items, {
      name: newItemName,
      quantity: newItemQty,
      est_price: newItemPrice,
      substitution_ok: true,
    }]);
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Price calculation (mock)
  const calculateQuote = () => {
    let deliveryFee = 2.50;
    if (fulfillmentMode === 'jet') deliveryFee += 1.50;
    if (fulfillmentMode === 'scheduled_saver') deliveryFee *= 0.85;

    const serviceFee = deliveryFee * 0.15;
    let protectionFee = 0;
    if (protectionLevel === 'protected') protectionFee = 0.50;
    if (protectionLevel === 'premium_secure') protectionFee = 1.00;

    const purchaseAmount = serviceType === 'buy_for_me' ? items.reduce((sum, i) => sum + (i.est_price * i.quantity), 0) : 0;

    return {
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      protection_fee: protectionFee,
      purchase_budget: purchaseAmount,
      rush_premium: fulfillmentMode === 'jet' ? 1.50 : 0,
      saver_discount: fulfillmentMode === 'scheduled_saver' ? deliveryFee * 0.15 : 0,
      total: deliveryFee + serviceFee + protectionFee + purchaseAmount,
    };
  };

  const quote = calculateQuote();

  const handleSubmit = () => {
    setIsScanning(true);
    setScanStep(0);
    
    // Animate scanning process steps
    const timer1 = setTimeout(() => setScanStep(1), 1200);
    const timer2 = setTimeout(() => setScanStep(2), 2400);
    const timer3 = setTimeout(() => setScanStep(3), 3600);
    const timer4 = setTimeout(() => {
      const pCoords = pickupCoords || LOCATION_COORDINATES[pickupAddress] || [-17.7502, 31.0858];
      const dCoords = dropoffCoords || LOCATION_COORDINATES[dropoffAddress] || [-17.7289, 31.1345];
      router.push(
        `/dashboard/tracking?id=mock-new-order&pLat=${pCoords[0]}&pLng=${pCoords[1]}&dLat=${dCoords[0]}&dLng=${dCoords[1]}&pAddr=${encodeURIComponent(pickupAddress)}&dAddr=${encodeURIComponent(dropoffAddress)}`
      );
    }, 4800);
  };

  const stepLabels = ['Service', 'Details', 'Speed', 'Protection', 'Review'];

  if (isScanning) {
    const scanSteps = [
      { text: 'Securing escrow payment...', icon: '🔒' },
      { text: 'Broadcasting order to nearby riders...', icon: '📡' },
      { text: 'Rider matched! Verifying availability...', icon: '🤝' },
      { text: 'Takudzwa M. accepted! Connecting...', icon: '✅' },
    ];

    return (
      <div className={styles.page}>
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
            {scanStep === 0 && 'Connecting with payment gateway...'}
            {scanStep === 1 && 'Searching within 2.5 km...'}
            {scanStep === 2 && 'Negotiating best fare...'}
            {scanStep === 3 && 'Rider is on the way!'}
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
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Progress */}
      <div className={styles.progressBar}>
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`${styles.progressStep} ${i + 1 <= step ? styles.progressStepActive : ''} ${i + 1 === step ? styles.progressStepCurrent : ''}`}
            onClick={() => { if (i + 1 < step) setStep(i + 1); }}
          >
            <div className={styles.progressDot}>{i + 1}</div>
            <span className={styles.progressLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Service Type */}
      {step === 1 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>What do you need?</h2>
          <p className={styles.stepSubtitle}>Choose the type of errand or delivery.</p>
          <div className={styles.serviceGrid}>
            {services.map((s) => (
              <button
                key={s.type}
                className={`${styles.serviceCard} ${serviceType === s.type ? styles.serviceCardSelected : ''}`}
                onClick={() => setServiceType(s.type)}
              >
                <span className={styles.serviceCardIcon}>{s.icon}</span>
                <div className={styles.serviceCardLabel}>{s.label}</div>
                <div className={styles.serviceCardDesc}>{s.desc}</div>
                {serviceType === s.type && (
                  <div className={styles.selectedCheck}>✓</div>
                )}
              </button>
            ))}
          </div>
          <button className="btn btn--primary btn--lg btn--full mt-6" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Pickup & Dropoff Details */}
      {step === 2 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Where and what?</h2>
          <p className={styles.stepSubtitle}>
            {serviceType === 'buy_for_me' ? 'Where should we buy and deliver?' : 'Set pickup and delivery locations.'}
          </p>

          <div className={styles.addressSection}>
            <h3 className={styles.addressTitle}>
              <span className={styles.addressDot} style={{ background: 'var(--color-primary-500)' }} />
              {serviceType === 'buy_for_me' ? 'Buy from' : 'Pickup from'}
            </h3>
            <div className={styles.addressForm}>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label input-label--required">Address</label>
                  <button
                    type="button"
                    className="btn btn--link btn--sm"
                    style={{ padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    onClick={() => {
                      setPickerType('pickup');
                      setIsPickerOpen(true);
                    }}
                  >
                    🗺️ Pick on Map
                  </button>
                </div>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Sam Levy's Village, Borrowdale"
                    value={pickupAddress}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      setShowPickupSuggestions(true);
                    }}
                    onFocus={() => setShowPickupSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
                  />
                  {showPickupSuggestions && (
                    <div className={styles.suggestionsList}>
                      {getFilteredLocations(pickupAddress).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          className={styles.suggestionItem}
                          onClick={() => {
                            setPickupAddress(loc);
                            setShowPickupSuggestions(false);
                          }}
                        >
                          <span className={styles.suggestionIcon}>📍</span>
                          <span className={styles.suggestionText}>{loc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.addressRow}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Landmark</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Near the main entrance"
                    value={pickupLandmark}
                    onChange={(e) => setPickupLandmark(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Contact phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+263 77..."
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Pickup notes</label>
                <textarea
                  className="input textarea"
                  placeholder="Any instructions for the rider..."
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.addressSection}>
            <h3 className={styles.addressTitle}>
              <span className={styles.addressDot} style={{ background: 'var(--color-success-500)' }} />
              Deliver to
            </h3>
            <div className={styles.addressForm}>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label input-label--required">Address</label>
                  <button
                    type="button"
                    className="btn btn--link btn--sm"
                    style={{ padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    onClick={() => {
                      setPickerType('dropoff');
                      setIsPickerOpen(true);
                    }}
                  >
                    🗺️ Pick on Map
                  </button>
                </div>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 42 Churchill Ave, Mount Pleasant"
                    value={dropoffAddress}
                    onChange={(e) => {
                      setDropoffAddress(e.target.value);
                      setShowDropoffSuggestions(true);
                    }}
                    onFocus={() => setShowDropoffSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDropoffSuggestions(false), 200)}
                  />
                  {showDropoffSuggestions && (
                    <div className={styles.suggestionsList}>
                      {getFilteredLocations(dropoffAddress).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          className={styles.suggestionItem}
                          onClick={() => {
                            setDropoffAddress(loc);
                            setShowDropoffSuggestions(false);
                          }}
                        >
                          <span className={styles.suggestionIcon}>📍</span>
                          <span className={styles.suggestionText}>{loc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.addressRow}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Landmark / Gate color</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Brown gate, near the tuckshop"
                    value={dropoffGateColor || dropoffLandmark}
                    onChange={(e) => setDropoffGateColor(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Recipient phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+263 77..."
                    value={dropoffPhone}
                    onChange={(e) => setDropoffPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Delivery notes</label>
                <textarea
                  className="input textarea"
                  placeholder="Leave at the gate, call when arriving..."
                  value={dropoffNote}
                  onChange={(e) => setDropoffNote(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Handover mode</label>
                <select
                  className="input"
                  value={handoverMode}
                  onChange={(e) => setHandoverMode(e.target.value as HandoverMode)}
                >
                  <option value="hand_to_recipient">🤝 Hand to recipient</option>
                  <option value="hand_to_guard">👮 Hand to security/guard</option>
                  <option value="leave_at_reception">🏢 Leave at reception</option>
                  <option value="leave_at_gate">🚪 Leave at gate</option>
                  <option value="hold_for_pickup">📦 Hold for pickup</option>
                </select>
              </div>
            </div>
          </div>

          {/* Item description / shopping list */}
          {serviceType === 'buy_for_me' ? (
            <div className={styles.shoppingSection}>
              <h3 className={styles.addressTitle}>🛒 Shopping list</h3>
              <div className={styles.itemForm}>
                <input
                  type="text"
                  className="input"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Qty"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                  min={1}
                  style={{ width: '80px' }}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Est. $"
                  value={newItemPrice || ''}
                  onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.5}
                  style={{ width: '100px' }}
                />
                <button className="btn btn--primary btn--sm" onClick={addItem}>Add</button>
              </div>

              {items.length > 0 && (
                <div className={styles.itemsList}>
                  {items.map((item, i) => (
                    <div key={i} className={styles.itemRow}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemMeta}>
                          ×{item.quantity} · ~${item.est_price.toFixed(2)} each
                        </span>
                      </div>
                      <button className={styles.itemRemove} onClick={() => removeItem(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.budgetRow}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Max budget ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={budget}
                    onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div className="input-group" style={{ width: '120px' }}>
                  <label className="input-label">Buffer %</label>
                  <input
                    type="number"
                    className="input"
                    value={bufferPct}
                    onChange={(e) => setBufferPct(parseInt(e.target.value) || 0)}
                    min={0}
                    max={30}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.addressSection}>
              <h3 className={styles.addressTitle}>📋 What&apos;s being delivered?</h3>
              <div className="input-group">
                <textarea
                  className="input textarea"
                  placeholder="Describe the item(s), size, weight, special handling..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className={styles.stepActions}>
            <button className="btn btn--ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn--primary btn--lg" onClick={() => setStep(3)} style={{ flex: 1 }}>
              Choose speed
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Speed */}
      {step === 3 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>How fast?</h2>
          <p className={styles.stepSubtitle}>Choose between speed and savings.</p>
          <div className={styles.speedCards}>
            {speeds.map((s) => (
              <button
                key={s.mode}
                className={`speed-card speed-card--${s.mode} ${fulfillmentMode === s.mode ? `speed-card--selected speed-card--${s.mode}` : ''}`}
                onClick={() => setFulfillmentMode(s.mode)}
              >
                <div className="speed-card-icon">{s.icon}</div>
                <div className="speed-card-title">{s.label}</div>
                <div className="speed-card-description">{s.desc}</div>
                <div className="speed-card-price">{s.priceLabel}</div>
                <div className={styles.speedFeatures}>
                  {s.features.map((f) => (
                    <div key={f} className={styles.speedFeature}>✓ {f}</div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className={styles.stepActions}>
            <button className="btn btn--ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn--primary btn--lg" onClick={() => setStep(4)} style={{ flex: 1 }}>
              Choose protection
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Protection (optional) */}
      {step === 4 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Add protection?</h2>
          <p className={styles.stepSubtitle}>
            Protection is <strong>optional</strong>. Add Biker Protect for escrow, proof chain, and dispute resolution.
          </p>
          <div className={styles.protectionCards}>
            {protections.map((p) => (
              <button
                key={p.level}
                className={`protection-card ${protectionLevel === p.level ? 'protection-card--selected' : ''} ${p.level === 'none' ? 'protection-card--none' : ''}`}
                onClick={() => setProtectionLevel(p.level)}
              >
                <div className={styles.protectionHeader}>
                  <div>
                    <div className={styles.protectionLabel}>{p.label}</div>
                    <div className={styles.protectionDesc}>{p.desc}</div>
                  </div>
                  <div className={styles.protectionPrice}>{p.price}</div>
                </div>
                <div className="protection-features">
                  {p.features.map((f) => (
                    <div key={f} className="protection-feature">
                      <span className="protection-feature-icon">✓</span>
                      {f}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className={styles.stepActions}>
            <button className="btn btn--ghost" onClick={() => setStep(3)}>Back</button>
            <button className="btn btn--primary btn--lg" onClick={() => setStep(5)} style={{ flex: 1 }}>
              Review order
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Order review</h2>
          <p className={styles.stepSubtitle}>Confirm your order details.</p>

          <div className={styles.reviewCard}>
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Service</div>
              <div className={styles.reviewValue}>
                {services.find(s => s.type === serviceType)?.icon}{' '}
                {services.find(s => s.type === serviceType)?.label}
              </div>
            </div>
            <hr className="divider" />
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Pickup</div>
              <div className={styles.reviewValue}>{pickupAddress || 'Not set'}</div>
            </div>
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Deliver to</div>
              <div className={styles.reviewValue}>{dropoffAddress || 'Not set'}</div>
            </div>
            <hr className="divider" />
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Speed</div>
              <div className={styles.reviewValue}>
                {speeds.find(s => s.mode === fulfillmentMode)?.icon}{' '}
                {speeds.find(s => s.mode === fulfillmentMode)?.label}
              </div>
            </div>
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Protection</div>
              <div className={styles.reviewValue}>
                {protectionLevel === 'none' ? 'None' : `🛡️ ${protections.find(p => p.level === protectionLevel)?.label}`}
              </div>
            </div>
            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Handover</div>
              <div className={styles.reviewValue}>{handoverMode.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className={styles.priceBreakdown}>
            <div className={styles.priceLine}>
              <span>Delivery fee</span>
              <span>${quote.delivery_fee.toFixed(2)}</span>
            </div>
            <div className={styles.priceLine}>
              <span>Service fee</span>
              <span>${quote.service_fee.toFixed(2)}</span>
            </div>
            {quote.rush_premium > 0 && (
              <div className={`${styles.priceLine} ${styles.priceLineJet}`}>
                <span>⚡ Jet premium</span>
                <span>+${quote.rush_premium.toFixed(2)}</span>
              </div>
            )}
            {quote.saver_discount > 0 && (
              <div className={`${styles.priceLine} ${styles.priceLineSaver}`}>
                <span>📅 Saver discount</span>
                <span>-${quote.saver_discount.toFixed(2)}</span>
              </div>
            )}
            {quote.protection_fee > 0 && (
              <div className={styles.priceLine}>
                <span>🛡️ Protection fee</span>
                <span>${quote.protection_fee.toFixed(2)}</span>
              </div>
            )}
            {quote.purchase_budget > 0 && (
              <div className={styles.priceLine}>
                <span>🛒 Item cost (est.)</span>
                <span>${quote.purchase_budget.toFixed(2)}</span>
              </div>
            )}
            <hr className="divider" />
            <div className={`${styles.priceLine} ${styles.priceTotal}`}>
              <span>Total</span>
              <span>${quote.total.toFixed(2)}</span>
            </div>
          </div>

          {protectionLevel !== 'none' && (
            <div className={styles.escrowNote}>
              <span>🛡️</span>
              <div>
                <strong>Your money is protected</strong>
                <p>Funds will be held securely until you confirm delivery with your unique PIN.</p>
              </div>
            </div>
          )}

          <div className={styles.stepActions}>
            <button className="btn btn--ghost" onClick={() => setStep(4)}>Back</button>
            <button
              className={`btn ${fulfillmentMode === 'jet' ? 'btn--jet' : 'btn--primary'} btn--lg`}
              style={{ flex: 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : `Pay $${quote.total.toFixed(2)} & Send`}
            </button>
          </div>
        </div>
      )}
      <MapPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onConfirm={handleMapPickerConfirm}
        title={pickerType === 'pickup' ? 'Select Pickup Location' : 'Select Delivery Location'}
        initialCoords={pickerType === 'pickup' ? pickupCoords : dropoffCoords}
      />
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
