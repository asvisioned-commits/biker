import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  // If we receive an OAuth code on the root or login page, redirect to auth/callback to exchange it
  if (code && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  // Full Supabase session management
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tjwdejytsfzfwnfhugxe.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqd2Rlanl0c2Z6ZnduZmh1Z3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM5NTAsImV4cCI6MjA5NDMyOTk1MH0.VMjqIlkIG6ZYXVGExQdQTSQPuzUUNDX6NVNaZ6Prxz0',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Static assets and API routes should pass through immediately
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return supabaseResponse;
  }

  // Public routes that don't require redirect checks
  const publicRoutes = ['/', '/auth/callback', '/about', '/privacy', '/terms', '/disputes-policy'];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route
  ) || pathname.startsWith('/reset-password');

  // Skip auth checks on public pages (improves speed & avoids PKCE session verifier errors)
  if (isPublicRoute) {
    return supabaseResponse;
  }

  // IMPORTANT: Use getUser() which validates the token with Supabase Auth server.
  // Do NOT use getSession() — it reads from storage which can be tampered.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  // If user is not authenticated and trying to access protected route
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access login/signup, redirect to dashboard
  // Exception: Allow access to /signup if completing Google onboarding
  if (user && (pathname === '/login' || (pathname === '/signup' && !searchParams.has('google_onboarding')))) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
