'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, type BikerSession } from '@/lib/auth';

interface ProfileContextType {
  session: BikerSession | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BikerSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      setLoading(true);
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
    <ProfileContext.Provider value={{ session, loading, refreshSession }}>
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
