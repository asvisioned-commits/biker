'use client';

import React, { useState } from 'react';
import styles from './qr-pin-modal.module.css';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface QrPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  pin: string;
  onVerifyPin: (enteredPin: string) => Promise<boolean>;
  referenceCode: string;
}

export default function QrPinModal({
  isOpen,
  onClose,
  pin,
  onVerifyPin,
  referenceCode,
}: QrPinModalProps) {
  const [activeTab, setActiveTab] = useState<'pin' | 'qr'>('pin');
  const [enteredPin, setEnteredPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [hapticTrigger, setHapticTrigger] = useState(false);

  if (!isOpen) return null;

  const handleNumClick = (num: number) => {
    if (enteredPin.length < 4) {
      setEnteredPin(prev => prev + num);
      setErrorMessage('');
    }
  };

  const handleBackspace = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Vibrate double pulse
    }
    setHapticTrigger(true);
    setTimeout(() => setHapticTrigger(false), 500);
  };

  const handleVerify = async () => {
    if (enteredPin.length < 4) return;
    setIsVerifying(true);
    setErrorMessage('');

    try {
      const isOk = await onVerifyPin(enteredPin);
      if (isOk) {
        setSuccess(true);
        triggerHaptic();
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setEnteredPin('');
        }, 1500);
      } else {
        setErrorMessage('Incorrect PIN. Please re-check with recipient.');
        setEnteredPin('');
        // Single long vibration on failure
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(300);
        }
      }
    } catch (e) {
      setErrorMessage('Failed to verify PIN. Network error.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Confirm Delivery</h3>
            <span className={styles.ref}>{referenceCode}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <PremiumIcon name="X" variant="neutral" size={16} />
          </button>
        </div>

        {success ? (
          <div className={`${styles.successState} ${hapticTrigger ? styles.jiggle : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className={styles.successIcon} style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
              <PremiumIcon name="ShieldCheck" variant="protect" size={48} glow animate="bounce" />
            </span>
            <h4 className={styles.successTitle}>Escrow Released!</h4>
            <p className={styles.successSub}>Ledger settlement finalized successfully.</p>
          </div>
        ) : (
          <div className={styles.body}>
            {/* Tab switchers */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'pin' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('pin')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}
              >
                <PremiumIcon name="Lock" variant={activeTab === 'pin' ? 'primary' : 'neutral'} size={14} />
                <span>PIN Code</span>
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'qr' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('qr')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}
              >
                <PremiumIcon name="QrCode" variant={activeTab === 'qr' ? 'primary' : 'neutral'} size={14} />
                <span>Scan QR</span>
              </button>
            </div>

            {activeTab === 'pin' ? (
              <div className={styles.pinContent}>
                <p className={styles.instruct}>
                  Ask the recipient for the 4-digit security PIN sent to their phone to release the escrow payment.
                </p>

                {/* Display dots */}
                <div className={styles.pinDots}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`${styles.dot} ${
                        enteredPin.length > idx ? styles.dotFilled : ''
                      } ${errorMessage ? styles.dotError : ''}`}
                    />
                  ))}
                </div>

                {errorMessage && <span className={styles.errorText}>{errorMessage}</span>}

                {/* Simulated keypad */}
                <div className={styles.keypad}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={styles.key}
                      onClick={() => handleNumClick(num)}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.key} ${styles.dangerKey}`}
                    onClick={() => setEnteredPin('')}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className={styles.key}
                    onClick={() => handleNumClick(0)}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className={`${styles.key} ${styles.backKey}`}
                    onClick={handleBackspace}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <PremiumIcon name="Delete" variant="neutral" size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn--primary btn--full"
                  disabled={enteredPin.length < 4 || isVerifying}
                  onClick={handleVerify}
                  style={{ marginTop: '20px' }}
                >
                  {isVerifying ? 'Settling Escrow Ledger...' : 'Confirm & Release Escrow'}
                </button>
              </div>
            ) : (
              <div className={styles.qrContent}>
                <p className={styles.instruct}>
                  Align the recipient&apos;s delivery QR code inside the green scanner frame.
                </p>

                {/* Scanner Sim */}
                <div className={styles.scannerWrapper}>
                  <div className={styles.scannerBox}>
                    <div className={styles.scannerOverlay}>
                      <div className={styles.laserLine} />
                    </div>
                    {/* Corner frames */}
                    <div className={`${styles.corner} ${styles.topLeft}`} />
                    <div className={`${styles.corner} ${styles.topRight}`} />
                    <div className={`${styles.corner} ${styles.bottomLeft}`} />
                    <div className={`${styles.corner} ${styles.bottomRight}`} />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--secondary btn--full"
                  onClick={async () => {
                    // Simulate QR Match with correct PIN
                    setEnteredPin(pin);
                    setActiveTab('pin');
                    addDelayedVerify(pin);
                  }}
                  style={{ marginTop: '20px' }}
                >
                  [Simulate QR Scan Match]
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function addDelayedVerify(p: string) {
    setTimeout(async () => {
      setIsVerifying(true);
      const isOk = await onVerifyPin(p);
      if (isOk) {
        setSuccess(true);
        triggerHaptic();
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setEnteredPin('');
        }, 1500);
      }
      setIsVerifying(false);
    }, 500);
  }
}
