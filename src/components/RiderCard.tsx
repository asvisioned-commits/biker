'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './rider-card.module.css';

/* ================================================================
   TYPES
   ================================================================ */

import { Award, Trophy, Flame } from 'lucide-react';

/* ================================================================
   TYPES
   ================================================================ */

interface RiderCardProps {
  riderId?: string;
  name: string;
  tier: 'starter' | 'pro' | 'elite';
  trustScore: number; // 0-100
  rating: number; // 0-5
  totalDeliveries: number;
  perfectStreak: number; // consecutive 5-star deliveries
  joinDate: string; // ISO date string
  isOnline?: boolean;
}

/* ================================================================
   HELPERS
   ================================================================ */

/** Simple string hash → deterministic hue values for the procedural background. */
function hashToHues(input: string): [number, number, number] {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  const hue1 = ((h >>> 0) % 360);
  const hue2 = (hue1 + 45 + ((h >>> 8) % 40)) % 360;
  const hue3 = (hue2 + 45 + ((h >>> 16) % 40)) % 360;
  return [hue1, hue2, hue3];
}

/** Format an ISO date string to a readable "Month YYYY" form. */
function formatMemberSince(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ================================================================
   TIER DISPLAY CONFIG
   ================================================================ */

const TIER_CONFIG: Record<RiderCardProps['tier'], { label: string; icon: React.ReactNode }> = {
  starter: { label: 'Starter', icon: <Award size={14} style={{ color: '#b45309', marginRight: '4px' }} /> },
  pro: { label: 'Pro', icon: <Award size={14} style={{ color: '#6b7280', marginRight: '4px' }} /> },
  elite: { label: 'Elite', icon: <Trophy size={14} style={{ color: '#fbbf24', marginRight: '4px' }} /> },
};

/* ================================================================
   COMPONENT
   ================================================================ */

export default function RiderCard({
  riderId = 'rider-default',
  name,
  tier,
  trustScore,
  rating,
  totalDeliveries,
  perfectStreak,
  joinDate,
  isOnline = false,
}: RiderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  /* ---------- Procedural background gradient ---------- */
  const [h1, h2, h3] = hashToHues(riderId);
  const bgGradient = `linear-gradient(135deg,
    hsl(${h1}, 70%, 22%) 0%,
    hsl(${h2}, 65%, 18%) 50%,
    hsl(${h3}, 60%, 14%) 100%)`;

  /* ---------- Mouse / Touch tracking ---------- */
  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const el = cardRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);

      // Tilt: max ±15deg, centered at 0.5
      const rotateY = (x - 0.5) * 30; // -15 to +15
      const rotateX = (0.5 - y) * 30; // -15 to +15

      setTiltStyle({
        '--mouse-x': x,
        '--mouse-y': y,
        transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
        transition: 'transform 80ms linear',
      } as React.CSSProperties);
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => updatePosition(e.clientX, e.clientY),
    [updatePosition],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (t) updatePosition(t.clientX, t.clientY);
    },
    [updatePosition],
  );

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({
      '--mouse-x': 0.5,
      '--mouse-y': 0.5,
      transform: 'rotateY(0deg) rotateX(0deg)',
      transition: `transform var(--duration-slow) var(--ease-out)`,
    } as React.CSSProperties);
  }, []);

  /* ---------- Trust ring SVG calculations ---------- */
  const clamped = clamp(trustScore, 0, 100);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  // Trust ring stroke colour: red → amber → green
  const trustHue = (clamped / 100) * 120; // 0 = red, 120 = green
  const trustColor = `hsl(${trustHue}, 80%, 55%)`;

  /* ---------- Star rating ---------- */
  const fullStars = Math.floor(clamp(rating, 0, 5));
  const remainder = rating - fullStars;
  const emptyStars = 5 - fullStars - (remainder > 0 ? 1 : 0);

  /* ---------- Tier config ---------- */
  const { label: tierLabel, icon: tierIcon } = TIER_CONFIG[tier];

  return (
    <div
      className={styles.card}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseLeave}
      ref={cardRef}
    >
      {/* --- Card surface with tilt --- */}
      <div className={styles.cardInner} style={tiltStyle}>
        {/* Procedural background */}
        <div className={styles.cardBackground} style={{ background: bgGradient }} />

        {/* Holographic rainbow */}
        <div className={styles.holoOverlay} />

        {/* Sparkle texture */}
        <div className={styles.sparkleOverlay} />

        {/* Spotlight shine */}
        <div className={styles.shineOverlay} />

        {/* ---- Content ---- */}
        <div className={styles.cardContent}>
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.tierBadge} data-tier={tier}>
              <span>{tierIcon}</span>
              <span>{tierLabel}</span>
            </div>

            <div className={styles.statusWrapper}>
              <div
                className={[
                  styles.onlineDot,
                  isOnline ? styles.onlineDotPulsing : styles.offlineDot,
                ].join(' ')}
              />
              <span className={styles.statusLabel}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Rider Identity */}
          <div className={styles.riderIdentity}>
            <div className={styles.riderAvatar}>
              {name.charAt(0)}
            </div>
            <div className={styles.riderName}>{name}</div>
            <div className={styles.riderId}>#{riderId}</div>
          </div>

          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            {/* Trust Score (wide) */}
            <div className={`${styles.statItem} ${styles.statItemWide}`}>
              <div className={styles.trustRingWrapper}>
                <svg
                  className={styles.trustRing}
                  width="60"
                  height="60"
                  viewBox="0 0 60 60"
                >
                  <circle
                    className={styles.trustRingBg}
                    cx="30"
                    cy="30"
                    r={radius}
                  />
                  <circle
                    className={styles.trustRingProgress}
                    cx="30"
                    cy="30"
                    r={radius}
                    stroke={trustColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className={styles.trustRingInfo}>
                  <span className={styles.trustRingValue}>{clamped}</span>
                  <span className={styles.trustRingLabel}>Trust Score</span>
                </div>
              </div>
            </div>

            {/* Rating */}
            <div className={styles.statItem}>
              <div className={styles.starsWrapper}>
                {Array.from({ length: fullStars }).map((_, i) => (
                  <span key={`f-${i}`} className={`${styles.star} ${styles.starFilled}`}>
                    ★
                  </span>
                ))}
                {remainder > 0 && (
                  <span className={`${styles.star} ${styles.starFilled}`} style={{ opacity: 0.55 }}>
                    ★
                  </span>
                )}
                {Array.from({ length: emptyStars }).map((_, i) => (
                  <span key={`e-${i}`} className={`${styles.star} ${styles.starEmpty}`}>
                    ★
                  </span>
                ))}
                <span className={styles.ratingValue}>{rating.toFixed(1)}</span>
              </div>
              <span className={styles.statLabel}>Rating</span>
            </div>

            {/* Total Deliveries */}
            <div className={styles.statItem}>
              <span className={styles.statValue}>
                {totalDeliveries.toLocaleString()}
              </span>
              <span className={styles.statLabel}>Deliveries</span>
            </div>

            {/* Perfect Streak */}
            <div className={styles.statItem}>
              <span className={styles.streakValue} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {perfectStreak}
                <Flame size={14} style={{ color: '#ef4444', fill: '#ef4444' }} />
              </span>
              <span className={styles.statLabel}>Perfect Streak</span>
            </div>

            {/* Member Since */}
            <div className={styles.statItem}>
              <span className={styles.memberDate}>
                {formatMemberSince(joinDate)}
              </span>
              <span className={styles.statLabel}>Member Since</span>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.cardFooter}>
            <span className={styles.cardFooterText}>
              Biker Reputation Card™
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
