'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './city-pulse.module.css';

/* ─── Types ──────────────────────────────────────── */

interface CityPulseProps {
  country?: 'ZW' | 'ZM';
  compact?: boolean;
}

type DotKind = 'rider' | 'delivery' | 'jet';

interface Dot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: DotKind;
  delay: number;
}

interface DensityZone {
  cx: number;
  cy: number;
  r: number;
  color: string;
}

/* ─── City configs ───────────────────────────────── */

const CITY_CONFIG = {
  ZW: {
    name: 'Harare',
    stats: { deliveries: 147, riders: 63, avgTime: 24 },
    zones: [
      { cx: 48, cy: 42, r: 22, color: 'rgba(59,130,246,0.08)' },
      { cx: 30, cy: 58, r: 16, color: 'rgba(34,197,94,0.07)' },
      { cx: 68, cy: 35, r: 18, color: 'rgba(245,158,11,0.06)' },
      { cx: 55, cy: 70, r: 14, color: 'rgba(59,130,246,0.05)' },
    ] as DensityZone[],
  },
  ZM: {
    name: 'Lusaka',
    stats: { deliveries: 112, riders: 48, avgTime: 28 },
    zones: [
      { cx: 50, cy: 45, r: 24, color: 'rgba(34,197,94,0.08)' },
      { cx: 35, cy: 30, r: 15, color: 'rgba(59,130,246,0.06)' },
      { cx: 65, cy: 60, r: 19, color: 'rgba(245,158,11,0.07)' },
      { cx: 25, cy: 65, r: 12, color: 'rgba(59,130,246,0.05)' },
    ] as DensityZone[],
  },
} as const;

/* ─── Helpers ────────────────────────────────────── */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function generateDots(count: number): Dot[] {
  const kinds: DotKind[] = [];
  const riderCount = Math.round(count * 0.36);
  const jetCount = Math.round(count * 0.2);
  const deliveryCount = count - riderCount - jetCount;

  for (let i = 0; i < riderCount; i++) kinds.push('rider');
  for (let i = 0; i < deliveryCount; i++) kinds.push('delivery');
  for (let i = 0; i < jetCount; i++) kinds.push('jet');

  // shuffle
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }

  return kinds.map((kind, i) => ({
    id: i,
    x: rand(8, 92),
    y: rand(8, 92),
    vx: rand(-0.15, 0.15),
    vy: rand(-0.15, 0.15),
    kind,
    delay: rand(0, 1.2),
  }));
}

function generateGridLines(): { x1: number; y1: number; x2: number; y2: number; major: boolean }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];

  // vertical lines
  for (let x = 8; x <= 92; x += 6) {
    lines.push({ x1: x, y1: 2, x2: x, y2: 98, major: x % 18 === 0 });
  }
  // horizontal lines
  for (let y = 8; y <= 92; y += 6) {
    lines.push({ x1: 2, y1: y, x2: 98, y2: y, major: y % 18 === 0 });
  }

  // some diagonal "avenues"
  lines.push({ x1: 10, y1: 10, x2: 90, y2: 90, major: true });
  lines.push({ x1: 90, y1: 15, x2: 15, y2: 85, major: true });

  return lines;
}

function generateRoads(): string[] {
  return [
    'M 10,50 Q 30,45 50,50 T 90,48',
    'M 50,8  Q 48,30 50,50 T 52,92',
    'M 15,25 Q 35,35 55,30 T 85,40',
    'M 20,75 Q 40,68 60,72 T 88,65',
    'M 12,40 Q 25,55 45,60 T 75,80',
  ];
}

/* ─── Animated Counter Hook ──────────────────────── */

function useAnimatedCounter(target: number, duration: number = 1800, startDelay: number = 600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    let timeout: ReturnType<typeof setTimeout>;

    timeout = setTimeout(() => {
      const animate = (ts: number) => {
        if (!start) start = ts;
        const elapsed = ts - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) {
          raf = requestAnimationFrame(animate);
        }
      };
      raf = requestAnimationFrame(animate);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, startDelay]);

  return value;
}

/* ─── Dot Class Map ──────────────────────────────── */

const DOT_STYLE: Record<DotKind, string> = {
  rider: styles.dotRider,
  delivery: styles.dotDelivery,
  jet: styles.dotJet,
};

const RIPPLE_STYLE: Record<DotKind, string> = {
  rider: styles.rippleRider,
  delivery: styles.rippleDelivery,
  jet: styles.rippleJet,
};

/* ─── Component ──────────────────────────────────── */

export default function CityPulse({ country = 'ZW', compact = false }: CityPulseProps) {
  const config = CITY_CONFIG[country];
  const dotCount = compact ? 15 : 22;

  /* dots state */
  const [dots, setDots] = useState<Dot[]>(() => generateDots(dotCount));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* memoised static geometry */
  const gridLines = useMemo(generateGridLines, []);
  const roads = useMemo(generateRoads, []);

  /* animate counters */
  const animDeliveries = useAnimatedCounter(config.stats.deliveries, 2000, 1200);
  const animRiders = useAnimatedCounter(config.stats.riders, 2000, 1400);
  const animTime = useAnimatedCounter(config.stats.avgTime, 1600, 1600);

  /* drift movement */
  const moveDots = useCallback(() => {
    setDots((prev) =>
      prev.map((d) => {
        let { x, y, vx, vy } = d;

        // small random acceleration
        vx += rand(-0.04, 0.04);
        vy += rand(-0.04, 0.04);

        // dampen
        vx *= 0.92;
        vy *= 0.92;

        // clamp velocity
        vx = clamp(vx, -0.25, 0.25);
        vy = clamp(vy, -0.25, 0.25);

        x = clamp(x + vx, 5, 95);
        y = clamp(y + vy, 5, 95);

        // bounce off edges
        if (x <= 5 || x >= 95) vx *= -1;
        if (y <= 5 || y >= 95) vy *= -1;

        return { ...d, x, y, vx, vy };
      }),
    );
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(moveDots, 120);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [moveDots]);

  /* re-generate dots when country or dotCount changes */
  useEffect(() => {
    setDots(generateDots(dotCount));
  }, [country, dotCount]);

  /* ── Render ──────────────────────────────────── */

  const containerClass = [styles.container, compact ? styles.compact : ''].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {/* Title watermark */}
      <span className={styles.title}>City Pulse — {config.name}</span>

      {/* ── SVG Map ─────────────────────────────── */}
      <svg
        className={styles.svgMap}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* grid lines (streets) */}
        {gridLines.map((l, i) => (
          <line
            key={`grid-${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            className={l.major ? styles.gridLineMajor : styles.gridLine}
          />
        ))}

        {/* road paths */}
        {roads.map((d, i) => (
          <path key={`road-${i}`} d={d} className={styles.roadPath} />
        ))}

        {/* density zones */}
        {config.zones.map((z, i) => (
          <circle
            key={`zone-${i}`}
            cx={z.cx}
            cy={z.cy}
            r={z.r}
            fill={z.color}
            className={styles.densityZone}
          />
        ))}

        {/* ripple rings (rendered before dots so dots sit on top) */}
        {dots.map((d) => (
          <circle
            key={`ripple-${d.id}`}
            cx={d.x}
            cy={d.y}
            r={4}
            className={`${styles.ripple} ${RIPPLE_STYLE[d.kind]}`}
            style={{ animationDelay: `${d.delay}s` }}
          />
        ))}

        {/* dots */}
        {dots.map((d) => (
          <circle
            key={`dot-${d.id}`}
            cx={d.x}
            cy={d.y}
            className={`${styles.dot} ${DOT_STYLE[d.kind]}`}
            style={{ animationDelay: `${d.delay}s` }}
          />
        ))}
      </svg>

      {/* ── Legend (hidden in compact) ──────────── */}
      {!compact && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotRider}`} />
            Available Riders
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotDelivery}`} />
            Active Deliveries
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotJet}`} />
            Jet (Priority)
          </div>
        </div>
      )}

      {/* ── Stats Overlay (hidden in compact) ──── */}
      {!compact && (
        <div className={styles.statsOverlay}>
          <div className={styles.cityBadge}>
            <span className={styles.cityDot} />
            <span className={styles.cityName}>{config.name} — Live</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statValue}>{animDeliveries}</span>
            <span className={styles.statLabel}>Active Deliveries</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statValue}>{animRiders}</span>
            <span className={styles.statLabel}>Online Riders</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {animTime}
              <span className={styles.statUnit}> min</span>
            </span>
            <span className={styles.statLabel}>Avg Delivery Time</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statValue}>{config.name}</span>
            <span className={styles.statLabel}>City</span>
          </div>
        </div>
      )}
    </div>
  );
}
