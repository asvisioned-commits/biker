'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, type BikerSession } from '@/lib/auth';

interface ProfileContextType {
  session: BikerSession | null;
  loading: boolean;
  refreshSession: (showLoading?: boolean) => Promise<void>;
  country: 'ZW' | 'ZM';
  setCountry: (country: 'ZW' | 'ZM') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BikerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountryState] = useState<'ZW' | 'ZM'>('ZW');
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  // Load persisted country preference from localStorage on mount or auto-detect
  useEffect(() => {
    const saved = localStorage.getItem('biker_country');
    if (saved === 'ZW' || saved === 'ZM') {
      setCountryState(saved);
      return;
    }

    const detectCountry = async () => {
      // 1. Timezone detection (instant, offline)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          if (tz.includes('Lusaka')) {
            setCountryState('ZM');
            return;
          } else if (tz.includes('Harare')) {
            setCountryState('ZW');
            return;
          }
        }
      } catch (e) {
        console.error('Timezone detection failed:', e);
      }

      // 2. IP Geolocation detection using Cloudflare Trace (highly reliable)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
        
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const text = await response.text();
        const match = text.match(/loc=([A-Z]{2})/);
        if (match && (match[1] === 'ZW' || match[1] === 'ZM')) {
          setCountryState(match[1] as 'ZW' | 'ZM');
          return;
        }
      } catch (e) {
        console.error('IP country detection failed:', e);
      }

      // 3. Default fallback
      setCountryState('ZW');
    };

    detectCountry();
  }, []);

  // Load persisted theme preference from localStorage on mount or auto-detect system theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('biker_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = prefersDark ? 'dark' : 'light';
        setThemeState(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);
      }
    }
  }, []);

  const setCountry = (newCountry: 'ZW' | 'ZM') => {
    setCountryState(newCountry);
    localStorage.setItem('biker_country', newCountry);
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('biker_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const refreshSession = async (showLoading = false) => {
    try {
      if (showLoading || !session) {
        setLoading(true);
      }
      const sess = await getSession();
      setSession(sess);
    } catch (e) {
      console.error('Failed to load profile session', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  return (
    <ProfileContext.Provider value={{ session, loading, refreshSession, country, setCountry, theme, setTheme }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
