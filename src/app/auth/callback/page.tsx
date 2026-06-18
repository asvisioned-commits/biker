'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    let next = searchParams.get('next') ?? '/dashboard';
    if (!next.startsWith('/')) {
      next = '/dashboard';
    }

    const handleCallback = async () => {
      if (code) {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Error exchanging code for session:', error.message);
          router.push(`/login?error=auth_callback_failed&details=${encodeURIComponent(error.message)}`);
          return;
        }
      }
      router.push(next);
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
      <span className="spinner spinner--lg" />
      <p>Confirming your login...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <span className="spinner spinner--lg" />
        <p>Confirming your login...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
