'use client';

import { useState, useEffect } from 'react';
import styles from './disputes.module.css';
import { useProfile } from '@/context/ProfileContext';
import { getDisputes } from '@/lib/database';
import { ListSkeleton, StatsSkeleton } from '@/components/skeletons';

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
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
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
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
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
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
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

function formatTimeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return 'Recently';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

export default function DisputesPage() {
  const { session } = useProfile();
  const userId = session?.user_id;

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  const loadDisputes = async () => {
    if (!userId) {
      if (isDevMode) {
        setDisputes(MOCK_DISPUTES);
        setLoading(false);
      } else {
        setDisputes([]);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await getDisputes(userId);
      if (dbError) throw dbError;
      
      setDisputes(data || []);
    } catch (err: any) {
      console.error('Failed to load disputes:', err);
      setError('Could not retrieve live disputes. Showing local simulation.');
      if (isDevMode) {
        setDisputes(MOCK_DISPUTES);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, [userId]);

  // Aggregate statistics dynamically
  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'evidence_requested').length;
  const investigatingCount = disputes.filter(d => d.status === 'investigating' || d.status === 'escalated').length;
  const resolvedCount = disputes.filter(d => 
    d.status === 'resolved_customer_favor' || 
    d.status === 'resolved_rider_favor' || 
    d.status === 'auto_resolved' || 
    d.status === 'closed'
  ).length;
  
  const refundedSum = disputes
    .filter(d => d.status === 'resolved_customer_favor' || d.status === 'auto_resolved')
    .reduce((sum, d) => sum + (Number(d.refund_amount || d.amount) || 0), 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Disputes</h1>
        <p className={styles.subtitle}>
          Manage and track your order disputes. Our protection policies ensure fair resolution.
        </p>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-warning-50)', color: 'var(--color-warning-600)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Dispute Stats */}
      {loading ? (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <StatsSkeleton />
        </div>
      ) : (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{openCount}</div>
            <div className={styles.statLabel}>Open</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{investigatingCount}</div>
            <div className={styles.statLabel}>Investigating</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{resolvedCount}</div>
            <div className={styles.statLabel}>Resolved</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>${refundedSum.toFixed(2)}</div>
            <div className={styles.statLabel}>Refunded</div>
          </div>
        </div>
      )}

      {/* Disputes List */}
      {loading ? (
        <ListSkeleton count={2} />
      ) : disputes.length === 0 ? (
        <div className="empty-state card card--glass animate-fadeIn" style={{ padding: 'var(--space-12) var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <span className="empty-state-icon">⚖️</span>
          <h3 className="empty-state-title">No disputes filed</h3>
          <p className="empty-state-description" style={{ marginBottom: 'var(--space-6)' }}>
            All your orders are fully protected under Biker Protect. If you run into issues with a delivery, you can flag it directly from the order details page.
          </p>
        </div>
      ) : (
        <div className={styles.disputesList}>
          {disputes.map((dispute) => {
            const isMock = String(dispute.id).startsWith('DSP-') || (typeof dispute.id === 'string' && dispute.id.startsWith('mock-'));
            const dispId = isMock ? dispute.id : `DSP-${dispute.id.slice(0, 8).toUpperCase()}`;
            
            const orderRef = isMock 
              ? dispute.order_ref 
              : (dispute.request?.reference_code || 'BKR-UNKNOWN');
              
            const disputeType = dispute.dispute_type || dispute.type;
            const severity = dispute.severity || 'medium';
            const statusInfo = STATUS_LABELS[dispute.status] || STATUS_LABELS.open;
            const isExpanded = expanded === dispute.id;
            
            const dateStr = isMock 
              ? formatTimeAgo(dispute.created_at) 
              : formatTimeAgo(dispute.created_at);
              
            const amount = Number(dispute.refund_amount || dispute.amount || 0);
            
            const againstRole = dispute.against_role || dispute.against || 'platform';
            let opponentName = 'Platform';
            if (againstRole === 'rider') {
              opponentName = isMock 
                ? (dispute.rider_name || 'Rider') 
                : (dispute.against?.full_name || 'Rider');
            } else if (againstRole === 'customer') {
              opponentName = dispute.initiator?.full_name || 'Customer';
            }

            const evidenceList: string[] = dispute.evidence || [];
            const resolutionNotes = dispute.resolution_notes || dispute.resolution;

            return (
              <div
                key={dispute.id}
                className={`${styles.disputeCard} ${isExpanded ? styles.disputeCardExpanded : ''} card--glass`}
              >
                <button
                  className={styles.disputeHeader}
                  onClick={() => setExpanded(isExpanded ? null : dispute.id)}
                >
                  <div className={styles.disputeMeta}>
                    <div className={styles.disputeIcon}>⚖️</div>
                    <div>
                      <div className={styles.disputeId}>
                        {dispId}
                        <span className={styles.disputeOrderRef}>→ {orderRef}</span>
                      </div>
                      <div className={styles.disputeType}>{TYPE_LABELS[disputeType] || disputeType}</div>
                    </div>
                  </div>
                  <div className={styles.disputeRight}>
                    <span className={`badge badge--${statusInfo.variant}`}>{statusInfo.label}</span>
                    <span className={`badge badge--${SEVERITY_COLORS[severity]}`} style={{ fontSize: '0.65rem' }}>
                      {severity.toUpperCase()}
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
                        <span>{againstRole === 'rider' ? `🚴 ${opponentName}` : '🏢 Platform'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Amount in question</span>
                        <span className={styles.detailAmount}>${amount.toFixed(2)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Filed</span>
                        <span>{dateStr}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Evidence</span>
                        <div className={styles.evidenceList}>
                          {evidenceList.length > 0 ? (
                            evidenceList.map((e) => (
                              <span key={e} className="badge badge--neutral">{e.replace(/_/g, ' ')}</span>
                            ))
                          ) : (
                            <span className="badge badge--neutral">No attachments uploaded</span>
                          )}
                        </div>
                      </div>
                      {resolutionNotes && (
                        <div className={styles.resolution}>
                          <span>✅</span> {resolutionNotes}
                        </div>
                      )}
                    </div>

                    {dispute.status === 'open' && (
                      <div className={styles.disputeActions}>
                        <button className="btn btn--secondary btn--sm" onClick={() => alert('Feature coming soon under Phase 3!')}>Add evidence</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => alert('Feature coming soon under Phase 3!')}>Withdraw dispute</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Policy Notice */}
      <div className={styles.policyNotice} style={{ marginTop: 'var(--space-8)' }}>
        <div className={styles.policyIcon}>🛡️</div>
        <div>
          <strong>Biker Protect dispute policy</strong>
          <p>Protected orders are eligible for full refund if proof shows delivery failure. Disputes are reviewed within 24 hours. You can appeal any resolution within 48 hours.</p>
        </div>
      </div>
    </div>
  );
}