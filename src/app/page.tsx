'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { useProfile } from '@/context/ProfileContext';
import CityPulse from '@/components/CityPulse';

const SERVICES = [
  {
    icon: '📦',
    title: 'Send Item',
    description: 'Pickup from A, deliver to B. Tracked and verified.',
  },
  {
    icon: '🛒',
    title: 'Buy For Me',
    description: 'Give us a list. We buy it and bring it to your door.',
  },
  {
    icon: '🏪',
    title: 'Pick Up Order',
    description: 'Collect your pre-paid order from any vendor.',
  },
  {
    icon: '📄',
    title: 'Document Run',
    description: 'Contracts, forms, passports — handled with care.',
  },
  {
    icon: '⏳',
    title: 'Queue Service',
    description: 'Hire someone to stand in line for you. Pay by the hour.',
  },
  {
    icon: '📍',
    title: 'Multi-Stop',
    description: 'Multiple pickups and drop-offs in one errand.',
  },
];

const TRUST_PILLARS = [
  {
    icon: '🛡️',
    title: 'Money Protected',
    description:
      'Your payment is held securely until delivery is confirmed with a PIN. No surprises.',
  },
  {
    icon: '✓',
    title: 'Verified Riders',
    description:
      'Every rider is ID-checked and vehicle-verified. Trust scores are earned, not given.',
  },
  {
    icon: '📸',
    title: 'Proof Chain',
    description:
      'Mandatory photos at pickup and delivery. Receipts verified. Everything logged.',
  },
  {
    icon: '⚖️',
    title: 'Fair Disputes',
    description:
      'Clear resolution process backed by evidence. Auto-resolved when proof is complete.',
  },
];

const SPEED_MODES = [
  {
    name: 'Biker Jet',
    icon: '⚡',
    tagline: 'Need it now',
    description: 'Priority dispatch. Direct route. Higher rider share.',
    accent: 'var(--color-jet)',
    bg: 'hsl(24, 95%, 97%)',
  },
  {
    name: 'Standard',
    icon: '🚴',
    tagline: 'Balanced speed & price',
    description: 'On-demand delivery at a fair rate. Reliable and tracked.',
    accent: 'var(--color-primary-500)',
    bg: 'var(--color-primary-50)',
  },
  {
    name: 'Scheduled Saver',
    icon: '📅',
    tagline: 'Flexible & affordable',
    description:
      'Pick a window, save money. We batch routes for efficiency.',
    accent: 'var(--color-saver)',
    bg: 'hsl(175, 65%, 96%)',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Tell us what you need',
    description: 'Choose a service, set pickup and delivery, add items if needed.',
  },
  {
    step: '02',
    title: 'Pay securely',
    description: 'Your money is held safely. The rider is dispatched only after payment clears.',
  },
  {
    step: '03',
    title: 'Track and receive',
    description: 'Watch your rider live. Confirm delivery with a PIN. Funds release automatically.',
  },
];

export default function LandingPage() {
  const { country } = useProfile();
  const isZM = country === 'ZM';
  const countryName = isZM ? 'Zambia' : 'Zimbabwe';
  const cityName = isZM ? 'Lusaka' : 'Harare';
  const pickupPreset = isZM ? 'Manda Hill Mall' : "Sam Levy's Village";
  const dropoffPreset = isZM ? 'Woodlands Shopping Mall' : 'Borrowdale Brooke';
  const paymentPreset = isZM ? 'MTN MoMo, Airtel Money, cards' : 'EcoCash, OneMoney, cards';
  const paymentFaqPreset = isZM ? 'MTN MoMo, Airtel Money, Visa, Mastercard, and cash' : 'EcoCash, OneMoney, InnBucks, Visa, Mastercard, and cash';

  return (
    <div className={styles.page}>
      {/* ---- HEADER ---- */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            Biker<span className={styles.logoDot}>.</span>
          </div>
          <nav className={styles.nav}>
            <a href="#how-it-works" className={styles.navLink}>How it works</a>
            <a href="#services" className={styles.navLink}>Services</a>
            <a href="#trust" className={styles.navLink}>Trust</a>
            <a href="#merchants" className={styles.navLink}>For merchants</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={`btn btn--ghost ${styles.loginBtn}`}>
              Log in
            </Link>
            <Link href="/signup" className={`btn btn--primary ${styles.signupBtn}`}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---- HERO ---- */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Now live in {cityName}
          </div>
          <h1 className={styles.heroTitle}>
            Send, Buy, Deliver<br />
            <span className={styles.heroGradient}>Anything Safely</span>
          </h1>
          <p className={styles.heroSubtitle}>
            {countryName}&apos;s trusted platform for errands, deliveries, and local commerce.
            Protected payments. Verified riders. Every delivery provable.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup" className={`btn btn--primary btn--lg ${styles.heroPrimary}`}>
              Start sending
            </Link>
            <Link href="/signup?role=rider" className={`btn btn--secondary btn--lg`}>
              Earn as a rider
            </Link>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.heroTrustItem}>
              <span>🛡️</span> Protected payments
            </div>
            <div className={styles.heroTrustDivider} />
            <div className={styles.heroTrustItem}>
              <span>✓</span> Verified riders
            </div>
            <div className={styles.heroTrustDivider} />
            <div className={styles.heroTrustItem}>
              <span>📍</span> Live tracking
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroPhone}>
            <div className={styles.heroPhoneScreen}>
              <div className={styles.heroOrderCard}>
                <div className={styles.heroOrderHeader}>
                  <span className="badge badge--success">● Live</span>
                  <span className={styles.heroOrderRef}>BKR-7X2K9M</span>
                </div>
                <div className={styles.heroOrderRoute}>
                  <div className={styles.heroRoutePoint}>
                    <div className={styles.heroRouteDot} style={{ background: 'var(--color-primary-500)' }} />
                    <div>
                      <div className={styles.heroRouteLabel}>Pickup</div>
                      <div className={styles.heroRouteAddress}>{pickupPreset}</div>
                    </div>
                  </div>
                  <div className={styles.heroRouteLine} />
                  <div className={styles.heroRoutePoint}>
                    <div className={styles.heroRouteDot} style={{ background: 'var(--color-success-500)' }} />
                    <div>
                      <div className={styles.heroRouteLabel}>Deliver to</div>
                      <div className={styles.heroRouteAddress}>{dropoffPreset}</div>
                    </div>
                  </div>
                </div>
                <div className={styles.heroOrderStatus}>
                  <div className={styles.heroStatusIcon}>🚴</div>
                  <div>
                    <div className={styles.heroStatusText}>Rider en route to pickup</div>
                    <div className={styles.heroStatusSub}>ETA 4 min · Verified rider</div>
                  </div>
                </div>
                <div className={styles.heroOrderProtect}>
                  <span>🛡️</span> Biker Protect active · Funds held securely
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- LIVE CITY PULSE ---- */}
      <section style={{
        padding: '0 0 40px 0',
        background: 'linear-gradient(180deg, var(--bg-app) 0%, hsl(220, 25%, 8%) 30%)',
      }}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader} style={{ marginBottom: '24px' }}>
            <span className={styles.sectionLabel}>Live right now</span>
            <h2 className={styles.sectionTitle} style={{ color: '#fff' }}>
              {cityName} is moving
            </h2>
            <p className={styles.sectionSubtitle} style={{ color: 'rgba(255,255,255,0.6)' }}>
              Real-time delivery activity across the city. Riders online, packages in transit.
            </p>
          </div>
          <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CityPulse country={country} />
          </div>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section id="how-it-works" className={styles.howItWorks}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Simple process</span>
            <h2 className={styles.sectionTitle}>How Biker works</h2>
            <p className={styles.sectionSubtitle}>
              Three steps between you and a safe, tracked delivery.
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className={styles.stepCard}>
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
            <span className={styles.sectionLabel}>What you can do</span>
            <h2 className={styles.sectionTitle}>More than delivery</h2>
            <p className={styles.sectionSubtitle}>
              Send parcels, buy groceries, collect orders, run documents, skip queues.
            </p>
          </div>
          <div className={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <div key={service.title} className={styles.serviceCard}>
                <div className={styles.serviceIcon}>{service.icon}</div>
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
            <span className={styles.sectionLabel}>Choose your speed</span>
            <h2 className={styles.sectionTitle}>Fast, balanced, or affordable</h2>
            <p className={styles.sectionSubtitle}>
              You decide what matters most. Speed or savings — the choice is yours.
            </p>
          </div>
          <div className={styles.speedGrid}>
            {SPEED_MODES.map((mode) => (
              <div
                key={mode.name}
                className={styles.speedModeCard}
                style={{
                  borderColor: mode.accent,
                  background: mode.bg,
                }}
              >
                <div
                  className={styles.speedModeBar}
                  style={{ background: mode.accent }}
                />
                <div className={styles.speedModeIcon}>{mode.icon}</div>
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
            <span className={styles.sectionLabel}>Why people trust Biker</span>
            <h2 className={styles.sectionTitle}>Built on proof, not promises</h2>
            <p className={styles.sectionSubtitle}>
              Every delivery is protected, verified, tracked, and resolvable.
            </p>
          </div>
          <div className={styles.trustGrid}>
            {TRUST_PILLARS.map((pillar) => (
              <div key={pillar.title} className={styles.trustCard}>
                <div className={styles.trustIcon}>{pillar.icon}</div>
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
            <span className={styles.sectionLabel}>For WhatsApp sellers & shops</span>
            <h2 className={styles.merchantTitle}>
              Your customers click.<br />We deliver.
            </h2>
            <p className={styles.merchantSubtitle}>
              Generate a delivery link, send it on WhatsApp. Your customer pays,
              we dispatch a verified rider, and you track proof of every delivery.
            </p>
            <ul className={styles.merchantFeatures}>
              <li>✦ Shareable delivery links — no app needed for your customer</li>
              <li>✦ Protected payments via {paymentPreset}</li>
              <li>✦ Proof of delivery archive for every order</li>
              <li>✦ Ready signal — rider comes only when you&apos;re packed</li>
              <li>✦ Batch morning, afternoon, evening pickups</li>
            </ul>
            <Link href="/signup?role=merchant" className="btn btn--primary btn--lg">
              Register your business
            </Link>
          </div>
          <div className={styles.merchantVisual}>
            <div className={styles.merchantMockup}>
              <div className={styles.merchantMockupHeader}>
                Merchant Dashboard
              </div>
              <div className={styles.merchantMockupStats}>
                <div className={styles.merchantStat}>
                  <div className={styles.merchantStatValue}>47</div>
                  <div className={styles.merchantStatLabel}>Deliveries today</div>
                </div>
                <div className={styles.merchantStat}>
                  <div className={styles.merchantStatValue}>98%</div>
                  <div className={styles.merchantStatLabel}>On-time rate</div>
                </div>
                <div className={styles.merchantStat}>
                  <div className={styles.merchantStatValue}>4.9</div>
                  <div className={styles.merchantStatLabel}>Customer rating</div>
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
            <span className={styles.sectionLabel}>Earn on your own terms</span>
            <h2 className={styles.sectionTitle}>Ride with Biker</h2>
            <p className={styles.sectionSubtitle}>
              Set your schedule. Build your reputation. Unlock better-paying jobs as your
              trust score grows. Your earnings, your rules.
            </p>
            <div className={styles.riderPerks}>
              <div className={styles.riderPerk}>
                <span>💰</span>
                <div>
                  <strong>Fair earnings</strong>
                  <p>Jet premium goes directly to you. No hidden cuts.</p>
                </div>
              </div>
              <div className={styles.riderPerk}>
                <span>📈</span>
                <div>
                  <strong>Grow your tier</strong>
                  <p>Starter → Verified → Pro → Elite. Better jobs at every level.</p>
                </div>
              </div>
              <div className={styles.riderPerk}>
                <span>🔧</span>
                <div>
                  <strong>Maintenance wallet</strong>
                  <p>Save a portion of earnings automatically for bike servicing.</p>
                </div>
              </div>
            </div>
            <Link href="/signup?role=rider" className="btn btn--primary btn--lg">
              Start earning
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
              <h3 className={styles.faqQuestion}>{isZM ? 'What payment options are supported?' : 'Can I pay with EcoCash?'}</h3>
              <p className={styles.faqAnswer}>
                Yes. Biker supports {paymentFaqPreset}.
                Protection is optional — add it if you want the full escrow guarantee.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What if the rider doesn&apos;t deliver?</h3>
              <p className={styles.faqAnswer}>
                If delivery can&apos;t be verified (no PIN entered, no proof photos), your funds
                are not released. Our dispute center reviews evidence and resolves cases within 24-48 hours.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is Biker Protect the same as insurance?</h3>
              <p className={styles.faqAnswer}>
                No. Biker Protect is a service guarantee that adds extra verification steps,
                photo proof requirements, and an extended dispute window to your delivery.
                It is not an insurance product.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How do I become a rider?</h3>
              <p className={styles.faqAnswer}>
                Sign up, submit your ID, vehicle registration, and a selfie for verification.
                Once approved, you can go online and start accepting jobs immediately.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>I sell on WhatsApp. Can I use Biker?</h3>
              <p className={styles.faqAnswer}>
                Absolutely. Register as a merchant, create delivery links, and send them to your
                customers on WhatsApp. They pay, we deliver, you see proof. No app needed for your customer.
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
              {countryName}&apos;s trust operating system for<br />
              errands, deliveries, and local commerce.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Product</h4>
              <a href="#services">Services</a>
              <a href="#trust">Trust & Safety</a>
              <a href="#merchants">For Merchants</a>
              <Link href="/signup?role=rider">For Riders</Link>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Company</h4>
              <Link href="/about">About</Link>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Legal</h4>
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
