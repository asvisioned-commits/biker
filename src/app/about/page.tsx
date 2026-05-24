'use client';

import Link from 'next/link';

export default function AboutPage() {
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
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            About Biker
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
            Building Southern Africa's trust operating system for last-mile logistics.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>
              Biker was founded with a clear, ambitious mission: to solve the "trust deficit" in informal and local commerce across Southern Africa. From Harare to Bulawayo, and Lusaka to the Copperbelt, transactions happen every second over WhatsApp, Facebook Marketplace, and local Classifieds. Yet, a fundamental question remains: <strong>How can I send my package, pay for my goods, or run an errand with absolute confidence that my money is safe and the service will be fulfilled?</strong>
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              The Trust Operating System
            </h2>
            <p>
              We believe last-mile delivery isn't just about moving packages; it is about building trust. Biker integrates secure payment escrows, dual-PIN verification, GPS checkpoints, and device fingerprint fraud prevention into a seamless platform.
            </p>
            <p>
              When a buyer and seller transact on Biker, payments are securely held in escrow. They are only released when the delivery rider enters the recipient's unique verification PIN, and photo proof is uploaded. If any issue arises, our independent dispute resolution center steps in with data-backed logs to resolve the matter in under 48 hours.
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              Empowering Independent Riders
            </h2>
            <p>
              Behind every delivery is a rider. Biker is committed to providing sustainable livelihood opportunities for independent motorcycle, bicycle, and vehicle drivers in Zimbabwe and Zambia. With tools like our <strong>Maintenance Wallet</strong> (enabling automatic saving for bike services) and fair transparent payouts, Biker ensures that riders grow their own business with dignity.
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              Supporting Local Businesses
            </h2>
            <p>
              For merchants, we provide simple web-based delivery links. No complex app integration required. Generate a link, share it on WhatsApp with your customer, and let Biker handle the payment, delivery dispatch, and transaction proof. It's that simple.
            </p>
          </div>

          <div style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid var(--border-default)',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Want to join us on our journey?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link href="/signup" className="btn btn--primary">
                Get Started
              </Link>
              <Link href="/signup?role=rider" className="btn btn--secondary">
                Become a Rider
              </Link>
            </div>
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
