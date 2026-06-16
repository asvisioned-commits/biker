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
        <article className="card" style={{ padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Terms & Trust Charter
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '2.5rem' }}>
            Effective Date: June 16, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '0.975rem' }}>
            <p>
              Welcome to <strong>Biker</strong>, the regional trust operating system for on-demand logistics. By accessing our platform, applications, or services, you agree to be bound by this Terms of Service & Trust Charter. If you do not agree, please do not use the platform.
            </p>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-default)', margin: '1rem 0' }} />

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️</span> 1. The Secure Escrow Shield
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                To establish peace of mind for Senders, Merchants, and Couriers, Biker routes transaction fees through our proprietary digital <strong>Escrow Shield</strong>:
              </p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Sender Protection:</strong> Delivery fees are held securely in escrow upon order placement. No funds are accessible to the Courier or third parties while delivery is in progress.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Courier Guarantee:</strong> Couriers are assured that funds are reserved and will be released instantly upon successful verification.
                </li>
              </ul>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-500)' }}>
                <strong>Legal Limit:</strong> Biker provides this digital escrow matching mechanism solely as an automated technology interface. Biker is not a financial institution, escrow company, bank, or fiduciary. By using Biker, you agree that Biker’s database status records represent the final, binding authority for determining verification PIN entries and releasing escrow funds. Biker disclaims all liability for ledger delays, network errors, or payment gateway failures.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤝</span> 2. Verified Local Courier Partners
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                Deliveries are fulfilled through Biker&apos;s network of independent <strong>Verified Courier Partners</strong>. Each partner undergoes identity screening, liveness validation, and credentials checks prior to dispatch eligibility.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-500)' }}>
                <strong>Legal Limit:</strong> You acknowledge and agree that Biker is a technology platform connecting Senders with Couriers. Couriers are entirely independent contractors operating their own transport equipment. They are not employees, agents, representatives, or joint-venturers of Biker. Biker does not direct, supervise, control, or monitor Couriers&apos; driving patterns, routes, schedules, traffic compliance, or cargo handling. Biker disclaims all liability for any Courier&apos;s acts, omissions, delay, vehicle condition, traffic infractions, loss of goods, or personal conduct. Senders contract directly with Couriers for carriage services.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📦</span> 3. Complimentary Package Protection Shield
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                For added assurance, qualified orders under our &quot;Protected&quot; tier receive complimentary coverage under the <strong>Biker Cargo Protection Shield</strong>, covering verified transit damage or package loss up to a maximum of <strong>$50 USD</strong>.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-500)' }}>
                <strong>Legal Limit:</strong> Biker Cargo Protection is a voluntary customer service goodwill program, not an insurance policy, surety bond, or contract of carriage. Biker retains sole, absolute, and final discretion to approve, adjust, or deny claims. Senders must report issues within 24 hours of scheduled completion with timestamped photographic proof. Biker is not liable for cargo values exceeding $50 USD. Senders are strictly prohibited from utilizing the platform to transport high-value valuables (cash, jewelry, bank checks, or illegal contraband), and Biker disclaims all liability for such items.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚖️</span> 4. Independent Dispute Resolution & Appeals
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                In the rare event of a transit conflict, Biker maintains a dedicated, neutral **Dispute Resolution Team** to review digital telemetry, GPS tracks, photo proofs, and device fingerprints to issue fair mediation.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-500)' }}>
                <strong>Legal Limit:</strong> Biker provides dispute resolution as an administrative convenience. Biker does not guarantee specific resolution outcomes and disclaims all liability for mediation decisions. Senders, Merchants, and Couriers agree that Biker&apos;s mediation decisions are final, binding, and release Biker from any further claims, liabilities, or disputes arising from the respective delivery order.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🚫</span> 5. Limitation of Platform Liability & Warranty Disclaimer
              </h2>
              <p style={{ marginBottom: '0.5rem' }}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE BIKER PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. BIKER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FIT FOR PURPOSE OR MERCHANTABILITY.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-500)' }}>
                IN NO EVENT SHALL BIKER, ITS DIRECTORS, OR ITS EMPLOYEES BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, REVENUE, OR DATA) ARISING FROM USE OF THE PLATFORM. BIKER&apos;S TOTAL AGGREGATE LIABILITY FOR ANY CLAIM SHALL BE STRICTLY LIMITED TO THE TRANSACTION OR SERVICE FEE PAID BY YOU TO BIKER FOR THE SPECIFIC ORDER GIVING RISE TO THE CLAIM.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🌍</span> 6. Regional Jurisdiction
              </h2>
              <p>
                These terms shall be governed by, construed, and enforced in accordance with the laws of the operating country where the services are fulfilled (either Zimbabwe or Zambia, as applicable). Any disputes arising under these terms shall be settled exclusively via binding mediation in Harare or Lusaka.
              </p>
            </section>
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
