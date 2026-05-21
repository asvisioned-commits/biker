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
  is_google?: boolean;
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
    // Simulate 'Email not confirmed' for easy end-to-end developer testing
    if (email.toLowerCase().includes('unconfirmed')) {
      return {
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 } as any,
      };
    }

    let mockSession: BikerSession | null = null;
    
    if (typeof window !== 'undefined') {
      try {
        const registryStr = localStorage.getItem('biker_mock_users_registry') || '[]';
        const registry = JSON.parse(registryStr);
        const found = registry.find((u: any) => u.email === email);
        if (found) {
          mockSession = found.session;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    if (!mockSession) {
      // Auto-detect role from email domain/handle
      let role = 'customer';
      const cleanEmail = email.toLowerCase();
      if (cleanEmail.includes('rider') || cleanEmail.includes('biker')) role = 'rider';
      else if (cleanEmail.includes('merchant')) role = 'merchant';
      else if (cleanEmail.includes('ops')) role = 'ops';
      else if (cleanEmail.includes('admin')) role = 'admin';

      mockSession = {
        user_id: 'mock-user-' + Date.now(),
        full_name: email.split('@')[0].toUpperCase(),
        email,
        phone: '+263771234567',
        role: role,
        roles: [role, 'customer'],
      };
    }
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    return {
      data: {
        user: { id: mockSession.user_id, email: mockSession.email, phone: mockSession.phone } as any,
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
    let mockSession: BikerSession | null = null;
    const formattedPhone = phone.startsWith('+') ? phone : `+263${phone}`;
    
    if (typeof window !== 'undefined') {
      try {
        const registryStr = localStorage.getItem('biker_mock_users_registry') || '[]';
        const registry = JSON.parse(registryStr);
        const found = registry.find((u: any) => u.phone === formattedPhone || u.phone === phone);
        if (found) {
          mockSession = found.session;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    if (!mockSession) {
      let role = 'customer';
      if (phone.includes('771') || phone.includes('772') || phone.includes('biker') || phone.includes('rider')) role = 'rider';
      else if (phone.includes('888') || phone.includes('merchant')) role = 'merchant';

      mockSession = {
        user_id: 'mock-user-' + Date.now(),
        full_name: 'Test User',
        phone: formattedPhone,
        role: role,
        roles: [role, 'customer'],
      };
    }
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
    const role = (metadata.role as string) || 'customer';
    const mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: (metadata.full_name as string) || 'New User',
      email,
      phone: metadata.phone as string,
      role: role,
      roles: [role, 'customer'],
      vehicle_registration: metadata.vehicle_registration as string || undefined,
      business_name: metadata.business_name as string || undefined,
    };
    
    // Save to registry
    if (typeof window !== 'undefined') {
      try {
        const registryStr = localStorage.getItem('biker_mock_users_registry') || '[]';
        const registry = JSON.parse(registryStr);
        const filtered = registry.filter((u: any) => u.email !== email && u.phone !== metadata.phone);
        filtered.push({
          email,
          phone: metadata.phone,
          session: mockSession
        });
        localStorage.setItem('biker_mock_users_registry', JSON.stringify(filtered));
      } catch (e) {
        console.error('Failed to save to mock user registry', e);
      }
    }
    
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
 * Resends a sign-up verification email for a given email address.
 */
export async function resendVerificationEmail(email: string) {
  if (IS_DEV) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('biker_mock_last_verification_email', email);
      localStorage.setItem('biker_mock_last_otp_sent', '123456'); // Simulated code
    }
    console.log(`[Mock Auth] Verification email resent to ${email}. Mock OTP: 123456`);
    return { data: true, error: null };
  }

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
  if (IS_DEV) {
    // Standard mock verification code is "123456"
    if (token !== '123456') {
      return { data: null, error: { message: 'Invalid verification code' } as any };
    }

    let mockSession: BikerSession = {
      user_id: 'mock-user-' + Date.now(),
      full_name: email.split('@')[0].toUpperCase(),
      email,
      phone: '+263771234567',
      role: 'customer',
      roles: ['customer'],
    };

    if (typeof window !== 'undefined') {
      try {
        const registryStr = localStorage.getItem('biker_mock_users_registry') || '[]';
        const registry = JSON.parse(registryStr);
        const found = registry.find((u: any) => u.email === email);
        if (found) {
          mockSession = found.session;
        } else {
          registry.push({ email, phone: '', session: mockSession });
          localStorage.setItem('biker_mock_users_registry', JSON.stringify(registry));
        }
      } catch (e) {
        console.error(e);
      }
    }

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
  if (IS_DEV) {
    console.log(`[Mock Auth] Password reset requested for ${email}. Simulated recovery link: ${window.location.origin}/reset-password`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('biker_mock_last_reset_email', email);
    }
    return { data: true, error: null };
  }

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
  if (IS_DEV) {
    console.log('[Mock Auth] Password successfully updated in developer mode');
    return { data: true, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
}

/**
 * Updates a logged in user's email securely.
 */
export async function updateUserEmail(email: string) {
  if (IS_DEV) {
    console.log(`[Mock Auth] Email successfully updated to ${email} in developer mode`);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.email = email;
          localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
        } catch (e) {}
      }
    }
    return { data: true, error: null };
  }

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
        const parsed = JSON.parse(stored);
        parsed.is_google = parsed.user_id?.startsWith('google-mock-') || parsed.is_google || false;
        return parsed;
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