import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // ---- DEVELOPMENT: Bypass all auth checks ----
  // Mock auth is handled client-side via localStorage.
  // In production, re-enable Supabase session handling.
  return NextResponse.next({ request });
}

