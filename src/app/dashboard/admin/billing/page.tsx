'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  adminGetPaymentProofs,
  adminGetRiders,
  adminApprovePaymentProof,
  adminRejectPaymentProof,
  adminOverrideRiderStatus,
  PaymentProof,
  RiderSubscription
} from '../../earnings/actions';
import styles from './billing.module.css';

export default function AdminBillingPage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [riders, setRiders] = useState<RiderSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals / Dropdown states
  const [activeProof, setActiveProof] = useState<PaymentProof | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const [overrideRider, setOverrideRider] = useState<RiderSubscription | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'grace_period' | 'suspended' | 'closed'>('active');
  const [overrideReason, setOverrideReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await adminGetPaymentProofs();
      const r = await adminGetRiders();
      setProofs(p);
      setRiders(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveProof = async (id: string) => {
    if (!confirm('Approve this mobile money payment proof and activate the rider subscription?')) return;
    const res = await adminApprovePaymentProof(id, 'admin-user');
    alert(res.message);
    loadData();
  };

  const handleRejectProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProof) return;
    const res = await adminRejectPaymentProof(activeProof.id, rejectReason);
    alert(res.message);
    setActiveProof(null);
    setShowRejectForm(false);
    setRejectReason('');
    loadData();
  };

  const handleOverrideStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideRider) return;
    const res = await adminOverrideRiderStatus(
      overrideRider.rider_id,
      newStatus,
      overrideReason,
      'admin-user'
    );
    alert(res.message);
    setOverrideRider(null);
    setOverrideReason('');
    loadData();
  };

  // Analytics Metrics
  const totalSubscribers = riders.length;
  const activeSubs = riders.filter(r => r.status === 'active').length;
  const suspendedSubs = riders.filter(r => r.status === 'suspended').length;
  const totalDebt = riders.reduce((sum, r) => sum + Number(r.emergency_credit_used), 0);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Fetching rider database and pending billing queue...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      
      {/* Navigation & Breadcrumbs */}
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumbs}>
            <Link href="/dashboard/earnings">➔ Back to Wallet Hub</Link>
          </div>
          <h1 className={styles.title}>Admin Billing & Moderation</h1>
          <p className={styles.subtitle}>
            Approve mobile money transactions, inspect proofs, and override rider access statuses.
          </p>
        </div>
      </div>

      {/* Analytics Widget Grid */}
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticCard}>
          <div className={styles.analyticLabel}>Total Registered Riders</div>
          <div className={styles.analyticValue}>{totalSubscribers}</div>
          <div className={styles.analyticDesc}>All subscription records</div>
        </div>
        <div className={styles.analyticCard}>
          <div className={styles.analyticLabel}>Active Riders</div>
          <div className={styles.analyticValue} style={{ color: 'var(--color-success-600)' }}>
            {activeSubs}
          </div>
          <div className={styles.analyticDesc}>Accepting jobs normally</div>
        </div>
        <div className={styles.analyticCard}>
          <div className={styles.analyticLabel}>Suspended Accounts</div>
          <div className={styles.analyticValue} style={{ color: 'var(--color-danger-500)' }}>
            {suspendedSubs}
          </div>
          <div className={styles.analyticDesc}>Earning cap or grace exceeded</div>
        </div>
        <div className={styles.analyticCard}>
          <div className={styles.analyticLabel}>Total Outstanding Debt</div>
          <div className={styles.analyticValue} style={{ color: totalDebt > 0 ? 'var(--color-warning-600)' : 'inherit' }}>
            ${totalDebt.toFixed(2)}
          </div>
          <div className={styles.analyticDesc}>Total emergency credits used</div>
        </div>
      </div>

      {/* Main Grid: Pending Queue (Left) & Rider Ledger (Right) */}
      <div className={styles.dashboardGrid}>
        
        {/* Left Column: Proof Submissions Queue */}
        <div className={styles.queueColumn}>
          <h2 className={styles.sectionTitle}>📥 Mobile Money Verification Queue ({proofs.filter(p => p.status === 'pending').length})</h2>
          
          {proofs.length === 0 ? (
            <div className={styles.emptyCard}>
              <p>No mobile money proof submissions found in database.</p>
            </div>
          ) : (
            <div className={styles.proofsList}>
              {proofs.map((proof) => (
                <div key={proof.id} className={`${styles.proofCard} ${styles[`proofState_${proof.status}`]}`}>
                  <div className={styles.proofHeader}>
                    <div>
                      <strong>{proof.rider_name}</strong>
                      <span className={styles.proofTime}>{new Date(proof.created_at).toLocaleString()}</span>
                    </div>
                    <div className={styles.proofStatusBadge}>
                      {proof.status.toUpperCase()}
                    </div>
                  </div>

                  <div className={styles.proofDetails}>
                    <div className={styles.detailItem}>
                      <span>Amount Sent:</span>
                      <strong>${proof.amount.toFixed(2)}</strong>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Provider:</span>
                      <strong className={styles.methodBadge}>{proof.payment_method.toUpperCase()}</strong>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Reference Code:</span>
                      <code className={styles.refCode}>{proof.reference_number}</code>
                    </div>
                  </div>

                  {/* Thumbnail / Image Simulation */}
                  <div className={styles.imageThumbnail}>
                    <span className={styles.thumbnailLabel}>📎 Attachment Screenshot Proof:</span>
                    <div className={styles.mockScreenshot}>
                      <div className={styles.screenshotTop}>EcoCash Transfer Success</div>
                      <div className={styles.screenshotBody}>
                        <div>Amount: USD {proof.amount.toFixed(2)}</div>
                        <div>Ref: {proof.reference_number}</div>
                        <div>To: Biker Ltd (Merchant 184920)</div>
                      </div>
                    </div>
                  </div>

                  {proof.status === 'pending' && (
                    <div className={styles.proofActions}>
                      <button 
                        onClick={() => handleApproveProof(proof.id)} 
                        className="btn btn--primary btn--sm"
                      >
                        ✓ Approve & Activate
                      </button>
                      <button 
                        onClick={() => {
                          setActiveProof(proof);
                          setShowRejectForm(true);
                        }} 
                        className="btn btn--secondary btn--sm"
                      >
                        ✗ Reject Proof
                      </button>
                    </div>
                  )}

                  {proof.status === 'rejected' && proof.admin_notes && (
                    <div className={styles.rejectionNote}>
                      <strong>Rejection notes:</strong> {proof.admin_notes}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Rider Subscriptions Ledger */}
        <div className={styles.ledgerColumn}>
          <h2 className={styles.sectionTitle}>🚴 Rider Billing Ledger ({riders.length})</h2>
          
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.ledgerTable}>
                <thead>
                  <tr>
                    <th>Rider Info</th>
                    <th>Region</th>
                    <th>Earnings</th>
                    <th>Debt</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {riders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyTable}>No rider subscriptions registered in ledger.</td>
                    </tr>
                  ) : (
                    riders.map((r) => (
                      <tr key={r.rider_id}>
                        <td>
                          <strong>{r.rider_id === 'mock-rider' ? 'Takudzwa M.' : r.rider_id.slice(0, 8)}</strong>
                          <span className={styles.riderIdSub}>{r.rider_id}</span>
                        </td>
                        <td>
                          <span className={styles.regionBadge}>
                            {r.region_tier === 'zimbabwe' ? '🇿🇼 ZIM' : '🌎 STD'}
                          </span>
                        </td>
                        <td>
                          <strong>${r.current_earnings.toFixed(2)}</strong>
                          <span className={styles.earningCapSub}>of ${r.earning_cap.toFixed(2)}</span>
                        </td>
                        <td style={{ color: Number(r.emergency_credit_used) > 0 ? 'var(--color-danger-500)' : 'inherit' }}>
                          -${Number(r.emergency_credit_used).toFixed(2)}
                        </td>
                        <td>
                          <span className={`${styles.statusLabel} ${styles[`status_${r.status}`]}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setOverrideRider(r);
                              setNewStatus(r.status);
                            }}
                            className={styles.actionLink}
                          >
                            Override
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Reject Proof Modal */}
      {showRejectForm && activeProof && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Reject Payment Proof</h3>
              <button 
                onClick={() => {
                  setShowRejectForm(false);
                  setActiveProof(null);
                }} 
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRejectProofSubmit} className={styles.modalForm}>
              <p>State why you are rejecting the payment proof from {activeProof.rider_name}:</p>
              <textarea
                required
                className={styles.modalTextarea}
                placeholder="e.g. Reference number doesn't match merchant transaction list."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button type="submit" className="btn btn--primary">Confirm Rejection</button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowRejectForm(false);
                    setActiveProof(null);
                  }} 
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override Status Modal */}
      {overrideRider && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Override Rider Subscription Status</h3>
              <button onClick={() => setOverrideRider(null)} className={styles.modalClose}>×</button>
            </div>
            <form onSubmit={handleOverrideStatusSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Selected Rider:</label>
                <strong>{overrideRider.rider_id === 'mock-rider' ? 'Takudzwa M.' : overrideRider.rider_id}</strong>
              </div>

              <div className={styles.formGroup}>
                <label>Set Access Status:</label>
                <select
                  className={styles.modalSelect}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                >
                  <option value="active">Active (Resets Earnings & Credit)</option>
                  <option value="grace_period">Grace Period (72h limit)</option>
                  <option value="suspended">Suspended (Lockout)</option>
                  <option value="closed">Closed (Termination)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Reason for Status Change (Audited):</label>
                <textarea
                  required
                  className={styles.modalTextarea}
                  placeholder="Provide explicit reason e.g. Customer dispute resolved, offline cash settlement confirmed, etc."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className="btn btn--primary">Apply Status Override</button>
                <button type="button" onClick={() => setOverrideRider(null)} className="btn btn--secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
