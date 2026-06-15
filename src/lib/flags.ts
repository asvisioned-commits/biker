/**
 * Feature Flags Configuration
 * Runtime control over system modes and fallback states.
 */

export const FLAGS = {
  // Flag to communicate with Supabase directly (always true in production)
  useLiveDb: process.env.NEXT_PUBLIC_USE_LIVE_DB !== 'false',
  
  // Emergency fallback flag: if true, allows local storage fallback on database errors
  enableMockFallback: process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true',
};
