import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tjwdejytsfzfwnfhugxe.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqd2Rlanl0c2Z6ZnduZmh1Z3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM5NTAsImV4cCI6MjA5NDMyOTk1MH0.VMjqIlkIG6ZYXVGExQdQTSQPuzUUNDX6NVNaZ6Prxz0';
  
  return createBrowserClient(url, key);
}
