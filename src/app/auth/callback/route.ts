import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as any; // e.g. 'signup', 'invite', 'recovery', 'email_change'
  
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/dashboard';
  if (!next.startsWith('/')) {
    next = '/dashboard';
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const getRedirectUrl = () => {
    if (isLocalEnv) {
      return `${origin}${next}`;
    } else if (forwardedHost) {
      return `https://${forwardedHost}${next}`;
    } else {
      return `${origin}${next}`;
    }
  };

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(getRedirectUrl());
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(getRedirectUrl());
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
