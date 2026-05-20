'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GeolocationState {
  coords: [number, number] | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionStatus: PermissionState | null;
}

const STORAGE_KEY = 'biker_last_known_location';

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    accuracy: null,
    error: null,
    loading: false,
    permissionStatus: null,
  });

  // Try to load cached location on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const { lat, lng } = JSON.parse(cached);
          setState(prev => ({
            ...prev,
            coords: [lat, lng],
          }));
        }
      } catch (e) {
        console.error('Failed to parse cached location', e);
      }

      // Check permission status if API is available
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(status => {
            setState(prev => ({ ...prev, permissionStatus: status.state }));
            status.onchange = () => {
              setState(prev => ({ ...prev, permissionStatus: status.state }));
            };
          })
          .catch(() => {});
      }
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 0,
    };

    const lowAccuracyOptions = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60000, // allow 1 minute cached value
    };

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const coords: [number, number] = [latitude, longitude];

      // Cache last location
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: latitude, lng: longitude }));

      setState(prev => ({
        ...prev,
        coords,
        accuracy,
        loading: false,
        error: null,
        permissionStatus: 'granted',
      }));
    };

    const handleFailure = (error: GeolocationPositionError) => {
      let errorMsg = 'Failed to retrieve location';
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = 'Permission denied. Please enable location access in settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = 'Position unavailable.';
      } else if (error.code === error.TIMEOUT) {
        errorMsg = 'Request timed out.';
      }

      setState(prev => ({
        ...prev,
        error: errorMsg,
        loading: false,
        permissionStatus: error.code === error.PERMISSION_DENIED ? 'denied' : prev.permissionStatus,
      }));
    };

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        // High accuracy failed, fallback to low accuracy
        console.warn('High accuracy geolocation failed or timed out. Retrying with low accuracy...', err);
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          handleFailure,
          lowAccuracyOptions
        );
      },
      highAccuracyOptions
    );
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
