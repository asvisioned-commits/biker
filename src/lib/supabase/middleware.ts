import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  // In dev mode, bypass all auth checks — mock auth handled client-side
  if (IS_DEV) {
    return NextResponse.next({ request });
  }

  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  // If we receive an OAuth code on the root or login page, redirect to auth/callback to exchange it
  if (code && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  // Production: Full Supabase session management
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // IMPORTANT: Do NOT use getSession() — it reads from storage which can be tampered.
  // Use getUser() which validates the token with Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();



  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/auth/')
  );

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
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
