import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bikerapp.app',
  appName: 'Biker',
  webDir: 'out',
  server: {
    // Only allow navigation to the app's own origin and Supabase
    allowNavigation: ['tjwdejytsfzfwnfhugxe.supabase.co'],
    // Use HTTPS scheme on both platforms
    androidScheme: 'https',
    iosScheme: 'https',
    // Block cleartext HTTP traffic
    cleartext: false,
  },
};

export default config;
