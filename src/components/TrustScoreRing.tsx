'use client';

import React from 'react';
import styles from './trust-score-ring.module.css';

interface TrustScoreRingProps {
  score: number;
  tier: 'starter' | 'verified' | 'pro' | 'elite';
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

export default function TrustScoreRing({
  score,
  tier,
  size = 80,
  strokeWidth = 6,
  showText = true,
}: TrustScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getTierDetails = () => {
    switch (tier) {
      case 'starter':
        return {
          color: '#f59e0b', // Amber/Orange
          label: 'Starter',
          bg: 'rgba(245, 158, 11, 0.1)',
        };
      case 'verified':
        return {
          color: '#3b82f6', // Blue
          label: 'Verified',
          bg: 'rgba(3b, 82, 246, 0.1)',
        };
      case 'pro':
        return {
          color: '#10b981', // Green
          label: 'Pro',
          bg: 'rgba(16, 185, 129, 0.1)',
        };
      case 'elite':
        return {
          color: 'var(--color-primary-500)', // Electric Lime
          label: 'Elite',
          bg: 'hsla(72, 100%, 50%, 0.15)',
        };
    }
  };

  const details = getTierDetails();

  return (
    <div className={styles.container} style={{ width: size, height: size }}>
      <svg width={size} height={size} className={styles.svg}>
        {/* Background track circle */}
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Foreground colored ring representing trust score */}
        <circle
          className={styles.progressCircle}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={details.color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>

      {/* Floating text inside circle */}
      {showText && (
        <div className={styles.innerContent}>
          <span className={styles.scoreText} style={{ color: details.color }}>
            {score}%
          </span>
          <span className={styles.labelSubText}>{details.label}</span>
        </div>
      )}
    </div>
  );
}
