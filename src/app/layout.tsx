import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ProfileProvider } from '@/context/ProfileContext';

export const metadata: Metadata = {
  title: 'Biker — Send, Buy, Deliver Anything Safely',
  description:
    'Zimbabwe\'s trusted on-demand errand, delivery, and local commerce platform. Protected payments, verified riders, provable deliveries.',
  keywords: [
    'delivery',
    'Zimbabwe',
    'errands',
    'logistics',
    'Harare',
    'Bulawayo',
    'EcoCash',
    'protected delivery',
    'courier',
    'buy for me',
  ],
  openGraph: {
    title: 'Biker — Send, Buy, Deliver Anything Safely',
    description:
      'Zimbabwe\'s trusted platform for errands, deliveries, and local commerce.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1724' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ProfileProvider>
          {children}
        </ProfileProvider>
      </body>
    </html>
  );
}
