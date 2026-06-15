'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying your session...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type') as any;
      let next = searchParams.get('next') ?? '/dashboard';
      if (!next.startsWith('/') || next.startsWith('//')) {
        next = '/dashboard';
      }

      const supabase = createClient();

      try {
        if (token_hash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type });
          if (otpError) throw otpError;
          router.push(next);
          return;
        }

        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
          router.push(next);
          return;
        }

        // If no code/token, just redirect to dashboard
        router.push(next);
      } catch (err: any) {
        console.error('Auth callback failed:', err);
        setError(err.message || 'Authentication failed');
        setStatus('Failed to authenticate');
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
