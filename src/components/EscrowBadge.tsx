'use client';

import React, { useState, useEffect } from 'react';
import styles from './escrow-badge.module.css';

import { Clock, Shield, ShieldCheck, Scale } from 'lucide-react';

interface EscrowBadgeProps {
  status: 'pending' | 'held' | 'released' | 'disputed';
  amount?: number;
  paymentMethod?: string;
  className?: string;
}

export default function EscrowBadge({
  status,
  amount,
  paymentMethod = 'EcoCash',
  className = '',
}: EscrowBadgeProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const t = setTimeout(() => setAnimate(false), 800);
    return () => clearTimeout(t);
  }, [status]);

  const getStatusDetails = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Awaiting Payment',
          description: 'Payment authorization required to dispatch',
          color: 'var(--color-warning-500)',
          badgeClass: styles.pending,
          icon: <Clock size={20} className={styles.lockIcon} />,
        };
      case 'held':
        return {
          label: 'Funds Held Safely',
          description: `${paymentMethod} Escrow Active • PIN Required`,
          color: 'var(--color-primary-500)',
          badgeClass: styles.held,
          icon: <Shield size={20} className={styles.lockIcon} />,
        };
      case 'released':
        return {
          label: 'Funds Released',
          description: 'Payment released to Biker wallet',
          color: 'var(--color-success-500)',
          badgeClass: styles.released,
          icon: <ShieldCheck size={20} className={styles.lockIcon} />,
        };
      case 'disputed':
        return {
          label: 'Payment Locked (Dispute)',
          description: 'Under review by Ops Resolution Desk',
          color: 'var(--color-danger-500)',
          badgeClass: styles.disputed,
          icon: <Scale size={20} className={styles.lockIcon} />,
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className={`${styles.badgeWrapper} ${details.badgeClass} ${className}`}>
      <div className={styles.topSection}>
        {/* Animated Lock/Shield Icon */}
        <div className={`${styles.iconContainer} ${animate ? styles.pulse : ''}`}>
          {details.icon}
        </div>

        <div className={styles.content}>
          <div className={styles.labelContainer}>
            <span className={styles.labelText}>{details.label}</span>
            {amount !== undefined && (
              <span className={styles.amountText}>
                {amount > 0 ? `$${amount.toFixed(2)}` : 'COD'}
              </span>
            )}
          </div>
          <p className={styles.descriptionText}>{details.description}</p>
        </div>
      </div>

      {status === 'held' && (
        <div className={styles.footerBanner}>
          <span className={styles.shieldPulse} />
          Biker Protect Active • Security Guarantee Enabled
        </div>
      )}
    </div>
  );
}
