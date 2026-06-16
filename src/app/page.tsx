'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useProfile } from '@/context/ProfileContext';
import CityPulse from '@/components/CityPulse';
import PremiumIcon from '@/components/primitives/PremiumIcon';

const SERVICES = [
  {
    icon: 'Package',
    variant: 'primary',
    title: 'Send Item',
    description: 'Pickup from A, deliver to B. Real-time path tracing and PIN verification.',
  },
  {
    icon: 'ShoppingCart',
    variant: 'warning',
    title: 'Buy For Me',
    description: 'Provide your list. We source the items and deliver them to your door.',
  },
  {
    icon: 'Store',
    variant: 'success',
    title: 'Pick Up Order',
    description: 'Collect your pre-paid orders from any local shop, mall, or vendor.',
  },
  {
    icon: 'FileText',
    variant: 'info',
    title: 'Document Run',
    description: 'Contracts, urgent forms, or passports handled with high confidentiality.',
  },
  {
    icon: 'Clock',
    variant: 'neutral',
    title: 'Queue Service',
    description: 'Hire a verified representative to hold your spot in queues. Paid hourly.',
  },
  {
    icon: 'MapPin',
    variant: 'danger',
    title: 'Multi-Stop Delivery',
    description: 'Optimize routes with multiple pick-up and drop-off points in one run.',
  },
] as const;

const TRUST_PILLARS = [
  {
    icon: 'ShieldCheck',
    variant: 'protect',
    title: 'Escrow Protection',
    description: 'Your delivery payment is held safely until confirmed at the destination via a secure PIN.',
  },
  {
    icon: 'UserCheck',
    variant: 'success',
    title: 'Verified Drivers',
    description: 'All riders undergo background screening, vehicle inspections, and maintain reputation scores.',
  },
  {
    icon: 'Camera',
    variant: 'primary',
    title: 'Proof Chain Logs',
    description: 'Mandatory photos at both pickup and delivery are geofenced and logged on the ledger.',
  },
  {
    icon: 'Scale',
    variant: 'warning',
    title: 'Fair Dispute Resolution',
    description: 'Disputes are reviewed using visual evidence, resolving claims fairly within 24–48 hours.',
  },
] as const;

const SPEED_MODES = [
  {
    name: 'Biker Jet',
    icon: 'Zap',
    variant: 'jet',
    tagline: 'Priority Dispatch',
    description: 'Direct route, immediate pickup, and dedicated rider allocation for urgent shipments.',
  },
  {
    name: 'Standard Ride',
    icon: 'Bike',
    variant: 'primary',
    tagline: 'Balanced Speed & Price',
    description: 'On-demand local delivery at competitive standard rates. Fully tracked.',
  },
  {
    name: 'Scheduled Saver',
    icon: 'Calendar',
    variant: 'saver',
    tagline: 'Flexible & Affordable',
    description: 'Book a delivery slot in advance. We batch orders to pass the cost savings to you.',
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Select & Customize',
    description: 'Choose a service, specify your locations, and set your items details.',
  },
  {
    step: '02',
    title: 'Escrow Lock Payment',
    description: 'Your payment is safely held. The nearest verified rider is only dispatched once cleared.',
  },
  {
    step: '03',
    title: 'Track & Verify',
    description: 'Watch the route in real time. Provide the PIN to the rider to release funds on arrival.',
  },
] as const;

export default function LandingPage() {
  const { country } = useProfile();
  const isZM = country === 'ZM';
  const countryName = isZM ? 'Zambia' : 'Zimbabwe';
  const cityName = isZM ? 'Lusaka' : 'Harare';
  const paymentPreset = isZM ? 'MTN MoMo, Airtel Money, cards' : 'EcoCash, OneMoney, cards';
  const paymentFaqPreset = isZM ? 'MTN MoMo, Airtel Money, Visa, Mastercard, and cash' : 'EcoCash, OneMoney, InnBucks, Visa, Mastercard, and cash';

  const [activeTab, setActiveTab] = useState<'send' | 'buy' | 'collect'>('send');

  const getPhonePreviewData = () => {
    switch (activeTab) {
      case 'buy':
        return {
          title: 'Groceries & Pharmacy',
          ref: 'BKR-BUY902',
          pickup: 'Supermarket / Pharmacy',
          dropoff: isZM ? 'Kabulonga Residential' : 'Borrowdale Road',
          status: 'Rider purchasing items',
          statusSub: 'ETA 12 min · Receipt verification pending',
          price: isZM ? 'ZK 185.00' : '$7.40',
          badge: 'Buy For Me',
          badgeVariant: 'warning' as const,
        };
      case 'collect':
        return {
          title: 'Store Pick Up',
          ref: 'BKR-COL441',
          pickup: isZM ? 'Levy Junction Mall' : "Sam Levy's Village",
          dropoff: isZM ? 'Woodlands Extension' : 'Avondale East',
          status: 'Pre-paid order collected',
          statusSub: 'En route to drop-off · ETA 8 min',
          price: isZM ? 'ZK 90.00' : '$3.60',
          badge: 'Collect Order',
          badgeVariant: 'success' as const,
        };
      case 'send':
      default:
        return {
          title: 'Parcel Delivery',
          ref: 'BKR-SND882',
          pickup: isZM ? 'Manda Hill Mall' : 'Belvedere West',
          dropoff: isZM ? 'Showgrounds Retail' : 'Borrowdale Brooke',
          status: 'Rider en route to pickup',
          statusSub: 'ETA 4 min · Verified Rider',
          price: isZM ? 'ZK 125.00' : '$5.00',
          badge: 'Instant Jet',
          badgeVariant: 'primary' as const,
        };
    }
  };

  const preview = getPhonePreviewData();

  return (
    <div className={styles.page}>
      {/* ---- HEADER ---- */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            Biker<span className={styles.logoDot}>.</span>
          </div>
          <nav className={styles.nav}>
            <a href="#how-it-works" className={styles.navLink}>Process</a>
            <a href="#services" className={styles.navLink}>Services</a>
            <a href="#trust" className={styles.navLink}>Trust</a>
            <a href="#merchants" className={styles.navLink}>Merchants</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.loginBtn}>
              Log in
            </Link>
            <Link href="/signup" className="btn-apple btn-apple-primary">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---- HERO ---- */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadgeContainer}>
            <span className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Operating live in {cityName}
            </span>
          </div>
          <h1 className={styles.heroTitle}>
            Secure Errand Delivery<br />
            <span className={styles.heroGradient}>Built On Proof</span>
          </h1>
          <p className={styles.heroSubtitle}>
            {countryName}&apos;s premium logistics network. Protected payments, verified local riders, and dynamic geofenced timelines. Simple, transparent, and secure.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup" className="btn-apple btn-apple-primary">
              Request a delivery
            </Link>
            <Link href="/signup?role=rider" className="btn-apple btn-apple-secondary">
              Earn as a rider
            </Link>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.heroTrustItem}>
              <PremiumIcon name="ShieldCheck" variant="protect" size={16} />
              <span>Protected Escrow</span>
            </div>
            <div className={styles.heroTrustItem}>
              <PremiumIcon name="UserCheck" variant="success" size={16} />
              <span>Verified Riders</span>
            </div>
            <div className={styles.heroTrustItem}>
              <PremiumIcon name="Map" variant="primary" size={16} />
              <span>Live Tracking</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          {/* Segment Controls to change Phone preview */}
          <div className={styles.heroTabs}>
            <button 
              className={`${styles.heroTab} ${activeTab === 'send' ? styles.heroTabActive : ''}`}
              onClick={() => setActiveTab('send')}
            >
              Send Parcel
            </button>
            <button 
              className={`${styles.heroTab} ${activeTab === 'buy' ? styles.heroTabActive : ''}`}
              onClick={() => setActiveTab('buy')}
            >
              Buy For Me
            </button>
            <button 
              className={`${styles.heroTab} ${activeTab === 'collect' ? styles.heroTabActive : ''}`}
              onClick={() => setActiveTab('collect')}
            >
              Store Collect
            </button>
          </div>

          <div className={`${styles.heroPhone} apple-glass`}>
            <div className={styles.heroPhoneScreen}>
              <div className={`${styles.heroOrderCard} apple-glass`}>
                <div className={styles.heroOrderHeader}>
                  <span className={`${styles.statusBadge} glow-pill`} style={{ color: 'var(--color-primary-500)' }}>
                    ● Active
                  </span>
                  <span className={styles.heroOrderRef}>{preview.ref}</span>
                </div>
                
                <h3 className={styles.previewCardTitle}>{preview.title}</h3>

                <div className={styles.heroOrderRoute}>
                  <div className={styles.heroRoutePoint}>
                    <span className={styles.routePointOuter} style={{ color: 'var(--color-primary-500)' }}>
                      <span className={styles.routePointInner} />
                    </span>
                    <div>
                      <div className={styles.heroRouteLabel}>Start</div>
                      <div className={styles.heroRouteAddress}>{preview.pickup}</div>
                    </div>
                  </div>
                  <div className={styles.heroRouteLine} />
                  <div className={styles.heroRoutePoint}>
                    <span className={styles.routePointOuter} style={{ color: 'var(--color-success-500)' }}>
                      <span className={styles.routePointInner} />
                    </span>
                    <div>
                      <div className={styles.heroRouteLabel}>Destination</div>
                      <div className={styles.heroRouteAddress}>{preview.dropoff}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.heroOrderStatus}>
                  <PremiumIcon name="Bike" variant="info" size={18} backdrop="circle" />
                  <div>
                    <div className={styles.heroStatusText}>{preview.status}</div>
                    <div className={styles.heroStatusSub}>{preview.statusSub}</div>
                  </div>
                </div>

                <div className={styles.previewPriceContainer}>
                  <span className={styles.previewPriceLabel}>Offer Fare</span>
                  <span className={styles.previewPriceVal}>{preview.price}</span>
                </div>

                <div className={styles.heroOrderProtect}>
                  <PremiumIcon name="ShieldCheck" variant="protect" size={14} />
                  <span>Biker Protect Escrow Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- LIVE CITY PULSE ---- */}
      <section className={styles.pulseSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Real-time activity</span>
            <h2 className={styles.sectionTitle}>
              {cityName} pulse map
            </h2>
            <p className={styles.sectionSubtitle}>
              Live delivery activity and matching statistics across the metro area.
            </p>
          </div>
          <div className={styles.pulseMapContainer}>
            <CityPulse country={country} />
          </div>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section id="how-it-works" className={styles.howItWorks}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>The workflow</span>
            <h2 className={styles.sectionTitle}>Simple, secure steps</h2>
            <p className={styles.sectionSubtitle}>
              Three simple phases built around safety and verified proof of delivery.
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className={`${styles.stepCard} apple-glass`}>
                <div className={styles.stepNumber}>{step.step}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- SERVICES ---- */}
      <section id="services" className={styles.services}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Services</span>
            <h2 className={styles.sectionTitle}>Errands simplified</h2>
            <p className={styles.sectionSubtitle}>
              From simple deliveries to complex multi-stop runs or queue representation.
            </p>
          </div>
          <div className={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <div key={service.title} className={`${styles.serviceCard} apple-glass`}>
                <div className={styles.serviceIconContainer}>
                  <PremiumIcon name={service.icon} variant={service.variant} size={22} backdrop="squircle" glow />
                </div>
                <h3 className={styles.serviceTitle}>{service.title}</h3>
                <p className={styles.serviceDescription}>{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- SPEED MODES ---- */}
      <section className={styles.speedSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Priority Options</span>
            <h2 className={styles.sectionTitle}>Choose your delivery speed</h2>
            <p className={styles.sectionSubtitle}>
              Balance speed, priority, and pricing according to your shipment needs.
            </p>
          </div>
          <div className={styles.speedGrid}>
            {SPEED_MODES.map((mode) => (
              <div
                key={mode.name}
                className={`${styles.speedModeCard} apple-glass`}
                style={{
                  borderColor: `var(--color-${mode.variant})`,
                }}
              >
                <div className={styles.speedIconContainer}>
                  <PremiumIcon name={mode.icon} variant={mode.variant} size={24} backdrop="circle" glow />
                </div>
                <h3 className={styles.speedModeName}>{mode.name}</h3>
                <p className={styles.speedModeTagline}>{mode.tagline}</p>
                <p className={styles.speedModeDescription}>{mode.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- TRUST PILLARS ---- */}
      <section id="trust" className={styles.trustSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Trust & Safety</span>
            <h2 className={styles.sectionTitle}>Security by design</h2>
            <p className={styles.sectionSubtitle}>
              Features engineered to protect your funds, verify proof, and resolve disputes.
            </p>
          </div>
          <div className={styles.trustGrid}>
            {TRUST_PILLARS.map((pillar) => (
              <div key={pillar.title} className={`${styles.trustCard} apple-glass`}>
                <div className={styles.trustIconContainer}>
                  <PremiumIcon name={pillar.icon} variant={pillar.variant} size={24} backdrop="squircle" glow />
                </div>
                <h3 className={styles.trustTitle}>{pillar.title}</h3>
                <p className={styles.trustDescription}>{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- MERCHANTS CTA ---- */}
      <section id="merchants" className={styles.merchantSection}>
        <div className={styles.merchantInner}>
          <div className={styles.merchantContent}>
            <span className={styles.sectionLabel}>WhatsApp Sellers & E-Commerce</span>
            <h2 className={styles.merchantTitle}>
              Deliver to buyers with single-click links
            </h2>
            <p className={styles.merchantSubtitle}>
              Create delivery links, share them on WhatsApp or Instagram. Buyers select their drop-off coordinates, authorize escrow, and track their delivery. Simple and professional.
            </p>
            <ul className={styles.merchantFeatures}>
              <li>
                <PremiumIcon name="CheckCircle2" variant="primary" size={14} />
                <span>Shareable URLs — customers select precise GPS location</span>
              </li>
              <li>
                <PremiumIcon name="CheckCircle2" variant="primary" size={14} />
                <span>Secure payment hold via {paymentPreset}</span>
              </li>
              <li>
                <PremiumIcon name="CheckCircle2" variant="primary" size={14} />
                <span>Geofenced proof-of-delivery photos archived automatically</span>
              </li>
              <li>
                <PremiumIcon name="CheckCircle2" variant="primary" size={14} />
                <span>Automated rider matching only when order packaging is confirmed</span>
              </li>
            </ul>
            <Link href="/signup?role=merchant" className="btn-apple btn-apple-primary" style={{ marginTop: '24px' }}>
              Register your business
            </Link>
          </div>
          <div className={styles.merchantVisual}>
            <div className={`${styles.merchantMockup} apple-glass`}>
              <div className={styles.merchantMockupHeader}>
                Merchant Hub
              </div>
              <div className={styles.merchantMockupStats}>
                <div className={styles.merchantStat}>
                  <div className={styles.merchantStatValue}>47</div>
                  <div className={styles.merchantStatLabel}>Deliveries today</div>
                </div>
                <div className={styles.merchantStat}>
                  <div className={styles.merchantStatValue}>98.2%</div>
                  <div className={styles.merchantStatLabel}>SLA fulfillment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- RIDERS CTA ---- */}
      <section className={styles.riderSection}>
        <div className={styles.sectionInner}>
          <div className={styles.riderContent}>
            <span className={styles.sectionLabel}>Rider Careers</span>
            <h2 className={styles.sectionTitle}>Earn on your own terms</h2>
            <p className={styles.sectionSubtitle}>
              Complete local errands, build your trust score, and gain access to higher paying premium deliveries.
            </p>
            <div className={styles.riderPerks}>
              <div className={styles.riderPerk}>
                <PremiumIcon name="Banknote" variant="success" size={20} backdrop="circle" />
                <div>
                  <strong>Transparent Earnings</strong>
                  <p>Jet premium fees go directly to you. Earn what you deserve.</p>
                </div>
              </div>
              <div className={styles.riderPerk}>
                <PremiumIcon name="TrendingUp" variant="primary" size={20} backdrop="circle" />
                <div>
                  <strong>Reputation Tiering</strong>
                  <p>Increase your rating to unlock premium corporate document jobs.</p>
                </div>
              </div>
              <div className={styles.riderPerk}>
                <PremiumIcon name="ShieldCheck" variant="protect" size={20} backdrop="circle" />
                <div>
                  <strong>Escrow Security</strong>
                  <p>Every dispatch has guaranteed customer funds pre-locked in escrow.</p>
                </div>
              </div>
            </div>
            <Link href="/signup?role=rider" className="btn-apple btn-apple-primary" style={{ marginTop: '24px' }}>
              Apply to ride
            </Link>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className={styles.faqSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Common questions</h2>
          </div>
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>How is payment security handled?</h4>
              <p className={styles.faqAnswer}>
                Payments are held in a secure local escrow registry. The rider is dispatched, but cannot access the funds until the recipient validates the shipment with a custom delivery PIN.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>What payment channels are supported?</h4>
              <p className={styles.faqAnswer}>
                Biker integrates directly with {paymentFaqPreset}.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>What happens in case of a delivery issue?</h4>
              <p className={styles.faqAnswer}>
                Our built-in Dispute Center locks the escrow release. Support representatives review the geofenced proof photos and coordinates log to resolve disputes within 24 to 48 hours.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>How do I integrate Biker into my shop?</h4>
              <p className={styles.faqAnswer}>
                Simply register as a merchant to generate payment & delivery checkout links. Paste these directly to buyers on WhatsApp or social media. No API integration required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              Biker<span className={styles.logoDot}>.</span>
            </div>
            <p className={styles.footerTagline}>
              {countryName}&apos;s secure escrow logistics network.<br />
              Errands, commerce, and verified logistics.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h5 className={styles.footerColumnTitle}>Product</h5>
              <a href="#services">Services</a>
              <a href="#trust">Security</a>
              <a href="#merchants">Merchants</a>
              <Link href="/signup?role=rider">Riders</Link>
            </div>
            <div className={styles.footerColumn}>
              <h5 className={styles.footerColumnTitle}>Company</h5>
              <Link href="/about">About Us</Link>
              <a href="#">Careers</a>
              <a href="#">Support</a>
            </div>
            <div className={styles.footerColumn}>
              <h5 className={styles.footerColumnTitle}>Legal</h5>
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/disputes-policy">Dispute Policy</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} Biker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
