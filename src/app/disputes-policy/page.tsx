'use client';

import Link from 'next/link';

export default function DisputesPolicyPage() {
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
            Dispute Policy
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
            Last Updated: May 23, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>
              Biker aims to maintain a secure and reliable delivery network. In the event of delivery failures, package damages, or missing payouts, our independent Dispute Resolution team evaluates evidence to reach a fair settlement.
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              1. Evidence Requirements
            </h2>
            <p>
              To file a dispute, you must provide sufficient, clear evidence. Claims submitted without proper documentation will be automatically dismissed.
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>For Damage Claims:</strong> Clear photograph or video evidence of the packaging and items taken immediately upon handover. You must demonstrate that the damage occurred during transit.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>For Missing Item Claims:</strong> Detailed lists of items, receipts/invoices, and communication logs. We verify these against our GPS tracking checkpoints and the rider's status logs.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>For Riders (Payout Disputes):</strong> GPS coordinate records from your device, photos of the dropoff location, and the recipient's signature or proof of handover attempts.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              2. Response & Resolution Timelines
            </h2>
            <p>
              We act swiftly to resolve disputes and minimize settlement delays:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>Filing a Dispute:</strong> A dispute must be filed within 24 hours of the order completion.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Respondent Notification:</strong> Once a dispute is filed, the counterparty (rider, merchant, or customer) is notified immediately and has **24 hours** to submit counter-evidence.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Resolution Window:</strong> The Biker dispute team reviews the case and issues a binding decision within **24 to 48 hours** from the time the dispute response window closes.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              3. Appeal Window
            </h2>
            <p>
              If you disagree with the resolution issued by our dispute team:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                You may file a formal appeal through the support console within **7 days** of the resolution decision.
              </li>
              <li style={{ marginBottom: '8px' }}>
                Appeals require new, previously unsubmitted evidence to be considered. If no new evidence is provided, the appeal will be dismissed, and the initial decision remains final.
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
