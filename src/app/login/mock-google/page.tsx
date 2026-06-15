'use client';

import { redirect } from 'next/navigation';

// Mock Google OAuth page removed for security — all auth goes through real Supabase
export default function MockGooglePage() {
  redirect('/login');
}
