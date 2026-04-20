'use client';

import { useState } from 'react';
import styles from './active.module.css';

type JobStep = 'heading_pickup' | 'at_pickup' | 'proof_pickup' | 'en_route' | 'at_dropoff' | 'verify_pin' | 'completed';

const STEPS: { key: JobStep; label: string; icon: string }[] = [
  { key: 'heading_pickup', label: 'Head to pickup', icon: '🏁' },
  { key: 'at_pickup', label: 'Arrive at pickup', icon: '📍' },
  { key: 'proof_pickup', label: 'Upload proof', icon: '📸' },
  { key: 'en_route', label: 'En route to delivery', icon: '🚴' },
  { key: 'at_dropoff', label: 'Arrive at dropoff', icon: '📍' },
  { key: 'verify_pin', label: 'Verify PIN', icon: '🔑' },
  { key: 'completed', label: 'Completed', icon: '✅' },
];

export default function ActiveJobPage() {
  const [currentStep, setCurrentStep] = useState<JobStep>('heading_pickup');
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const correctPin = '4729';

  const job = {
    reference: 'BKR-N3V8P2',
    service: 'Send Item',
    pickup: 'Sam Levy\'s Village, Borrowdale',
    pickup_contact: 'Sarah M. · +263 77 123 4567',
    dropoff: 'Avondale Shops, 2nd Ave',
    dropoff_contact: 'Mike T. · +263 78 987 6543',
    dropoff_gate: 'Blue gate, 3rd house left',
    item: 'Small parcel — medications',
    payout: 3.50,
    protection: 'protected',
    customer_name: 'Sarah M.',
    distance: '4.2 km',
    eta: '12 min',
  };

  const advanceStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
      if (STEPS[nextIndex].key === 'completed') {
        setShowComplete(true);
      }
    }
  };

  const handlePinDigit = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...pinInput];
    newPin[index] = value;
    setPinInput(newPin);
    setPinError(false);

    // Auto-focus next
    if (value && index < 3) {
      const next = document.getElementById(`pin-${index + 1}`);
      next?.focus();
    }

    // Auto-verify when all 4 digits entered
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (fullPin === correctPin) {
        setTimeout(() => advanceStep(), 500);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinInput(['', '', '', '']);
          setPinError(false);
          document.getElementById('pin-0')?.focus();
        }, 1500);
      }
    }
  };

  return (
    <div className={styles.page}>
      {/* Completion Overlay */}
      {showComplete && (
        <div className={styles.completeOverlay}>
          <div className={styles.completeCard}>
            <div className={styles.completeIcon}>✅</div>
            <h2>Delivery Complete!</h2>
            <p>PIN verified. Funds will be released to your wallet.</p>
            <div className={styles.completePayout}>
              <span>Your payout</span>
              <strong>${job.payout.toFixed(2)}</strong>
            </div>
            <div className={styles.completeStats}>
              <div><span>Distance</span><strong>{job.distance}</strong></div>
              <div><span>Time</span><strong>18 min</strong></div>
              <div><span>Rating</span><strong>⭐ Pending</strong></div>
            </div>
            <button className="btn btn--primary btn--full" onClick={() => window.location.href = '/dashboard/jobs'}>
              Find next job
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Active Job</h1>
          <span className={styles.ref}>{job.reference} · {job.service}</span>
        </div>
        <div className={styles.payoutBadge}>
          ${job.payout.toFixed(2)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progress}>
        {STEPS.map((step, i) => (
          <div
            key={step.key}
            className={`${styles.progressStep} ${i < currentStepIndex ? styles.progressDone : ''} ${i === currentStepIndex ? styles.progressActive : ''}`}
          >
            <div className={styles.progressDot}>
              {i < currentStepIndex ? '✓' : step.icon}
            </div>
            {i < STEPS.length - 1 && <div className={styles.progressLine} />}
          </div>
        ))}
      </div>
      <div className={styles.progressLabel}>
        {STEPS[currentStepIndex]?.icon} {STEPS[currentStepIndex]?.label}
      </div>

      {/* Map Placeholder */}
      <div className={styles.mapArea}>
        <div className={styles.mapPlaceholder}>
          <div className={styles.mapContent}>
            <span>🗺️</span>
            <p>Live map · {job.eta} to {currentStepIndex < 3 ? 'pickup' : 'dropoff'}</p>
          </div>
        </div>
      </div>

      {/* Route Card */}
      <div className={styles.routeCard}>
        <div className={styles.routePoint}>
          <div className={styles.routeDot} data-type="pickup" />
          <div>
            <div className={styles.routeLabel}>Pickup</div>
            <div className={styles.routeAddress}>{job.pickup}</div>
            <div className={styles.routeContact}>👤 {job.pickup_contact}</div>
          </div>
        </div>
        <div className={styles.routeDivider}>
          <span className={styles.routeDistance}>{job.distance}</span>
        </div>
        <div className={styles.routePoint}>
          <div className={styles.routeDot} data-type="dropoff" />
          <div>
            <div className={styles.routeLabel}>Deliver to</div>
            <div className={styles.routeAddress}>{job.dropoff}</div>
            <div className={styles.routeContact}>👤 {job.dropoff_contact}</div>
            <div className={styles.routeNote}>🏠 {job.dropoff_gate}</div>
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className={styles.itemCard}>
        <span>📝</span>
        <div>
          <strong>{job.item}</strong>
          {job.protection !== 'none' && (
            <div className={styles.protectionBadge}>🛡️ Protected · Escrow held</div>
          )}
        </div>
      </div>

      {/* Step-Specific Actions */}
      <div className={styles.actionArea}>
        {/* Step: Heading to pickup */}
        {currentStep === 'heading_pickup' && (
          <div className={styles.actionCard}>
            <h3>Head to the pickup location</h3>
            <p>Navigate to {job.pickup}</p>
            <button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>
              I&apos;ve arrived at pickup
            </button>
          </div>
        )}

        {/* Step: At pickup */}
        {currentStep === 'at_pickup' && (
          <div className={styles.actionCard}>
            <h3>At pickup point</h3>
            <p>Contact {job.pickup_contact} to collect the item.</p>
            <div className={styles.actionButtons}>
              <button className="btn btn--secondary btn--full">📞 Call sender</button>
              <button className="btn btn--primary btn--full" onClick={advanceStep}>
                Item collected → Upload proof
              </button>
            </div>
          </div>
        )}

        {/* Step: Upload proof */}
        {currentStep === 'proof_pickup' && (
          <div className={styles.actionCard}>
            <h3>📸 Upload pickup proof</h3>
            <p>Take a photo of the item before leaving. This protects both you and the customer.</p>
            {!proofUploaded ? (
              <div className={styles.photoUpload}>
                <div className={styles.photoPlaceholder} onClick={() => setProofUploaded(true)}>
                  <span>📷</span>
                  <p>Tap to take photo</p>
                </div>
              </div>
            ) : (
              <div className={styles.photoSuccess}>
                <span>✅</span>
                <p>Proof uploaded successfully</p>
              </div>
            )}
            <button
              className="btn btn--primary btn--full btn--lg"
              onClick={advanceStep}
              disabled={!proofUploaded}
            >
              Continue to delivery
            </button>
          </div>
        )}

        {/* Step: En route */}
        {currentStep === 'en_route' && (
          <div className={styles.actionCard}>
            <h3>🚴 En route to delivery</h3>
            <p>Navigate to {job.dropoff}</p>
            <div className={styles.etaDisplay}>
              <span className={styles.etaLabel}>ETA</span>
              <span className={styles.etaValue}>{job.eta}</span>
            </div>
            <button className="btn btn--primary btn--full btn--lg" onClick={advanceStep}>
              I&apos;ve arrived at dropoff
            </button>
          </div>
        )}

        {/* Step: At dropoff */}
        {currentStep === 'at_dropoff' && (
          <div className={styles.actionCard}>
            <h3>At delivery point</h3>
            <p>Look for: <strong>{job.dropoff_gate}</strong></p>
            <div className={styles.actionButtons}>
              <button className="btn btn--secondary btn--full">📞 Call recipient</button>
              <button className="btn btn--primary btn--full" onClick={advanceStep}>
                Ready to deliver → Enter PIN
              </button>
            </div>
          </div>
        )}

        {/* Step: Verify PIN */}
        {currentStep === 'verify_pin' && (
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
            {pinError && (
              <p className={styles.pinErrorText}>❌ Incorrect PIN. Please try again.</p>
            )}
            <p className={styles.pinHint}>
              PIN protects both parties. Funds release only after verification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
