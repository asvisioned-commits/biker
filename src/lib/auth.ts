/**
 * Biker Auth Utilities
 * Handles both real Supabase auth and mock dev-mode auth
 */

import { createClient } from '@/lib/supabase/client';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export interface BikerSession {
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  avatar_url?: string;
  vehicle_registration?: string;
  business_name?: string;
}

/**
 * Sign in with Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (IS_DEV) {
    // In dev mode, create a mock Google session
    const mockSession: BikerSession = {
      user_id: 'google-mock-' + Date.now(),
      full_name: 'Google User',
      email: 'user@gmail.com',
      role: 'customer',
      avatar_url: undefined,
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    window.location.href = '/dashboard';
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  if (IS_DEV) {
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: 'Test User',
      email,
      role: 'customer',
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return { data: mockSession, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/**
 * Sign in with phone OTP
 */
export async function signInWithPhone(phone: string) {
  if (IS_DEV) {
    return { data: { phone }, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOtp({ phone: `+263${phone}` });
  return { data, error };
}

/**
 * Verify phone OTP
 */
export async function verifyPhoneOtp(phone: string, token: string) {
  if (IS_DEV) {
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: 'Test User',
      phone: `+263${phone}`,
      role: 'customer',
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return { data: mockSession, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: `+263${phone}`,
    token,
    type: 'sms',
  });
  return { data, error };
}

/**
 * Sign up with email + password + metadata
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, unknown>
) {
  if (IS_DEV) {
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: (metadata.full_name as string) || 'New User',
      email,
      phone: metadata.phone as string,
      role: (metadata.role as string) || 'customer',
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return { data: mockSession, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Sign out
 */
export async function signOut() {
  if (IS_DEV) {
    localStorage.removeItem('biker_mock_session');
    window.location.href = '/';
    return;
  }

  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = '/';
}

/**
 * Get current session
 */
export async function getSession(): Promise<BikerSession | null> {
  if (IS_DEV) {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('biker_mock_session');
    return stored ? JSON.parse(stored) : null;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    user_id: user.id,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || undefined,
    phone: user.phone || undefined,
    role: user.user_metadata?.role || 'customer',
    avatar_url: user.user_metadata?.avatar_url || undefined,
  };
}
