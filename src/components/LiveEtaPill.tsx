'use client';

import React from 'react';
import styles from './live-eta-pill.module.css';

interface LiveEtaPillProps {
  etaMinutes: number;
  distanceKm: number;
  statusText?: string;
  className?: string;
}

export default function LiveEtaPill({
  etaMinutes,
  distanceKm,
  statusText = 'Biker en route',
  className = '',
}: LiveEtaPillProps) {
  return (
    <div className={`${styles.pill} ${className}`}>
      <div className={styles.pulseIndicator}>
        <span className={styles.dot} />
        <span className={styles.ping} />
      </div>
      
      <div className={styles.content}>
        <span className={styles.status}>{statusText}</span>
        <span className={styles.divider}>•</span>
        <span className={styles.eta}>
          <strong>{etaMinutes} min</strong> ({distanceKm.toFixed(1)} km)
        </span>
      </div>
    </div>
  );
}
