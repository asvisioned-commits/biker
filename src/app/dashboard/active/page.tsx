'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './active.module.css';
import { getSession } from '@/lib/auth';
import { getOrders, updateOrderStatus, uploadProof, insertLocationCheckpoint } from '@/lib/database';
import { OrderService } from '@/lib/order-service';
import { GlassCard } from '@/components/primitives/GlassCard';
import { tokens } from '@/lib/tokens';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

type JobStep = 'heading_pickup' | 'at_pickup' | 'proof_pickup' | 'en_route' | 'at_dropoff' | 'verify_pin' | 'completed';

const STEPS: { key: JobStep; label: string; icon: string; dbStatus?: string }[] = [
  { key: 'heading_pickup', label: 'Head to pickup', icon: '🏁', dbStatus: 'rider_en_route_pickup' },
  { key: 'at_pickup', label: 'Arrive at pickup', icon: '📍', dbStatus: 'at_pickup' },
  { key: 'proof_pickup', label: 'Upload proof', icon: '📸', dbStatus: 'proof_uploaded' },
  { key: 'en_route', label: 'En route to delivery', icon: '🚴', dbStatus: 'en_route_delivery' },
  { key: 'at_dropoff', label: 'Arrive at dropoff', icon: '📍', dbStatus: 'at_delivery' },
  { key: 'verify_pin', label: 'Verify PIN', icon: '🔑', dbStatus: 'delivery_confirmed' },
  { key: 'completed', label: 'Completed', icon: '✅', dbStatus: 'completed' },
];

const MOCK_JOB = {
  id: 'mock-job-1', reference_code: 'BKR-N3V8P2', service_type: 'send_item',
  pickup_address: "Sam Levy's Village, Borrowdale", pickup_contact_name: 'Sarah M.', pickup_contact_phone: '+263 77 123 4567',
  dropoff_address: 'Avondale Shops, 2nd Ave', dropoff_contact_name: 'Mike T.', dropoff_contact_phone: '+263 78 987 6543',
  dropoff_instructions: 'Blue gate, 3rd house left', item_description: 'Small parcel \u2014 medications',
  rider_payout: 3.50, protection_level: 'protected', customer_name: 'Sarah M.',
  estimated_distance_km: 4.2, estimated_duration_minutes: 12, status: 'rider_assigned',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobData = any;

export default function ActiveJobPage() {
  const [currentStep, setCurrentStep] = useState<JobStep>('heading_pickup');
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [job, setJob] = useState<JobData>(MOCK_JOB);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cash on Delivery state variables
  const [cashCollected, setCashCollected] = useState('');
  const [discrepancy, setDiscrepancy] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadActiveJob() {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user_id);
      
      if (IS_DEV) {
        const isCOD = typeof window !== 'undefined' && (window.location.search.includes('paymentMethod=cash') || window.location.search.includes('cod=1'));
        if (isCOD) {
          setJob({
            ...MOCK_JOB,
            payment_method: 'cash',
            total_amount: 18.50,
            delivery_fee: 15.00,
            reference_code: 'BKR-COD99',
            delivery_pin: '4729'
          });
          setCashCollected('18.50');
        } else {
          setJob(MOCK_JOB);
          setCashCollected('3.50');
        }
        setLoading(false);
        return;
      }
      
      const { data } = await getOrders(session.user_id, 'rider', { status: 'active', limit: 1 });
      if (data && data.length > 0) {
        const activeJob = data[0];
        setJob(activeJob);
        const payoutAmt = Number(activeJob.total_amount || activeJob.delivery_fee || 3.50);
        setCashCollected(payoutAmt.toFixed(2));
        const statusToStep: Record<string, JobStep> = {
          rider_assigned: 'heading_pickup', rider_en_route_pickup: 'heading_pickup', at_pickup: 'at_pickup',
          proof_uploaded: 'proof_pickup', en_route_delivery: 'en_route', at_delivery: 'at_dropoff',
          delivery_confirmed: 'verify_pin', completed: 'completed',
        };
        const step = statusToStep[activeJob.status] || 'heading_pickup';
        setCurrentStep(step);
        if (step === 'completed') setShowComplete(true);
      }
      setLoading(false);
    }
    loadActiveJob();
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const correctPin = '4729';

  const broadcastLocation = useCallback(async (eventType: string) => {
    if (!userId || IS_DEV) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        insertLocationCheckpoint({
          rider_id: userId, order_id: job.id, event_type: eventType,
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          heading: pos.coords.heading || undefined,
          speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : undefined,
          accuracy_meters: pos.coords.accuracy,
        });
      }, () => {});
    }
  }, [userId, job.id]);

  const advanceStep = useCallback(async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex];
      setCurrentStep(nextStep.key);
      if (!IS_DEV && userId && nextStep.dbStatus) {
        await updateOrderStatus(job.id, nextStep.dbStatus, `Rider advanced to: ${nextStep.label}`);
        await broadcastLocation(nextStep.dbStatus);
      }
      if (nextStep.key === 'completed') setShowComplete(true);
    }
  }, [currentStepIndex, userId, job.id, broadcastLocation]);

  const handleProofUpload = useCallback(async () => {
    setProofUploaded(true);
    if (!IS_DEV && userId) {
      await uploadProof({ request_id: job.id, uploaded_by: userId, proof_type: 'pickup_photo', file_url: `https://storage.example.com/proofs/${job.id}/pickup.jpg`, notes: 'Pickup photo uploaded by rider' });
    }
  }, [userId, job.id]);

  const handlePinDigit = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...pinInput];
    newPin[index] = value;
    setPinInput(newPin);
    setPinError(false);
    if (value && index < 3) { document.getElementById(`pin-${index + 1}`)?.focus(); }
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (job.payment_method === 'cash') {
        // Bypass auto-advance for COD orders
        return;
      }
      const actualCorrectPin = job.delivery_pin || correctPin;
      if (fullPin === actualCorrectPin) { setTimeout(() => advanceStep(), 500); }
      else { setPinError(true); setTimeout(() => { setPinInput(['', '', '', '']); setPinError(false); document.getElementById('pin-0')?.focus(); }, 1500); }
    }
  };

  const handleCompleteCodSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPinError(false);
    setErrorMessage('');

    const fullPin = pinInput.join('');
    if (fullPin.length < 4) {
      setPinError(true);
      setErrorMessage('Please enter the full 4-digit PIN');
      setIsSubmitting(false);
      return;
    }

    const collectedVal = parseFloat(cashCollected);
    if (isNaN(collectedVal) || collectedVal < 0) {
      setPinError(true);
      setErrorMessage('Please enter a valid cash amount');
      setIsSubmitting(false);
      return;
    }

    const expectedVal = Number(job.total_amount || job.delivery_fee || 3.50);
    const hasDiscrepancy = Math.abs(collectedVal - expectedVal) > 0.01;

    try {
      const result = await OrderService.completeCodDelivery({
        orderId: job.id,
        riderId: userId || '',
        pin: fullPin,
        cashCollected: collectedVal,
        hasDiscrepancy,
        expectedAmount: expectedVal,
      });

      if (result.success) {
        setDiscrepancy(hasDiscrepancy);
        setCurrentStep('completed');
        setShowComplete(true);
      } else {
        setPinError(true);
        setErrorMessage(result.error || 'Invalid PIN or collection failed');
        if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining);
        }
        setPinInput(['', '', '', '']);
        document.getElementById('pin-0')?.focus();
      }
    } catch (e: any) {
      setPinError(true);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const payout = Number(job.rider_payout || job.delivery_fee || 3.50);
  const distance = job.estimated_distance_km ? `${job.estimated_distance_km} km` : '4.2 km';
  const eta = job.estimated_duration_minutes ? `${job.estimated_duration_minutes} min` : '12 min';

  if (loading) return <div className={styles.page}><div className={styles.loadingState}><span>⏳</span><p>Loading active job...</p></div></div>;

  return (
    <div className={styles.page}>
      {showComplete && (
        <div className={styles.completeOverlay}><div className={styles.completeCard}>
          <div className={styles.completeIcon}>✅</div>
          <h2>Delivery Complete!</h2>
          {job.payment_method === 'cash' ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              PIN verified. Cash collection of <strong>${Number(cashCollected).toFixed(2)}</strong> has been logged to your rider ledger.
              {discrepancy && <span style={{ display: 'block', color: 'var(--color-danger-600)', marginTop: '0.5rem', fontWeight: 600 }}>⚠️ Cash discrepancy reported and flagged for review.</span>}
            </p>
          ) : (
            <p>PIN verified. Funds will be released to your wallet.</p>
          )}
          <div className={styles.completePayout}>
            <span>{job.payment_method === 'cash' ? 'Cash Collected' : 'Your payout'}</span>
            <strong>${(job.payment_method === 'cash' ? Number(cashCollected) : payout).toFixed(2)}</strong>
          </div>
          <div className={styles.completeStats}><div><span>Distance</span><strong>{distance}</strong></div><div><span>Time</span><strong>18 min</strong></div><div><span>Rating</span><strong>⭐ Pending</strong></div></div>
          <button className="btn btn--primary btn--full" onClick={() => window.location.href = '/dashboard/jobs'}>Find next job</button>
        </div></div>
      )}
      <div className={styles.header}><div><h1 className={styles.title}>Active Job</h1><span className={styles.ref}>{job.reference_code || 'BKR-N3V8P2'} &middot; {job.service_type?.replace('_', ' ') || 'Send Item'}</span></div><div className={styles.payoutBadge}>${payout.toFixed(2)}</div></div>
      <div className={styles.progress}>
        {STEPS.map((step, i) => (<div key={step.key} className={`${styles.progressStep} ${i < currentStepIndex ? styles.progressDone : ''} ${i === currentStepIndex ? styles.progressActive : ''}`}><div className={styles.progressDot}>{i < currentStepIndex ? '\u2713' : step.icon}</div>{i < STEPS.length - 1 && <div className={styles.progressLine} />}</div>))}
      </div>
      <div className={styles.progressLabel}>{STEPS[currentStepIndex]?.icon} {STEPS[currentStepIndex]?.label}</div>
      <div className={styles.mapArea}><div className={styles.mapPlaceholder}><div className={styles.mapContent}><span>🗺️</span><p>Live map &middot; {eta} to {currentStepIndex < 3 ? 'pickup' : 'dropoff'}</p></div></div></div>
      <div className={styles.routeCard}>
        <div className={styles.routePoint}><div className={styles.routeDot} data-type="pickup" /><div><div className={styles.routeLabel}>Pickup</div><div className={styles.routeAddress}>{job.pickup_address}</div><div className={styles.routeContact}>👤 {job.pickup_contact_name || 'Sarah M.'} &middot; {job.pickup_contact_phone || '+263 77 123 4567'}</div></div></div>
        <div className={styles.routeDivider}><span className={styles.routeDistance}>{distance}</span></div>
        <div className={styles.routePoint}><div className={styles.routeDot} data-type="dropoff" /><div><div className={styles.routeLabel}>Deliver to</div><div className={styles.routeAddress}>{job.dropoff_address}</div><div className={styles.routeContact}>👤 {job.dropoff_contact_name || 'Mike T.'} &middot; {job.dropoff_contact_phone || '+263 78 987 6543'}</div>{job.dropoff_instructions && <div className={styles.routeNote}>🏠 {job.dropoff_instructions}</div>}</div></div>
      </div>
      <div className={styles.itemCard}><span>📝</span><div><strong>{job.item_description || 'Small parcel'}</strong>{(job.protection_level || 'protected') !== 'none' && <div className={styles.protectionBadge}>🛡️ Protected &middot; Escrow held</div>}</div></div>
      <div className={styles.actionArea}>
        {currentStep === 'heading_pickup' && <div className={styles.actionCard}><h3>Head to the pickup location</h3><p>Navigate to {job.pickup_address}</p><button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>I&apos;ve arrived at pickup</button></div>}
        {currentStep === 'at_pickup' && <div className={styles.actionCard}><h3>At pickup point</h3><p>Contact {job.pickup_contact_name || 'the sender'} to collect the item.</p><div className={styles.actionButtons}><button className="btn btn--secondary btn--full">📞 Call sender</button><button className="btn btn--primary btn--full" onClick={advanceStep}>Item collected &rarr; Upload proof</button></div></div>}
        {currentStep === 'proof_pickup' && <div className={styles.actionCard}><h3>📸 Upload pickup proof</h3><p>Take a photo of the item before leaving. This protects both you and the customer.</p>{!proofUploaded ? <div className={styles.photoUpload}><div className={styles.photoPlaceholder} onClick={handleProofUpload}><span>📷</span><p>Tap to take photo</p></div></div> : <div className={styles.photoSuccess}><span>✅</span><p>Proof uploaded successfully</p></div>}<button className="btn btn--primary btn--full btn--lg" onClick={advanceStep} disabled={!proofUploaded}>Continue to delivery</button></div>}
        {currentStep === 'en_route' && <div className={styles.actionCard}><h3>🚴 En route to delivery</h3><p>Navigate to {job.dropoff_address}</p><div className={styles.etaDisplay}><span className={styles.etaLabel}>ETA</span><span className={styles.etaValue}>{eta}</span></div><button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>I&apos;ve arrived at dropoff</button></div>}
        {currentStep === 'at_dropoff' && <div className={styles.actionCard}><h3>At delivery point</h3><p>Look for: <strong>{job.dropoff_instructions || 'the recipient'}</strong></p><div className={styles.actionButtons}><button className="btn btn--secondary btn--full">📞 Call recipient</button><button className="btn btn--primary btn--full" onClick={advanceStep}>Ready to deliver &rarr; Enter PIN</button></div></div>}
        {currentStep === 'verify_pin' && (
          job.payment_method === 'cash' ? (
            <GlassCard intensity="high" style={{ border: '2px solid rgba(16, 185, 129, 0.3)', padding: '2rem', background: 'rgba(10, 10, 10, 0.7)' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto'
                }}>
                  <span style={{ fontSize: '2rem' }}>💵</span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>Confirm Delivery</h2>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
                  Cash on Delivery &bull; Order #{job.reference_code || 'BKR-COD99'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Cash Amount Input */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                    Cash Collected (USD)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '1.5rem' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={cashCollected}
                      onChange={(e) => {
                        setCashCollected(e.target.value);
                        setPinError(false);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'transparent',
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        paddingLeft: '2rem',
                        paddingRight: '1rem',
                        paddingTop: '0.5rem',
                        paddingBottom: '0.5rem',
                        border: 'none',
                        outline: 'none',
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      Expected Collection: <span style={{ color: '#10b981', fontWeight: 600 }}>${(Number(job.total_amount || job.delivery_fee || 3.50)).toFixed(2)}</span>
                    </p>
                    {cashCollected && Math.abs(parseFloat(cashCollected) - Number(job.total_amount || job.delivery_fee || 3.50)) > 0.01 && (
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                        &nbsp;⚠️ Discrepancy detected
                      </span>
                    )}
                  </div>
                </div>

                {/* PIN Input */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                    Customer 4-Digit PIN
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', margin: '0.5rem 0' }}>
                    {pinInput.map((digit, i) => (
                      <input
                        key={i}
                        id={`pin-${i}`}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinDigit(i, e.target.value)}
                        style={{
                          width: '3.5rem',
                          height: '4rem',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: pinError ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '0.5rem',
                          textAlign: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          outline: 'none',
                        }}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  {pinError && (
                    <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, margin: '0.5rem 0 0 0' }}>
                      ❌ {errorMessage || 'Incorrect PIN. Please try again.'}
                    </p>
                  )}
                  {attemptsRemaining !== null && (
                    <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 500, margin: '0.25rem 0 0 0' }}>
                      ⚠️ {attemptsRemaining} verification attempts remaining before order lock.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleCompleteCodSubmit}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '1rem',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                  onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#059669')}
                  onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#10b981')}
                >
                  {isSubmitting ? 'Processing completion...' : 'Confirm & Complete Delivery'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  PIN hash verification is atomic and logs directly to operations.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className={styles.actionCard}>
              <h3>🔑 Enter delivery PIN</h3>
              <p>Ask the recipient for their 4-digit delivery PIN to confirm handover.</p>
              <div className={`${styles.pinInputGroup} ${pinError ? styles.pinError : ''}`}>
                {pinInput.map((digit, i) => (
                  <input
                    key={i}
                    id={`pin-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={styles.pinDigit}
                    value={digit}
                    onChange={(e) => handlePinDigit(i, e.target.value)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {pinError && <p className={styles.pinErrorText}>❌ Incorrect PIN. Please try again.</p>}
              <p className={styles.pinHint}>PIN protects both parties. Funds release only after verification.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
