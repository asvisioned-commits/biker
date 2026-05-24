'use client';

import Link from 'next/link';

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
            Last Updated: May 23, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>
              Welcome to Biker. By accessing or using our platform, website, and delivery services, you agree to comply with and be bound by these Terms of Service. Please read them carefully.
            </p>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              1. Escrow Payment System
            </h2>
            <p>
              Biker operates a secure, double-entry escrow payment ledger to protect both buyers and sellers. 
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>Holding Funds:</strong> When an order is placed, funds are transferred into a secure Biker escrow account. The merchant or sender cannot access these funds, and the rider is not paid until the order is successfully completed.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Releasing Funds:</strong> Funds are automatically released from escrow to the rider (as payout) and the merchant/seller (as settlement) upon validation of a secure Delivery Verification PIN or manual verification by the Biker operations console.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              2. Delivery Verification PINs
            </h2>
            <p>
              To ensure packages are delivered to the correct recipient and prevent fraud:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                A unique, secure 6-digit **Delivery Verification PIN** is generated for every protected order and sent directly to the recipient.
              </li>
              <li style={{ marginBottom: '8px' }}>
                The recipient **must** provide this PIN to the delivery rider upon handover.
              </li>
              <li style={{ marginBottom: '8px' }}>
                The rider enters this PIN into the Biker application to mark the order as complete and release the escrow. Providing or entering incorrect PINs repeatedly will trigger temporary safety lockouts.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              3. Cash Collection Responsibility (Cash on Delivery)
            </h2>
            <p>
              For orders utilizing the Cash on Delivery (COD) payment method:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>Rider Liability:</strong> The assigned delivery rider assumes full financial liability for collecting the exact cash amount specified in the order description from the recipient at the point of handover.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Outstanding Balances:</strong> All collected cash is recorded as an outstanding liability in the rider's cash ledger. Riders must remit outstanding cash balances to Biker-approved agents or digital gateways within designated time limits.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Discrepancies:</strong> Failure to collect the correct cash amount or report discrepancies immediately will result in temporary suspension of the rider's profile and active roles.
              </li>
            </ul>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', color: 'var(--text-primary)' }}>
              4. Dispute Filing Deadlines
            </h2>
            <p>
              In the event of a damaged, missing, or incorrect delivery:
            </p>
            <ul>
              <li style={{ marginBottom: '8px' }}>
                <strong>24-Hour Window:</strong> All claims, issues, and disputes must be formally filed through the Biker App Dispute Console within **24 hours** of the order status being marked as completed.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Forfeiture of Escrow Claims:</strong> Once the 24-hour dispute window has closed, the escrowed funds are permanently released, and Biker cannot reverse transactions, issue refunds, or recover payouts.
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
