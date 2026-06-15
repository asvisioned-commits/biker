'use client';

import { useState, useEffect } from 'react';
import styles from './disputes.module.css';
import { useProfile } from '@/context/ProfileContext';
import { OrderService } from '@/lib/order-service';
import { ListSkeleton, StatsSkeleton } from '@/components/skeletons';
import { createClient } from '@/lib/supabase/client';
import DisputeEvidenceViewer from '@/components/DisputeEvidenceViewer';
import PremiumIcon from '@/components/primitives/PremiumIcon';

// Mock disputes removed

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

  // Phase 3 States
  const [activeTab, setActiveTab] = useState<'my-disputes' | 'ops-console'>('my-disputes');
  const [showEvidenceInput, setShowEvidenceInput] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [opsNotes, setOpsNotes] = useState<{ [key: string]: string }>({});
  const [submittingAction, setSubmittingAction] = useState(false);



  // Phase 4 safety alerts state
  const [activeSafetyAlerts, setActiveSafetyAlerts] = useState<any[]>([]);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [sosNotes, setSosNotes] = useState('');

  // Check roles
  const userRole = session?.role || '';
  const userRoles = session?.roles || [];
  const isOpsOrAdmin = userRole === 'ops' || userRole === 'admin' || userRoles.includes('ops') || userRoles.includes('admin');

  // Load and subscribe to active safety alerts for Ops/Admin
  useEffect(() => {
    if (!isOpsOrAdmin) return;

    const fetchActiveAlerts = async () => {
      try {
        const data = await OrderService.getSafetyAlerts();
        const active = data.filter((a: any) => a.status === 'active');
        setActiveSafetyAlerts(active);
      } catch (err) {
        console.error('Failed to load safety alerts:', err);
      }
    };

    fetchActiveAlerts();

    // Set up polling for offline/local storage updates in dev mode
    let intervalId: NodeJS.Timeout | null = null;
    if (!OrderService.isOnline) {
      intervalId = setInterval(fetchActiveAlerts, 3000);
    }

    if (!OrderService.isOnline) {
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }

    const supabase = createClient();
    const safetyChannel = supabase
      .channel('ops-safety-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'safety_alerts'
        },
        async (payload) => {
          console.log('Realtime safety alert change:', payload);
          const data = await OrderService.getSafetyAlerts();
          const active = data.filter((a: any) => a.status === 'active');
          setActiveSafetyAlerts(active);
        }
      )
      .subscribe();

    return () => {
      if (intervalId) clearInterval(intervalId);
      supabase.removeChannel(safetyChannel);
    };
  }, [isOpsOrAdmin]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (activeTab === 'ops-console') {
        const data = await OrderService.getAllDisputes();
        setDisputes(data || []);
      } else {
        if (!userId) {
          setDisputes([]);
          return;
        }
        const data = await OrderService.getDisputes(userId);
        setDisputes(data || []);
      }
    } catch (err: any) {
      console.error('Failed to load disputes:', err);
      setError('Could not retrieve disputes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, [userId, activeTab]);

  const handleWithdrawDispute = async (disputeId: string) => {
    if (!confirm('Are you sure you want to withdraw this dispute? This will restore the order to its original status.')) {
      return;
    }
    
    try {
      setSubmittingAction(true);
      const success = await OrderService.withdrawDispute(disputeId);
      if (success) {
        alert('Dispute withdrawn successfully.');
        loadDisputes();
      } else {
        alert('Failed to withdraw dispute. Please try again.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAddEvidence = async (disputeId: string) => {
    if (!evidenceUrl.trim()) return;
    
    try {
      setSubmittingAction(true);
      const success = await OrderService.addDisputeEvidence(disputeId, evidenceUrl.trim());
      if (success) {
        alert('Evidence added successfully.');
        setEvidenceUrl('');
        setShowEvidenceInput(null);
        loadDisputes();
      } else {
        alert('Failed to add evidence.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, action: 'approve' | 'deny') => {
    const notes = opsNotes[disputeId] || '';
    if (!notes.trim()) {
      alert('Please provide resolution notes explaining the decision.');
      return;
    }
    
    if (!confirm(`Are you sure you want to ${action} this dispute?`)) {
      return;
    }
    
    try {
      setSubmittingAction(true);
      const success = await OrderService.resolveDispute(
        disputeId,
        action,
        session?.full_name || 'Ops Agent',
        notes.trim()
      );
      if (success) {
        alert(`Dispute ${action === 'approve' ? 'approved' : 'denied'} successfully.`);
        setOpsNotes(prev => {
          const next = { ...prev };
          delete next[disputeId];
          return next;
        });
        loadDisputes();
      } else {
        alert(`Failed to ${action} dispute.`);
      }
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally {
      setSubmittingAction(false);
    }
  };

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
      {isOpsOrAdmin && activeSafetyAlerts.length > 0 && (
        <div className={styles.sosOverlay}>
          <div className={styles.sosContainer}>
            <div className={styles.sosHeader}>
              <span className={styles.sosIcon}>
                <PremiumIcon name="ShieldAlert" variant="danger" animate="pulse" size={28} />
              </span>
              <div>
                <h2 className={styles.sosTitle}>Critical Safety Alert Active</h2>
                <p className={styles.sosSubtitle}>
                  {activeSafetyAlerts.length} active distress signal{activeSafetyAlerts.length > 1 ? 's' : ''} require immediate action.
                </p>
              </div>
            </div>

            <div className={styles.sosAlertList}>
              {activeSafetyAlerts.map((alert) => {
                const orderRef = alert.order?.reference_code || alert.order_ref || 'BKR-UNKNOWN';
                const riderName = alert.user?.full_name || 'Rider';
                const riderPhone = alert.user?.phone || 'Unknown Phone';
                const alertTime = new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                return (
                  <div key={alert.id} className={styles.sosAlertCard}>
                    <div className={styles.sosMetaGrid}>
                      <div className={styles.sosMetaItem}>
                        <span className={styles.sosMetaLabel}>
                          <PremiumIcon name="User" variant="info" size={12} className="mr-1" /> Rider
                        </span>
                        <span className={styles.sosMetaValue}>{riderName} ({riderPhone})</span>
                      </div>
                      <div className={styles.sosMetaItem}>
                        <span className={styles.sosMetaLabel}>
                          <PremiumIcon name="Package" variant="primary" size={12} className="mr-1" /> Order Reference
                        </span>
                        <span className={styles.sosMetaValue}>{orderRef}</span>
                      </div>
                      <div className={styles.sosMetaItem}>
                        <span className={styles.sosMetaLabel}>Alert Type</span>
                        <span className={styles.sosMetaValue} style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {alert.type === 'sos_alert' ? (
                            <>
                              <PremiumIcon name="ShieldAlert" variant="danger" animate="pulse" size={14} />
                              <span>SOS SIGNAL TRIGGERED</span>
                            </>
                          ) : (
                            <>
                              <PremiumIcon name="Clock" variant="warning" animate="spin-slow" size={14} />
                              <span>MISSED CHECK-IN</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className={styles.sosMetaItem}>
                        <span className={styles.sosMetaLabel}>Triggered At</span>
                        <span className={styles.sosMetaValue}>{alertTime}</span>
                      </div>
                      {alert.gps_lat && alert.gps_lng && (
                        <div className={styles.sosMetaItem} style={{ gridColumn: 'span 2' }}>
                          <span className={styles.sosMetaLabel}>GPS Coordinates</span>
                          <span className={styles.sosMetaValue} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <PremiumIcon name="MapPin" variant="danger" size={14} />
                            <span>{alert.gps_lat.toFixed(6)}, {alert.gps_lng.toFixed(6)}</span>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${alert.gps_lat},${alert.gps_lng}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: '10px', color: '#60a5fa', textDecoration: 'underline' }}
                            >
                              View on Map
                            </a>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.sosForm}>
                      <textarea
                        className={styles.sosTextarea}
                        placeholder="Type safety clearance notes here..."
                        value={resolvingAlertId === alert.id ? sosNotes : ''}
                        onChange={(e) => {
                          setResolvingAlertId(alert.id);
                          setSosNotes(e.target.value);
                        }}
                      />
                      <div className={styles.sosButtonRow}>
                        <button
                          className={`${styles.sosButton} ${styles.sosButtonSecondary}`}
                          onClick={() => {
                            alert(`Initiating emergency call to: ${riderPhone}`);
                          }}
                        >
                          <PremiumIcon name="Phone" variant="success" size={14} className="mr-1" /> Call Rider
                        </button>
                        <button
                          className={`${styles.sosButton} ${styles.sosButtonDanger}`}
                          onClick={() => {
                            alert(`Dispatching local security response forces to order ${orderRef}. GPS coordinates forwarded.`);
                            setResolvingAlertId(alert.id);
                            setSosNotes(`[Ops Security Dispatch] Security services dispatched to coordinates: ${alert.gps_lat || 'Unknown'}, ${alert.gps_lng || 'Unknown'}.`);
                          }}
                        >
                          <PremiumIcon name="ShieldAlert" variant="danger" size={14} className="mr-1" /> Dispatch Security
                        </button>
                        <button
                          className={`${styles.sosButton} ${styles.sosButtonSuccess}`}
                          onClick={async () => {
                            const notes = resolvingAlertId === alert.id ? sosNotes : '';
                            if (!notes.trim()) {
                              alert('Please fill in resolution notes explaining details of safety clearance before resolving.');
                              return;
                            }
                            try {
                              const resolvedBy = session?.user_id || 'Ops Agent';
                              const success = await OrderService.resolveSafetyAlert(alert.id, resolvedBy, notes);
                              if (success) {
                                alert('Distress alert resolved and cleared.');
                                setSosNotes('');
                                setResolvingAlertId(null);
                                // Refresh list
                                const freshAlerts = await OrderService.getSafetyAlerts();
                                setActiveSafetyAlerts(freshAlerts.filter((a: any) => a.status === 'active'));
                              } else {
                                alert('Failed to resolve safety alert. Please try again.');
                              }
                            } catch (e: any) {
                              console.error(e);
                              alert('Error resolving safety alert: ' + e.message);
                            }
                          }}
                        >
                          <PremiumIcon name="CheckCircle" variant="success" size={14} className="mr-1" /> Resolve & Clear
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>Disputes</h1>
        <p className={styles.subtitle}>
          Manage and track your order disputes. Our protection policies ensure fair resolution.
        </p>
      </div>

      {isOpsOrAdmin && (
        <div className={styles.tabContainer}>
          <button
            className={`${styles.tabButton} ${activeTab === 'my-disputes' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('my-disputes')}
          >
            My Disputes
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'ops-console' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('ops-console')}
          >
            Ops Review Console
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-warning-50)', color: 'var(--color-warning-600)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center' }}>
          <PremiumIcon name="AlertTriangle" variant="warning" size={16} className="mr-2" />
          <span>{error}</span>
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
        <div className="empty-state card card--glass animate-fadeIn" style={{ padding: 'var(--space-12) var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <PremiumIcon name="Scale" variant="neutral" size={48} backdrop="squircle" glow />
          </div>
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
                    <div className={styles.disputeIcon}>
                      <PremiumIcon name="Scale" variant="warning" size={20} />
                    </div>
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
                    <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '20px' }}>
                      <DisputeEvidenceViewer
                        referenceCode={orderRef}
                        disputeReason={TYPE_LABELS[disputeType] || disputeType}
                        chatLog={[
                          { sender: 'Customer', text: 'Where is my order? It shows delivered but I received nothing.', time: '12:04 PM' },
                          { sender: 'Rider', text: 'Encountered roadblock on Sam Nujoma St, arrived but nobody came out.', time: '12:06 PM' },
                          { sender: 'Customer', text: 'I am at the gate, please check if you are at the correct address.', time: '12:08 PM' },
                        ]}
                        timeline={[
                          { title: 'Dispatch Initiated', desc: 'Order published by customer', time: '11:45 AM', completed: true },
                          { title: 'Payment Secured', desc: 'Funds held in escrow reserve', time: '11:46 AM', completed: true },
                          { title: 'Rider Departed', desc: 'Heading to pickup station', time: '11:50 AM', completed: true },
                          { title: 'At Destination', desc: 'Delivery confirmation code requested', time: '12:15 PM', completed: true },
                        ]}
                        receiptUrl={dispute.evidence?.includes('receipt_photo') ? '/images/mock-receipt.jpg' : undefined}
                        proofPhotoUrl={dispute.evidence?.includes('delivery_photo') ? '/images/mock-delivery.jpg' : undefined}
                        pickupCoords={[-17.8292, 31.0522]}
                        dropoffCoords={[-17.7842, 31.0532]}
                        actualRouteCheckpoint={[-17.8012, 31.0498]}
                      />
                    </div>

                    <div className={styles.disputeDescription}>
                      <p>{dispute.description}</p>
                    </div>

                    <div className={styles.disputeDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Filed By</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {dispute.initiated_by === 'customer' ? (
                            <>
                              <PremiumIcon name="User" variant="info" size={14} />
                              <span>Customer</span>
                            </>
                          ) : dispute.initiated_by === 'rider' ? (
                            <>
                              <PremiumIcon name="Bike" variant="success" size={14} />
                              <span>Rider</span>
                            </>
                          ) : (
                            dispute.initiated_by
                          )}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Against</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {againstRole === 'rider' ? (
                            <>
                              <PremiumIcon name="Bike" variant="success" size={14} />
                              <span>{opponentName}</span>
                            </>
                          ) : (
                            <>
                              <PremiumIcon name="Building" variant="neutral" size={14} />
                              <span>Platform</span>
                            </>
                          )}
                        </span>
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
                        <div className={styles.resolution} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PremiumIcon name="CheckCircle" variant="success" size={16} glow />
                          <span>{resolutionNotes}</span>
                        </div>
                      )}
                    </div>

                    {activeTab === 'ops-console' ? (
                      (dispute.status === 'open' || dispute.status === 'evidence_requested' || dispute.status === 'investigating' || dispute.status === 'escalated') && (
                        <div className={styles.opsControls}>
                          <span className={styles.opsNotesLabel}>Ops Resolution Notes</span>
                          <textarea
                            className={styles.opsNotesTextarea}
                            placeholder="Enter notes about investigation, wallet adjustments, or reasons for denial..."
                            value={opsNotes[dispute.id] || ''}
                            onChange={(e) => setOpsNotes(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                          />
                          <div className={styles.opsActions}>
                            <button
                              className="btn btn--success btn--sm"
                              onClick={() => handleResolveDispute(dispute.id, 'approve')}
                              disabled={submittingAction}
                            >
                              Approve Dispute (Refund Wallet)
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={() => handleResolveDispute(dispute.id, 'deny')}
                              disabled={submittingAction}
                            >
                              Deny Dispute (Revert Order)
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      (dispute.status === 'open' || dispute.status === 'evidence_requested') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          <div className={styles.disputeActions}>
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => setShowEvidenceInput(showEvidenceInput === dispute.id ? null : dispute.id)}
                            >
                              {showEvidenceInput === dispute.id ? 'Cancel' : 'Add evidence'}
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => handleWithdrawDispute(dispute.id)}
                              disabled={submittingAction}
                            >
                              Withdraw dispute
                            </button>
                          </div>

                          {showEvidenceInput === dispute.id && (
                            <div className={styles.evidenceForm}>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Add Evidence File URL or Description
                              </span>
                              <div className={styles.evidenceInputRow}>
                                <input
                                  type="text"
                                  className={styles.evidenceInput}
                                  placeholder="e.g. https://example.com/receipt.jpg or description"
                                  value={evidenceUrl}
                                  onChange={(e) => setEvidenceUrl(e.target.value)}
                                />
                                <button
                                  className="btn btn--primary btn--sm"
                                  onClick={() => handleAddEvidence(dispute.id)}
                                  disabled={!evidenceUrl.trim() || submittingAction}
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
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
        <div className={styles.policyIcon}>
          <PremiumIcon name="ShieldCheck" variant="protect" size={24} glow />
        </div>
        <div>
          <strong>Biker Protect dispute policy</strong>
          <p>Protected orders are eligible for full refund if proof shows delivery failure. Disputes are reviewed within 24 hours. You can appeal any resolution within 48 hours.</p>
        </div>
      </div>
    </div>
  );
}
