/**
 * Biker Platform — Complete Core Delivery Pipeline & Escrow Lifecycle Simulator
 * Walkthrough: Pricing -> MoMo Escrow -> Radar matching -> Counter Bidding -> Transit GPS -> Secure PIN release
 */

const crypto = require('crypto');

// 1. DYNAMIC PRICING ENGINE
class PricingService {
  static getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  static estimateFare({ pickupLat, pickupLng, dropoffLat, dropoffLng, fulfillmentMode, protectionLevel }) {
    const distanceKm = this.getDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    
    // Base Rates per speed class
    let perKmRate = 1.20; // Standard USD rate
    if (fulfillmentMode === 'jet') perKmRate = 1.80;
    if (fulfillmentMode === 'scheduled_saver') perKmRate = 0.90;

    const baseFare = Math.max(3.00, Number((distanceKm * perKmRate).toFixed(2)));
    
    // Service & Protection Fees
    const serviceFee = 0.38;
    let protectionFee = 0.00;
    if (protectionLevel === 'protected') protectionFee = 0.50;
    if (protectionLevel === 'premium_secure') protectionFee = 1.50; // Protect+ Tier

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      baseFare,
      serviceFee,
      protectionFee,
      totalAmount: Math.round((baseFare + serviceFee + protectionFee) * 100) / 100
    };
  }
}

// Helper to format values in local Zambian currency (ZMW)
function formatPrice(usdVal) {
  return `ZK ${(usdVal * 25).toFixed(2)} ($${usdVal.toFixed(2)})`;
}

// 2. DOUBLE-ENTRY LEDGER SIMULATOR
class LedgerSimulator {
  constructor() {
    this.accounts = {
      customer_escrow: 0.00,
      rider_wallet: 0.00,
      platform_revenue: 0.00,
      refund_expense: 0.00
    };
    this.journal = [];
  }

  postTransaction(entryType, amount, description) {
    const entryId = `je_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const log = {
      id: entryId,
      type: entryType,
      amount,
      description,
      timestamp: new Date().toLocaleTimeString()
    };
    this.journal.push(log);
    return entryId;
  }

  holdEscrow(amount) {
    this.accounts.customer_escrow += amount;
    this.postTransaction('escrow_hold', amount, 'Debited customer gateway, credited customer escrow liability.');
  }

  releaseEscrow(total, deliveryFee, serviceFee, protectionFee) {
    this.accounts.customer_escrow -= total;
    this.accounts.rider_wallet += deliveryFee;
    this.accounts.platform_revenue += (serviceFee + protectionFee);
    
    this.postTransaction('escrow_release', total, `Released escrow: Rider credited ${formatPrice(deliveryFee)}, Platform pocketed fees.`);
  }

  printLedger() {
    console.log("\n==================== 💸 DOUBLE-ENTRY LEDGER LEDGER ====================");
    console.log(`🔒 Customer Escrow Account Balance  : ${formatPrice(this.accounts.customer_escrow)}`);
    console.log(`🚴 Rider Wallet Payout Balance      : ${formatPrice(this.accounts.rider_wallet)}`);
    console.log(`📈 Platform Revenue Fees Account    : ${formatPrice(this.accounts.platform_revenue)}`);
    console.log(`=======================================================================\n`);
  }
}

// 3. SECURE PIN HASHING HANDSHAKE
class PinHandshake {
  static hashPin(pin) {
    return crypto.createHash('sha256').update(pin).digest('hex');
  }

  static verifyPin(pin, storedHash) {
    return this.hashPin(pin) === storedHash;
  }
}

// 4. MAIN DELIVER SYSTEM FLOW SIMULATOR
async function runSimulation() {
  console.log("🚀 BIKER PLATFORM LOGISTICS ENGINE SIMULATION INITIATED\n");
  
  const ledger = new LedgerSimulator();

  // Coordinates matching Woodlands Mall to Kabulonga Mall (Lusaka, Zambia operating zone)
  const woodlandsCoords = [-15.4208, 28.3378];
  const kabulongaCoords = [-15.4095, 28.3512];
  
  console.log("📍 [Step 1: Geolocation & Route Analysis]");
  console.log("-----------------------------------------");
  console.log(`🏪 Pickup Location: Woodlands Mall, Lusaka (Coords: ${woodlandsCoords.join(', ')})`);
  console.log(`🏁 Dropoff Location: Kabulonga Mall, Lusaka (Coords: ${kabulongaCoords.join(', ')})`);
  
  const estimate = PricingService.estimateFare({
    pickupLat: woodlandsCoords[0],
    pickupLng: woodlandsCoords[1],
    dropoffLat: kabulongaCoords[0],
    dropoffLng: kabulongaCoords[1],
    fulfillmentMode: 'jet',
    protectionLevel: 'premium_secure' // Protect+ Tier ($1.50)
  });

  console.log(`📏 Computed Distance : ${estimate.distanceKm} km (Haversine Route)`);
  console.log(`🚴 Fulfillment Mode : JET Express speed`);
  console.log(`🛡️ Insurance Tier   : Protect+ (Covers up to $500.00)`);
  console.log(`💳 Estimated Base   : ${formatPrice(estimate.baseFare)}`);
  console.log(`💳 Service Fee      : ${formatPrice(estimate.serviceFee)}`);
  console.log(`💳 Protection Fee   : ${formatPrice(estimate.protectionFee)}`);
  console.log(`💰 Total Charge     : ${formatPrice(estimate.totalAmount)}\n`);

  console.log("📱 [Step 2: Customer Escrow Billing & MoMo Integration]");
  console.log("-----------------------------------------");
  console.log("🔔 Action: Requesting MTN MoMo USSD Push prompt to +260 97 123 4567...");
  console.log("📲 Simulated USSD Screen: 'Confirm payment of ZK 147.00 to BIKER LTD Escrow. Enter PIN: ****'");
  console.log("🟢 Status: USSD PIN Approved by Customer!");
  
  // Ledger holds the payment in escrow
  ledger.holdEscrow(estimate.totalAmount);
  ledger.printLedger();

  // Generate reference and secure 4-digit handover PIN
  const refCode = 'BKR-L-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const plaintextPin = Math.floor(1000 + Math.random() * 9000).toString();
  const pinHash = PinHandshake.hashPin(plaintextPin);

  console.log("🎯 [Step 3: Matching Pulsing Radar & Negotiation Loop]");
  console.log("-----------------------------------------");
  console.log(`📝 Order Reference  : ${refCode}`);
  console.log(`🔒 Escrow Handover PIN: ${plaintextPin} (Secure SHA-256 registered in DB)`);
  console.log("🔍 Scanning for nearby active bikers inside Lusaka East zone...");
  
  // Nearby bikers generated around coordinates
  const nearbyBikers = [
    { name: 'Tinashe M.', lat: woodlandsCoords[0] + 0.003, lng: woodlandsCoords[1] - 0.004 },
    { name: 'Farai K.', lat: woodlandsCoords[0] - 0.002, lng: woodlandsCoords[1] + 0.003 },
    { name: 'Alfonso Z.', lat: woodlandsCoords[0] + 0.004, lng: woodlandsCoords[1] + 0.002 }
  ];
  
  console.log(`🏍️ Nearby Bikers located:`);
  nearbyBikers.forEach((r, idx) => {
    console.log(`   [${idx+1}] ${r.name} - Coords: [${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}]`);
  });
  
  console.log("\n🤝 Negotiation: Rider 'Tinashe M.' countered the offered fare.");
  const customerOfferUSD = estimate.baseFare;
  const riderCounterUSD = Math.round(customerOfferUSD * 1.25 * 10) / 10;
  
  console.log(`   Customer Payout Offer   : ${formatPrice(customerOfferUSD)}`);
  console.log(`   Rider Counter Payout Bid: ${formatPrice(riderCounterUSD)} (+25% increase)`);
  console.log("🟢 Action: Customer accepts counter-offer!");
  
  const finalRiderPayout = riderCounterUSD;
  const finalTotalAmount = Math.round((riderCounterUSD + estimate.serviceFee + estimate.protectionFee) * 100) / 100;
  
  console.log(`💰 Readjusted Escrow Total: ${formatPrice(finalTotalAmount)}`);
  ledger.accounts.customer_escrow = finalTotalAmount; // Update held amount to reflectaccepted bid

  console.log("\n🚴 [Step 4: Active Biker Transit Check-in & Telemetry]");
  console.log("-----------------------------------------");
  console.log("🟢 Status Change: 'Rider Assigned' (Tinashe M. is en route to Woodlands Mall)");
  console.log("📍 Telemetry Sync: Broadcast coordinates received [ -15.4205, 28.3372 ]");
  console.log("🟢 Status Change: 'At Pickup' (Package verified boxable)");
  console.log("📸 Proof: Pickup photo uploaded to public.delivery_proofs table successfully.");
  console.log("🟢 Status Change: 'En Route to Delivery' (Check-in count starts)");

  console.log("\n⚠️ [Rider Liveness Safeguard Alert Triggered]");
  console.log("⏱️ Countdown overlay: 'Rider, are you OK? Missed checkpoint will trigger SOS in 10s...'");
  console.log("🟢 Action: Rider taps 'I am OK' within 4s. Safety check cleared.");

  console.log("\n🏁 [Step 5: Handover Handshake & Ledger settlement]");
  console.log("-----------------------------------------");
  console.log("🟢 Status Change: 'At Delivery' (Rider arrived at Kabulonga Mall)");
  console.log(`📲 Action: Customer enters Handover PIN: ${plaintextPin}`);
  
  console.log(`🔒 Hashing entered PIN: ${PinHandshake.hashPin(plaintextPin)}`);
  const isMatch = PinHandshake.verifyPin(plaintextPin, pinHash);
  
  if (isMatch) {
    console.log("✨ Pin Match Verified! Escrow released.");
    
    // Settle Ledger
    ledger.releaseEscrow(
      finalTotalAmount, 
      finalRiderPayout, 
      estimate.serviceFee, 
      estimate.protectionFee
    );
    
    console.log("🟢 Status Change: 'Completed' (Order lifecycle successfully completed!)");
  } else {
    console.log("❌ Incorrect PIN. Escrow remains locked.");
  }

  ledger.printLedger();
}

runSimulation();
