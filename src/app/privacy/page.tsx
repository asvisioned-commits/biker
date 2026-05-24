'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      <header style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-default)',
        padding: '1rem',
        zIndex: 100
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Biker<span style={{ color: 'var(--color-primary-500)' }}>.</span>
          </Link>
          <Link href="/" className="btn btn--secondary btn--sm">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="container" style={{ flex: 1, padding: '3rem 1rem', maxWidth: '800px' }}>
        <article className="card" style={{ padding: '2.5rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
            Last Updated: May 23, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>
              Biker is committed to protecting your privacy. This Privacy Policy details how we collect, process, and protect your personal information to build Southern Africa's trust operating system.
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              1. GPS Geolocation Tracking
            </h2>
            <p>
              To coordinate deliveries and protect transit routes, Biker collects and processes real-time location data:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>Rider Tracking:</strong> We collect high-frequency GPS coordinate trail updates from riders while they are online or on an active delivery. This is used for order tracking, route calculation, safety check-ins, and dispatching.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Customer Tracking:</strong> Customers' locations are collected during order placement and while viewing an active shipment to show nearby riders and estimated delivery times.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Background Location:</strong> The Biker mobile application may request background location access from riders to ensure SOS alerts and periodic check-ins function even when the device screen is off.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              2. Device Fingerprinting & Fraud Prevention
            </h2>
            <p>
              To maintain the integrity of our trust scores and protect the escrow ledger from malicious actors, we gather technical telemetry:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>Unique Identifiers:</strong> We collect and store device fingerprints, IP addresses, browser profiles, and user-agent strings.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Fraud Analysis:</strong> These fingerprints are used to detect multiple accounts, sybil attacks, route manipulation, and suspicious transaction patterns. Fraud logs are evaluated automatically by our security engine, and flags are reviewed by our Ops team.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              3. KYC & Verification Data
            </h2>
            <p>
              To verify identity and activate trust scores, we require official credentials:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>National IDs & Licenses:</strong> We collect National ID numbers, driver's license numbers, and vehicle registration numbers from riders and merchants during signup. This data is stored securely and is never shared publicly.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Selfies & Images:</strong> Riders must upload verification selfies and photos of their vehicle plates. These images are verified against their submitted documents by Biker operations personnel within 24 hours of registration.
              </li>
            </ul>
          </div>
        </article>
      </main>

      <footer style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '2rem 1rem',
        borderTop: '1px solid var(--border-default)',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <p>© {new Date().getFullYear()} Biker. All rights reserved.</p>
      </footer>
    </div>
  );
}
