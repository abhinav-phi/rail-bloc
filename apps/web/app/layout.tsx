import './globals.css';
import './atlas.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AppErrorBoundary } from '../components/error-boundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RAIL-BLOC | AI Block Planning System',
  description:
    'AI-Powered Automatic Block Planning System for Indian Railways — CP-SAT optimized multi-department block scheduling with Sentinel cryptographic safety verification.',
  openGraph: {
    title: 'RAIL-BLOC | AI Block Planning System',
    description:
      'AI-Powered Automatic Block Planning System for Indian Railways.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="atlas-light">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} atlas-light font-sans`}
      >
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </body>
    </html>
  );
}
