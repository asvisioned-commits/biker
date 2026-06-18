/**
 * Biker Auth Utilities
 * Handles Supabase auth and merges auth.users data with profiles + user_roles tables
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
  is_google?: boolean;
}

/**
 * Sign in with Google OAuth via Supabase
 */
export async function signInWithGoogle() {
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
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/**
 * Sanitizes and normalizes phone number to digits only, removing spaces/dashes/parentheses,
 * and stripping any leading zero.
 */
export function sanitizePhoneNumber(phone: string): string {
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+')) {
    return clean;
  }
  return clean.startsWith('0') ? clean.slice(1) : clean;
}

/**
 * Sign in with phone OTP
 */
export async function signInWithPhone(phone: string, countryPrefix = '+263') {
  const supabase = createClient();
  const cleanPhone = sanitizePhoneNumber(phone);
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `${countryPrefix}${cleanPhone}`;
  const { data, error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
  return { data, error };
}

/**
 * Verify phone OTP
 */
export async function verifyPhoneOtp(phone: string, token: string, countryPrefix = '+263') {
  const cleanPhone = sanitizePhoneNumber(phone);
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `${countryPrefix}${cleanPhone}`;

  if (IS_DEV) {
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: 'Test User',
      phone: formattedPhone,
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
    phone: formattedPhone,
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
 * Sign up with phone + password + metadata (initiates SMS OTP verification)
 */
export async function signUpWithPhone(
  phone: string,
  password: string,
  metadata: Record<string, unknown>
) {
  const cleanPhone = phone.startsWith('+') ? phone : `+263${phone.replace(/^0+/, '')}`;

  if (IS_DEV) {
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: (metadata.full_name as string) || 'New User',
      phone: cleanPhone,
      role: (metadata.role as string) || 'customer',
      roles: [(metadata.role as string) || 'customer'],
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
  const { data, error } = await supabase.auth.signUp({
    phone: cleanPhone,
    password,
    options: {
      data: {
        ...metadata,
        phone: cleanPhone, // ensure phone is stored in metadata as well for the trigger
      },
      channel: 'sms',
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
 * Resends a sign-up verification email for a given email address.
 */
export async function resendVerificationEmail(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Verifies email signup OTP code in-app.
 */
export async function verifyEmailOtp(email: string, token: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  return { data, error };
}

/**
 * Sends a password recovery / reset link to an email address.
 */
export async function sendPasswordResetEmail(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

/**
 * Updates a logged in user's password securely (used on the recovery page).
 */
export async function updateUserPassword(password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
}

/**
 * Updates a logged in user's email securely.
 */
export async function updateUserEmail(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ email });
  return { data, error };
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

  // Check if signed in via Google provider
  const isGoogle = user.app_metadata?.provider === 'google' || 
                   user.app_metadata?.providers?.includes('google') || 
                   user.identities?.some(id => id.provider === 'google') || 
                   false;

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
    is_google: isGoogle,
  };
}

/**
 * Permanently delete the user account and sign out
 */
export async function deleteAccount() {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_user_account');
  if (!error) {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return { success: true, error: null };
  }
  return { success: false, error };
}
