'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { OrderService } from '@/lib/order-service';

// Global lock to prevent double execution in React Strict Mode / Fast Refresh
let lock = false;

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying your session...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as any;
    let next = searchParams.get('next') ?? '/dashboard';
    if (!next.startsWith('/') || next.startsWith('//')) {
      next = '/dashboard';
    }

    // If no auth params, redirect to next immediately
    if (!code && !(token_hash && type)) {
      router.push(next);
      return;
    }

    if (lock) {
      console.log('Auth callback already in progress, skipping duplicate call.');
      return;
    }
    lock = true;

    async function handleCallback() {
      const supabase = createClient();

      try {
        if (token_hash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type });
          if (otpError) throw otpError;

          try {
            const fingerprint = getDeviceFingerprint();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await OrderService.logDeviceFingerprint(user.id, fingerprint);
            }
          } catch (e) {
            console.error('Failed to log device fingerprint on OTP callback:', e);
          }

          lock = false;
          router.push(next);
          return;
        }

        if (code) {
          // First, check if a session already exists (handles double-execution,
          // back-button, or middleware-initiated exchange)
          const { data: { user: existingUser } } = await supabase.auth.getUser();
          
          if (existingUser) {
            // Session already exists — skip code exchange, just redirect
            console.log('Session already exists, skipping code exchange.');
            await handlePostAuth(supabase, existingUser, next);
            return;
          }

          // Try exchanging the code for a session
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (codeError) {
            // If PKCE verifier error, check if session was created anyway
            // (race condition where another tab/process completed the exchange)
            if (codeError.message?.includes('code verifier')) {
              console.warn('PKCE verifier error — checking if session exists anyway...');
              const { data: { user: fallbackUser } } = await supabase.auth.getUser();
              if (fallbackUser) {
                console.log('Session found despite PKCE error, proceeding.');
                await handlePostAuth(supabase, fallbackUser, next);
                return;
              }
            }
            throw codeError;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await handlePostAuth(supabase, user, next);
            return;
          }

          lock = false;
          router.push(next);
          return;
        }
      } catch (err: any) {
        console.error('Auth callback failed:', err);
        setError(err.message || 'Authentication failed');
        setStatus('Failed to authenticate');
        
        lock = false;
        
        setTimeout(() => {
          router.push('/login?error=auth_callback_failed');
        }, 3000);
      }
    }

    async function handlePostAuth(supabase: any, user: any, redirectTo: string) {
      // Log device fingerprint
      try {
        const fingerprint = getDeviceFingerprint();
        await OrderService.logDeviceFingerprint(user.id, fingerprint);
      } catch (e) {
        console.error('Failed to log device fingerprint:', e);
      }

      // Check if user needs phone onboarding (Google sign-up without phone)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        const hasPhone = (profile?.phone && profile.phone.trim() !== '') ||
                         (user.phone && user.phone.trim() !== '');

        if (!hasPhone) {
          // Redirect to signup for phone collection
          lock = false;
          window.location.href = '/signup?google_onboarding=1';
          return;
        }
      } catch (e) {
        console.warn('Profile phone check failed, proceeding to dashboard:', e);
      }

      lock = false;
      router.push(redirectTo);
    }

    handleCallback();
  }, [searchParams, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <span className="spinner spinner--lg" style={{ marginBottom: '16px' }} />
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{status}</h2>
      {error && <p style={{ color: 'var(--color-danger-500)', fontSize: '14px', marginTop: '8px', maxWidth: '400px', textAlign: 'center' }}>{error}</p>}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}><span className="spinner spinner--lg" /></div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
