'use client';

import { useState } from 'react';
import styles from './disputes.module.css';

const MOCK_DISPUTES = [
  {
    id: 'DSP-001',
    order_ref: 'BKR-P2Q6R8',
    type: 'wrong_item',
    status: 'open',
    severity: 'medium',
    description: 'The rider picked up the wrong package from the pharmacy. I ordered cough syrup but received bandages.',
    initiated_by: 'customer',
    against: 'rider',
    rider_name: 'Kudakwashe N.',
    created_at: '45 min ago',
    amount: 8.00,
    evidence: ['receipt_photo', 'item_photo'],
  },
  {
    id: 'DSP-002',
    order_ref: 'BKR-M3T9V7',
    type: 'damaged',
    status: 'investigating',
    severity: 'high',
    description: 'Phone screen cracked during transit. The package was not handled with care — bubble wrap was torn.',
    initiated_by: 'customer',
    against: 'rider',
    rider_name: 'Simba R.',
    created_at: '1 day ago',
    amount: 45.00,
    evidence: ['pickup_photo', 'delivery_photo', 'condition_note'],
  },
  {
    id: 'DSP-003',
    order_ref: 'BKR-L7K2X5',
    type: 'overcharged',
    status: 'resolved_customer_favor',
    severity: 'low',
    description: 'The Buy For Me purchase was $5.20 but I was charged $8.00. Receipt shows the correct amount.',
    initiated_by: 'customer',
    against: 'platform',
    rider_name: 'Gift T.',
    created_at: '3 days ago',
    amount: 2.80,
    evidence: ['receipt_photo'],
    resolution: 'Refund of $2.80 issued to wallet',
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  open: { label: 'Open', variant: 'danger' },
  evidence_requested: { label: 'Evidence needed', variant: 'warning' },
  investigating: { label: 'Investigating', variant: 'primary' },
  auto_resolved: { label: 'Auto-resolved', variant: 'success' },
  resolved_customer_favor: { label: 'Resolved — your favor', variant: 'success' },
  resolved_rider_favor: { label: 'Resolved — rider favor', variant: 'neutral' },
  escalated: { label: 'Escalated', variant: 'danger' },
  closed: { label: 'Closed', variant: 'neutral' },
};

const TYPE_LABELS: Record<string, string> = {
  wrong_item: 'Wrong Item',
  damaged: 'Damaged',
  never_arrived: 'Never Arrived',
  recipient_unavailable: 'Recipient Unavailable',
  underpaid_purchase: 'Underpaid Purchase',
  incomplete_order: 'Incomplete Order',
  overcharged: 'Overcharged',
  rude_behaviour: 'Rude Behaviour',
  safety_concern: 'Safety Concern',
};

export default function DisputesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Disputes</h1>
        <p className={styles.subtitle}>
          Manage and track your order disputes. Our protection policies ensure fair resolution.
        </p>
      </div>

      {/* Dispute Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>1</div>
          <div className={styles.statLabel}>Open</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>1</div>
          <div className={styles.statLabel}>Investigating</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>1</div>
          <div className={styles.statLabel}>Resolved</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>$2.80</div>
          <div className={styles.statLabel}>Refunded</div>
        </div>
      </div>

      {/* Disputes List */}
      <div className={styles.disputesList}>
        {MOCK_DISPUTES.map((dispute) => {
          const statusInfo = STATUS_LABELS[dispute.status] || STATUS_LABELS.open;
          const isExpanded = expanded === dispute.id;

          return (
            <div
              key={dispute.id}
              className={`${styles.disputeCard} ${isExpanded ? styles.disputeCardExpanded : ''}`}
            >
              <button
                className={styles.disputeHeader}
                onClick={() => setExpanded(isExpanded ? null : dispute.id)}
              >
                <div className={styles.disputeMeta}>
                  <div className={styles.disputeIcon}>⚖️</div>
                  <div>
                    <div className={styles.disputeId}>
                      {dispute.id}
                      <span className={styles.disputeOrderRef}>→ {dispute.order_ref}</span>
                    </div>
                    <div className={styles.disputeType}>{TYPE_LABELS[dispute.type] || dispute.type}</div>
                  </div>
                </div>
                <div className={styles.disputeRight}>
                  <span className={`badge badge--${statusInfo.variant}`}>{statusInfo.label}</span>
                  <span className={`badge badge--${SEVERITY_COLORS[dispute.severity]}`} style={{ fontSize: '0.65rem' }}>
                    {dispute.severity.toUpperCase()}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className={styles.disputeBody}>
                  <div className={styles.disputeDescription}>
                    <p>{dispute.description}</p>
                  </div>

                  <div className={styles.disputeDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Against</span>
                      <span>{dispute.against === 'rider' ? `🚴 ${dispute.rider_name}` : '🏢 Platform'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Amount in question</span>
                      <span className={styles.detailAmount}>${dispute.amount.toFixed(2)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Filed</span>
                      <span>{dispute.created_at}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Evidence</span>
                      <div className={styles.evidenceList}>
                        {dispute.evidence.map((e) => (
                          <span key={e} className="badge badge--neutral">{e.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                    {dispute.resolution && (
                      <div className={styles.resolution}>
                        <span>✅</span> {dispute.resolution}
                      </div>
                    )}
                  </div>

                  {dispute.status === 'open' && (
                    <div className={styles.disputeActions}>
                      <button className="btn btn--secondary btn--sm">Add evidence</button>
                      <button className="btn btn--ghost btn--sm">Withdraw dispute</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Policy Notice */}
      <div className={styles.policyNotice}>
        <div className={styles.policyIcon}>🛡️</div>
        <div>
          <strong>Biker Protect dispute policy</strong>
          <p>Protected orders are eligible for full refund if proof shows delivery failure. Disputes are reviewed within 24 hours. You can appeal any resolution within 48 hours.</p>
        </div>
      </div>
    </div>
  );
}
