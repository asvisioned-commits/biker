'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import styles from './proof-chain.module.css';
import PremiumIcon from '@/components/primitives/PremiumIcon';

// ============================================================
// Types
// ============================================================

export interface ProofEvent {
  id: string;
  type:
    | 'order_placed'
    | 'payment_held'
    | 'rider_assigned'
    | 'pickup_photo'
    | 'in_transit'
    | 'checkpoint'
    | 'delivery_photo'
    | 'pin_verified'
    | 'completed';
  timestamp: string; // ISO date
  label: string;
  description?: string;
  photoUrl?: string;
  location?: string;
  verifiedBy?: string;
}

interface ProofChainTimelineProps {
  events: ProofEvent[];
  orderId?: string;
}

// ============================================================
// Constants
// ============================================================

const EVENT_TYPE_ICONS: Record<ProofEvent['type'], { name: string; variant: string; animate?: string; glow?: boolean }> = {
  order_placed: { name: 'ClipboardList', variant: 'neutral' },
  payment_held: { name: 'ShieldCheck', variant: 'protect', glow: true },
  rider_assigned: { name: 'Bike', variant: 'info' },
  pickup_photo: { name: 'Camera', variant: 'primary' },
  in_transit: { name: 'Compass', variant: 'primary', animate: 'spin-slow' },
  checkpoint: { name: 'MapPin', variant: 'success' },
  delivery_photo: { name: 'Camera', variant: 'success' },
  pin_verified: { name: 'Check', variant: 'success' },
  completed: { name: 'Trophy', variant: 'warning', glow: true },
};

const PHOTO_EVENT_TYPES: ReadonlySet<ProofEvent['type']> = new Set([
  'pickup_photo',
  'delivery_photo',
  'checkpoint',
]);

// ============================================================
// Helpers
// ============================================================

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();

  if (diffMs < 0) return 'upcoming';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isEventCompleted(event: ProofEvent): boolean {
  return new Date(event.timestamp).getTime() <= Date.now();
}

// ============================================================
// Mock Data
// ============================================================

const NOW = Date.now();

export const MOCK_PROOF_EVENTS: ProofEvent[] = [
  {
    id: 'evt-001',
    type: 'order_placed',
    timestamp: new Date(NOW - 47 * 60 * 1000).toISOString(),
    label: 'Order Placed',
    description:
      'Package registered: Electronics — 2.3kg. Sender: Tinashe M., Avondale, Harare.',
    location: 'Avondale, Harare',
    verifiedBy: 'System',
  },
  {
    id: 'evt-002',
    type: 'payment_held',
    timestamp: new Date(NOW - 45 * 60 * 1000).toISOString(),
    label: 'Payment Secured',
    description:
      '$8.50 held in escrow. Funds will be released to rider upon verified delivery.',
    verifiedBy: 'Biker Escrow',
  },
  {
    id: 'evt-003',
    type: 'rider_assigned',
    timestamp: new Date(NOW - 38 * 60 * 1000).toISOString(),
    label: 'Rider Assigned',
    description:
      'Takudzwa M. (4.9★, 312 deliveries) accepted the job. ETA 12 mins to pickup.',
    location: 'Westgate, Harare',
    verifiedBy: 'GPS Match',
  },
  {
    id: 'evt-004',
    type: 'pickup_photo',
    timestamp: new Date(NOW - 25 * 60 * 1000).toISOString(),
    label: 'Pickup Verified',
    description:
      'Photo proof captured at pickup. Package condition: intact, sealed box.',
    location: 'Avondale Shopping Centre',
    verifiedBy: 'Photo AI + Rider',
  },
  {
    id: 'evt-005',
    type: 'in_transit',
    timestamp: new Date(NOW - 18 * 60 * 1000).toISOString(),
    label: 'In Transit',
    description:
      'Rider en route to destination. Live GPS tracking active. Speed: 34 km/h.',
    location: 'Samora Machel Ave',
    verifiedBy: 'GPS',
  },
  {
    id: 'evt-006',
    type: 'checkpoint',
    timestamp: new Date(NOW - 8 * 60 * 1000).toISOString(),
    label: 'Checkpoint Passed',
    description:
      'Rider passed through designated checkpoint. Package integrity confirmed.',
    location: 'Eastgate Mall area',
    verifiedBy: 'Geofence',
  },
  {
    id: 'evt-007',
    type: 'delivery_photo',
    timestamp: new Date(NOW + 5 * 60 * 1000).toISOString(),
    label: 'Delivery Photo',
    description: 'Awaiting photo proof at drop-off location.',
    location: 'Msasa, Harare',
  },
  {
    id: 'evt-008',
    type: 'pin_verified',
    timestamp: new Date(NOW + 8 * 60 * 1000).toISOString(),
    label: 'PIN Verified',
    description: 'Recipient will confirm delivery with a 4-digit PIN.',
  },
];

// ============================================================
// Component
// ============================================================

export default function ProofChainTimeline({
  events,
  orderId,
}: ProofChainTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sort events chronologically
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [events]
  );

  // Find the active event index (most recent completed)
  const activeIndex = useMemo(() => {
    let lastCompleted = -1;
    for (let i = 0; i < sortedEvents.length; i++) {
      if (isEventCompleted(sortedEvents[i])) {
        lastCompleted = i;
      }
    }
    return lastCompleted;
  }, [sortedEvents]);

  // Progress percentage
  const completedCount = sortedEvents.filter(isEventCompleted).length;
  const progressPercent =
    sortedEvents.length > 1
      ? (completedCount / sortedEvents.length) * 100
      : completedCount > 0
        ? 100
        : 0;

  // ---- Scroll state tracking ----
  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons]);

  // Auto-scroll to active event on mount
  useEffect(() => {
    if (activeIndex < 0 || !scrollRef.current) return;
    const cards = scrollRef.current.querySelectorAll('[data-event-card]');
    const activeCard = cards[activeIndex] as HTMLElement | undefined;
    if (activeCard) {
      const containerRect = scrollRef.current.getBoundingClientRect();
      const cardRect = activeCard.getBoundingClientRect();
      const scrollTarget =
        activeCard.offsetLeft -
        containerRect.width / 2 +
        cardRect.width / 2;
      scrollRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [activeIndex]);

  // ---- Scroll handlers ----
  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  // ---- Toggle expand ----
  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ---- Render helpers ----
  const renderPhoto = (event: ProofEvent) => {
    if (event.photoUrl) {
      return (
        <div className={styles.photoImage}>
          <img src={event.photoUrl} alt={`${event.label} evidence`} />
        </div>
      );
    }

    if (PHOTO_EVENT_TYPES.has(event.type)) {
      const isCompleted = isEventCompleted(event);
      return (
        <div className={styles.photoPlaceholder}>
          <span className={styles.photoPlaceholderIcon} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {isCompleted ? (
              <PremiumIcon name="Camera" variant="primary" size={24} />
            ) : (
              <PremiumIcon name="Clock" variant="neutral" size={24} />
            )}
          </span>
          <span className={styles.photoPlaceholderText}>
            {isCompleted
              ? 'Photo evidence captured'
              : 'Photo evidence will appear here'}
          </span>
        </div>
      );
    }

    return null;
  };

  const getCardClassName = (event: ProofEvent, index: number): string => {
    const classes = [styles.eventCard];
    const completed = isEventCompleted(event);

    if (index === activeIndex) {
      classes.push(styles.eventCardActive);
    }

    if (!completed) {
      classes.push(styles.eventCardPending);
    }

    if (expandedId === event.id) {
      classes.push(styles.eventCardExpanded);
    }

    return classes.join(' ');
  };

  const getDotClassName = (event: ProofEvent, index: number): string => {
    const classes = [styles.dotConnector];
    const completed = isEventCompleted(event);

    if (index === activeIndex) {
      classes.push(styles.dotConnectorActive);
    } else if (completed) {
      classes.push(styles.dotConnectorCompleted);
    } else {
      classes.push(styles.dotConnectorPending);
    }

    return classes.join(' ');
  };

  if (sortedEvents.length === 0) return null;

  return (
    <div className={styles.timeline}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Proof Chain</span>
        {orderId && <span className={styles.orderId}>{orderId}</span>}
      </div>

      {/* Scroll wrapper with arrows */}
      <div className={styles.scrollWrapper}>
        {/* Left scroll arrow */}
        <button
          className={`${styles.scrollArrow} ${styles.scrollArrowLeft} ${
            !canScrollLeft ? styles.scrollArrowHidden : ''
          }`}
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          tabIndex={canScrollLeft ? 0 : -1}
        >
          <span className={`${styles.chevron} ${styles.chevronLeft}`} />
        </button>

        {/* Right scroll arrow */}
        <button
          className={`${styles.scrollArrow} ${styles.scrollArrowRight} ${
            !canScrollRight ? styles.scrollArrowHidden : ''
          }`}
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          tabIndex={canScrollRight ? 0 : -1}
        >
          <span className={`${styles.chevron} ${styles.chevronRight}`} />
        </button>

        {/* Scrollable container */}
        <div className={styles.scrollContainer} ref={scrollRef}>
          <div className={styles.track}>
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                data-event-card
                className={getCardClassName(event, index)}
                onClick={() => toggleExpand(event.id)}
                role="button"
                tabIndex={0}
                aria-expanded={expandedId === event.id}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(event.id);
                  }
                }}
              >
                {/* Dot above card */}
                <div className={getDotClassName(event, index)} />

                {/* Card header: icon + label + time */}
                <div className={styles.cardHeader}>
                  <div className={styles.iconBubble} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const iconData = EVENT_TYPE_ICONS[event.type];
                      return (
                        <PremiumIcon
                          name={iconData.name as any}
                          variant={iconData.variant as any}
                          animate={iconData.animate as any}
                          glow={iconData.glow}
                          size={16}
                        />
                      );
                    })()}
                  </div>
                  <div className={styles.cardHeaderText}>
                    <div className={styles.label}>{event.label}</div>
                    <div className={styles.timestamp}>
                      {timeAgo(event.timestamp)}
                    </div>
                  </div>
                </div>

                {/* Photo area */}
                {renderPhoto(event)}

                {/* Meta: location + verified */}
                <div className={styles.cardMeta}>
                  {event.location && (
                    <span className={styles.locationStamp} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      <PremiumIcon name="MapPin" variant="primary" size={10} />
                      <span>{event.location}</span>
                    </span>
                  )}
                  {event.verifiedBy && isEventCompleted(event) && (
                    <span className={styles.verifiedBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      <PremiumIcon name="CheckCircle2" variant="success" size={10} />
                      <span>{event.verifiedBy}</span>
                    </span>
                  )}
                </div>

                {/* Expanded content */}
                {expandedId === event.id && (
                  <>
                    {event.description && (
                      <div className={styles.description}>
                        {event.description}
                      </div>
                    )}
                    <div className={styles.fullTimestamp}>
                      {formatFullTimestamp(event.timestamp)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Event count */}
      <div className={styles.eventCount}>
        {completedCount} of {sortedEvents.length} steps verified
      </div>
    </div>
  );
}
