'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './surge-meter.module.css';
import { Smile, Flame, Zap, TrendingUp } from 'lucide-react';

type DemandZone = 'chill' | 'busy' | 'surge' | 'frenzy';

interface SurgeMeterProps {
  /** Override the demand level (0-100). If omitted, auto-calculates based on time of day. */
  demandLevel?: number;
  /** Whether to show in a compact inline mode */
  compact?: boolean;
  /** Current number of active orders nearby (used in auto-calc) */
  activeOrderCount?: number;
  /** Country for contextual messaging */
  country?: 'ZW' | 'ZM';
}

const ZONE_CONFIG: Record<DemandZone, {
  icon: React.ReactNode;
  label: string;
  description: string;
  multiplierRange: [number, number];
}> = {
  chill: {
    icon: <Smile size={18} style={{ color: 'var(--text-secondary)' }} />,
    label: 'Chill Zone',
    description: 'Low demand — great prices for customers',
    multiplierRange: [1.0, 1.0],
  },
  busy: {
    icon: <Flame size={18} style={{ color: '#f59e0b' }} />,
    label: 'Getting Busy',
    description: 'Moderate demand — riders earning more',
    multiplierRange: [1.0, 1.2],
  },
  surge: {
    icon: <Zap size={18} style={{ color: '#fbbf24' }} />,
    label: 'Surge Active',
    description: 'High demand — priority dispatch enabled',
    multiplierRange: [1.2, 1.5],
  },
  frenzy: {
    icon: <TrendingUp size={18} style={{ color: '#ef4444' }} />,
    label: 'FRENZY',
    description: 'Peak demand — maximum rider payouts',
    multiplierRange: [1.5, 2.0],
  },
};

function getDemandFromTimeOfDay(): number {
  const hour = new Date().getHours();
  // Morning rush 7-9, lunch 12-14, evening 17-20
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) return 65 + Math.random() * 25;
  if (hour >= 12 && hour <= 14) return 50 + Math.random() * 20;
  if (hour >= 22 || hour <= 5) return 5 + Math.random() * 15;
  return 20 + Math.random() * 30;
}

function getZone(level: number): DemandZone {
  if (level >= 85) return 'frenzy';
  if (level >= 60) return 'surge';
  if (level >= 30) return 'busy';
  return 'chill';
}

export default function SurgeMeter({
  demandLevel,
  compact = false,
  activeOrderCount = 0,
  country = 'ZW',
}: SurgeMeterProps) {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);

  // Calculate demand level
  useEffect(() => {
    let level: number;
    if (demandLevel !== undefined) {
      level = Math.max(0, Math.min(100, demandLevel));
    } else {
      level = getDemandFromTimeOfDay();
      // Boost by active order count
      level = Math.min(100, level + activeOrderCount * 3);
    }
    setCurrentLevel(level);
  }, [demandLevel, activeOrderCount]);

  // Animate the gauge
  useEffect(() => {
    const start = animatedLevel;
    const end = currentLevel;
    const duration = 1200;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedLevel(start + (end - start) * eased);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [currentLevel]);

  const zone = getZone(animatedLevel);
  const config = ZONE_CONFIG[zone];

  // Calculate multiplier within zone range
  const multiplier = useMemo(() => {
    const [min, max] = config.multiplierRange;
    const zoneProgress = zone === 'chill' ? 0 : zone === 'busy' ? (animatedLevel - 30) / 30 : zone === 'surge' ? (animatedLevel - 60) / 25 : (animatedLevel - 85) / 15;
    return min + (max - min) * Math.max(0, Math.min(1, zoneProgress));
  }, [animatedLevel, zone, config.multiplierRange]);

  // SVG gauge calculations
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (animatedLevel / 100) * circumference;

  // Periodic jitter for frenzy mode
  useEffect(() => {
    if (zone !== 'frenzy') return;
    const interval = setInterval(() => {
      setCurrentLevel(prev => {
        const jitter = (Math.random() - 0.5) * 6;
        return Math.max(85, Math.min(100, prev + jitter));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [zone]);

  const containerClass = [
    styles.container,
    styles[`container${zone.charAt(0).toUpperCase() + zone.slice(1)}`],
    compact ? styles.containerCompact : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {/* Animated Gauge Ring */}
      <div className={`${styles.gauge} ${compact ? styles.gaugeCompact : ''}`}>
        <svg className={styles.gaugeSvg} viewBox="0 0 52 52">
          <circle className={styles.gaugeTrack} cx="26" cy="26" r={radius} />
          <circle
            className={`${styles.gaugeArc} ${styles[`gaugeArc${zone.charAt(0).toUpperCase() + zone.slice(1)}`]}`}
            cx="26"
            cy="26"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className={`${styles.gaugeIcon} ${zone === 'frenzy' ? styles.gaugeIconFrenzy : ''}`}>
          {config.icon}
        </span>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <span className={`${styles.zoneLabel} ${styles[`zoneLabel${zone.charAt(0).toUpperCase() + zone.slice(1)}`]}`}>
          {config.label}
        </span>
        <span className={styles.zoneDescription}>
          {config.description}
        </span>
      </div>

      {/* Multiplier Badge */}
      <div className={styles.multiplier}>
        <span className={`${styles.multiplierValue} ${styles[`multiplierValue${zone.charAt(0).toUpperCase() + zone.slice(1)}`]}`}>
          {multiplier.toFixed(1)}×
        </span>
        <span className={styles.multiplierLabel}>
          {zone === 'chill' ? 'base' : 'surge'}
        </span>
      </div>
    </div>
  );
}
