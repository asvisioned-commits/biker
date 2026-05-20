/**
 * Biker Auth Utilities
 * Handles both real Supabase auth and mock dev-mode auth
 * Merges auth.users data with profiles + user_roles tables
 */

import { createClient } from '@/lib/supabase/client';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export interface BikerSession {
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  roles: string[];
  avatar_url?: string;
  trust_score?: number;
  vehicle_registration?: string;
  business_name?: string;
  is_suspended?: boolean;
}

/**
 * Sign in with Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (IS_DEV) {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get('redirect') || '/dashboard';
      window.location.href = `/login/mock-google?redirect=${encodeURIComponent(redirect)}`;
    }
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
      roles: ['customer'],
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return {
      data: {
        user: { id: mockSession.user_id, email: mockSession.email } as any,
        session: { access_token: 'mock-token', user: { id: mockSession.user_id } } as any,
      },
      error: null,
    };
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
    return { data: { user: null, session: null }, error: null };
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
      roles: ['customer'],
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return {
      data: {
        user: { id: mockSession.user_id, phone: mockSession.phone } as any,
        session: { access_token: 'mock-token', user: { id: mockSession.user_id } } as any,
      },
      error: null,
    };
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
      roles: [(metadata.role as string) || 'customer'],
    };
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return {
      data: {
        user: { id: mockSession.user_id, email: mockSession.email } as any,
        session: { access_token: 'mock-token', user: { id: mockSession.user_id } } as any,
      },
      error: null,
    };
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
 * Get current session — merges auth user with profile + roles from DB
 * This is the single source of truth for "who is the current user"
 */
export async function getSession(): Promise<BikerSession | null> {
  if (IS_DEV) {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('biker_mock_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        localStorage.removeItem('biker_mock_session');
        return null;
      }
    }
    return null;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch profile + roles from DB to merge with auth user
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, phone, avatar_url, trust_score, active_role, is_suspended')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ]);

  const profile = profileRes.data;
  const activeRoles = rolesRes.data?.map((r: { role: string }) => r.role) || ['customer'];

  return {
    user_id: user.id,
    full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || undefined,
    phone: profile?.phone || user.phone || undefined,
    role: profile?.active_role || activeRoles[0] || 'customer',
    roles: activeRoles,
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || undefined,
    trust_score: profile?.trust_score || 50,
    is_suspended: profile?.is_suspended || false,
  };
}
