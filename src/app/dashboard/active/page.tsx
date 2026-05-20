'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './active.module.css';
import { getSession } from '@/lib/auth';
import { getOrders, updateOrderStatus, uploadProof, insertLocationCheckpoint } from '@/lib/database';

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

  useEffect(() => {
    async function loadActiveJob() {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user_id);
      if (IS_DEV) { setLoading(false); return; }
      const { data } = await getOrders(session.user_id, 'rider', { status: 'active', limit: 1 });
      if (data && data.length > 0) {
        const activeJob = data[0];
        setJob(activeJob);
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
      if (fullPin === correctPin) { setTimeout(() => advanceStep(), 500); }
      else { setPinError(true); setTimeout(() => { setPinInput(['', '', '', '']); setPinError(false); document.getElementById('pin-0')?.focus(); }, 1500); }
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
          <div className={styles.completeIcon}>✅</div><h2>Delivery Complete!</h2><p>PIN verified. Funds will be released to your wallet.</p>
          <div className={styles.completePayout}><span>Your payout</span><strong>${payout.toFixed(2)}</strong></div>
          <div className={styles.completeStats}><div><span>Distance</span><strong>{distance}</strong></div><div><span>Time</span><strong>18 min</strong></div><div><span>Rating</span><strong>⭐ Pending</strong></div></div>
          <button className="btn btn--primary btn--full" onClick={() => window.location.href = '/dashboard/jobs'}>Find next job</button>
        </div></div>
      )}
      <div className={styles.header}><div><h1 className={styles.title}>Active Job</h1><span className={styles.ref}>{job.reference_code || 'BKR-N3V8P2'} \u00b7 {job.service_type?.replace('_', ' ') || 'Send Item'}</span></div><div className={styles.payoutBadge}>${payout.toFixed(2)}</div></div>
      <div className={styles.progress}>
        {STEPS.map((step, i) => (<div key={step.key} className={`${styles.progressStep} ${i < currentStepIndex ? styles.progressDone : ''} ${i === currentStepIndex ? styles.progressActive : ''}`}><div className={styles.progressDot}>{i < currentStepIndex ? '\u2713' : step.icon}</div>{i < STEPS.length - 1 && <div className={styles.progressLine} />}</div>))}
      </div>
      <div className={styles.progressLabel}>{STEPS[currentStepIndex]?.icon} {STEPS[currentStepIndex]?.label}</div>
      <div className={styles.mapArea}><div className={styles.mapPlaceholder}><div className={styles.mapContent}><span>🗺️</span><p>Live map \u00b7 {eta} to {currentStepIndex < 3 ? 'pickup' : 'dropoff'}</p></div></div></div>
      <div className={styles.routeCard}>
        <div className={styles.routePoint}><div className={styles.routeDot} data-type="pickup" /><div><div className={styles.routeLabel}>Pickup</div><div className={styles.routeAddress}>{job.pickup_address}</div><div className={styles.routeContact}>👤 {job.pickup_contact_name || 'Sarah M.'} \u00b7 {job.pickup_contact_phone || '+263 77 123 4567'}</div></div></div>
        <div className={styles.routeDivider}><span className={styles.routeDistance}>{distance}</span></div>
        <div className={styles.routePoint}><div className={styles.routeDot} data-type="dropoff" /><div><div className={styles.routeLabel}>Deliver to</div><div className={styles.routeAddress}>{job.dropoff_address}</div><div className={styles.routeContact}>👤 {job.dropoff_contact_name || 'Mike T.'} \u00b7 {job.dropoff_contact_phone || '+263 78 987 6543'}</div>{job.dropoff_instructions && <div className={styles.routeNote}>🏠 {job.dropoff_instructions}</div>}</div></div>
      </div>
      <div className={styles.itemCard}><span>📝</span><div><strong>{job.item_description || 'Small parcel'}</strong>{(job.protection_level || 'protected') !== 'none' && <div className={styles.protectionBadge}>🛡️ Protected \u00b7 Escrow held</div>}</div></div>
      <div className={styles.actionArea}>
        {currentStep === 'heading_pickup' && <div className={styles.actionCard}><h3>Head to the pickup location</h3><p>Navigate to {job.pickup_address}</p><button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>I&apos;ve arrived at pickup</button></div>}
        {currentStep === 'at_pickup' && <div className={styles.actionCard}><h3>At pickup point</h3><p>Contact {job.pickup_contact_name || 'the sender'} to collect the item.</p><div className={styles.actionButtons}><button className="btn btn--secondary btn--full">📞 Call sender</button><button className="btn btn--primary btn--full" onClick={advanceStep}>Item collected \u2192 Upload proof</button></div></div>}
        {currentStep === 'proof_pickup' && <div className={styles.actionCard}><h3>📸 Upload pickup proof</h3><p>Take a photo of the item before leaving. This protects both you and the customer.</p>{!proofUploaded ? <div className={styles.photoUpload}><div className={styles.photoPlaceholder} onClick={handleProofUpload}><span>📷</span><p>Tap to take photo</p></div></div> : <div className={styles.photoSuccess}><span>✅</span><p>Proof uploaded successfully</p></div>}<button className="btn btn--primary btn--full btn--lg" onClick={advanceStep} disabled={!proofUploaded}>Continue to delivery</button></div>}
        {currentStep === 'en_route' && <div className={styles.actionCard}><h3>🚴 En route to delivery</h3><p>Navigate to {job.dropoff_address}</p><div className={styles.etaDisplay}><span className={styles.etaLabel}>ETA</span><span className={styles.etaValue}>{eta}</span></div><button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>I&apos;ve arrived at dropoff</button></div>}
        {currentStep === 'at_dropoff' && <div className={styles.actionCard}><h3>At delivery point</h3><p>Look for: <strong>{job.dropoff_instructions || 'the recipient'}</strong></p><div className={styles.actionButtons}><button className="btn btn--secondary btn--full">📞 Call recipient</button><button className="btn btn--primary btn--full" onClick={advanceStep}>Ready to deliver \u2192 Enter PIN</button></div></div>}
        {currentStep === 'verify_pin' && <div className={styles.actionCard}><h3>🔑 Enter delivery PIN</h3><p>Ask the recipient for their 4-digit delivery PIN to confirm handover.</p><div className={`${styles.pinInputGroup} ${pinError ? styles.pinError : ''}`}>{pinInput.map((digit, i) => <input key={i} id={`pin-${i}`} type="text" inputMode="numeric" maxLength={1} className={styles.pinDigit} value={digit} onChange={(e) => handlePinDigit(i, e.target.value)} autoFocus={i === 0} />)}</div>{pinError && <p className={styles.pinErrorText}>❌ Incorrect PIN. Please try again.</p>}<p className={styles.pinHint}>PIN protects both parties. Funds release only after verification.</p></div>}
      </div>
    </div>
  );
}
