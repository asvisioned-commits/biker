/**
 * Feature Flags Configuration
 * Allows runtime control over system modes and fallback states.
 */

export const FLAGS = {
  // Flag to completely bypass mock/local storage data and communicate with Supabase directly
  useLiveDb: process.env.NEXT_PUBLIC_USE_LIVE_DB === 'true',
  
  // Emergency fallback flag: if true, allows local storage/mock fallback on database errors
  enableMockFallback: process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true',
  
  // Flag to toggle developer simulation controls and dashboard HUDs
  devHud: process.env.NEXT_PUBLIC_DEV_MODE === 'true',
};
