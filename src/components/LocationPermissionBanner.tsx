'use client';

import { useState, useEffect } from 'react';
import { useGeolocation } from '@/lib/geolocation';
import styles from './location-banner.module.css';

const DISMISS_KEY = 'biker_location_banner_dismissed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function LocationPermissionBanner() {
  const { permissionStatus, coords, requestLocation } = useGeolocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check dismissal status in local storage
    if (typeof window !== 'undefined') {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      const isPermanentlyGranted = permissionStatus === 'granted' || !!coords;
      const isDenied = permissionStatus === 'denied';

      if (isPermanentlyGranted || isDenied) {
        setVisible(false);
        return;
      }

      if (dismissedAt) {
        const timeSinceDismiss = Date.now() - parseInt(dismissedAt, 10);
        if (timeSinceDismiss < SEVEN_DAYS_MS) {
          setVisible(false);
          return;
        }
      }

      // If permission is prompt or unknown, show it
      setVisible(true);
    }
  }, [permissionStatus, coords]);

  const handleEnable = () => {
    requestLocation();
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.container}>
        <div className={styles.content}>
          <span className={styles.icon}>🎯</span>
          <div className={styles.textGroup}>
            <span className={styles.title}>Enable Geolocation Tracking</span>
            <span className={styles.subtitle}>
              Biker uses your location to match you with nearby riders and provide live delivery tracking on the map.
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <button className="btn btn--primary btn--sm" onClick={handleEnable}>
            Allow Access
          </button>
          <button className={styles.dismissButton} onClick={handleDismiss} title="Dismiss for 7 days">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
