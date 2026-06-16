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

          // Reset lock upon successful navigation
          lock = false;
          router.push(next);
          return;
        }

        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;

          try {
            const fingerprint = getDeviceFingerprint();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await OrderService.logDeviceFingerprint(user.id, fingerprint);
            }
          } catch (e) {
            console.error('Failed to log device fingerprint on OAuth callback:', e);
          }

          // Reset lock upon successful navigation
          lock = false;
          router.push(next);
          return;
        }
      } catch (err: any) {
        console.error('Auth callback failed:', err);
        setError(err.message || 'Authentication failed');
        setStatus('Failed to authenticate');
        
        // Reset lock on failure so the user can retry if they reload
        lock = false;
        
        setTimeout(() => {
          router.push('/login?error=auth_callback_failed');
        }, 3000);
      }
    }

    handleCallback();
  }, [searchParams, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <span className="spinner spinner--lg" style={{ marginBottom: '16px' }} />
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{status}</h2>
      {error && <p style={{ color: 'var(--color-danger-500)', fontSize: '14px', marginTop: '8px' }}>{error}</p>}
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
