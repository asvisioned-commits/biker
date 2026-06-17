'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, type BikerSession } from '@/lib/auth';
import { SyncManager } from '@/lib/SyncManager';

interface ProfileContextType {
  session: BikerSession | null;
  loading: boolean;
  refreshSession: (showLoading?: boolean) => Promise<void>;
  country: 'ZW' | 'ZM';
  setCountry: (country: 'ZW' | 'ZM') => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BikerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountryState] = useState<'ZW' | 'ZM'>('ZW');
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

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
          } else if (
            tz.includes('Harare') ||
            tz.includes('Johannesburg') ||
            tz.includes('Maputo') ||
            tz.includes('Windhoek') ||
            tz.includes('Gaborone') ||
            tz.includes('Maseru') ||
            tz.includes('Mbabane')
          ) {
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
      const savedTheme = localStorage.getItem('biker_theme') as 'light' | 'dark' | 'system' | null;
      const initialTheme = savedTheme || 'light';
      setThemeState(initialTheme);
      
      const applyTheme = (t: 'light' | 'dark' | 'system') => {
        let active: 'light' | 'dark' = 'light';
        if (t === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          active = prefersDark ? 'dark' : 'light';
        } else {
          active = t;
        }
        setResolvedTheme(active);
        document.documentElement.setAttribute('data-theme', active);
      };
      
      applyTheme(initialTheme);

      // Listen for system theme changes dynamically
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const currentSaved = localStorage.getItem('biker_theme') as 'light' | 'dark' | 'system' | null;
        if (!currentSaved || currentSaved === 'system') {
          const active = e.matches ? 'dark' : 'light';
          setResolvedTheme(active);
          document.documentElement.setAttribute('data-theme', active);
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, []);

  const setCountry = (newCountry: 'ZW' | 'ZM') => {
    setCountryState(newCountry);
    localStorage.setItem('biker_country', newCountry);
  };

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('biker_theme', newTheme);
    
    let active: 'light' | 'dark' = 'light';
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      active = prefersDark ? 'dark' : 'light';
    } else {
      active = newTheme;
    }
    setResolvedTheme(active);
    document.documentElement.setAttribute('data-theme', active);
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
    SyncManager.initialize();
    return () => {
      SyncManager.destroy();
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ session, loading, refreshSession, country, setCountry, theme, setTheme, resolvedTheme }}>
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
