import './globals.css';
import './atlas.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AppErrorBoundary } from '../components/error-boundary';

/* Self-hosted fonts — the SAME faces as the approved design (IBM Plex Sans,
 * JetBrains Mono, Instrument Serif), latin subsets harvested from a verified
 * build. next/font/local removes the Google Fonts network dependency, which
 * was breaking dev-server and Docker builds behind filtered networks. */
const plexSans = localFont({
  src: './fonts/ibm-plex-sans-var.woff2',
  weight: '100 700',
  variable: '--font-plex',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-var.woff2',
  weight: '100 800',
  variable: '--font-jetbrains',
  display: 'swap',
});

const instrumentSerif = localFont({
  src: [
    {
      path: './fonts/instrument-serif-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/instrument-serif-italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-serif',
  display: 'swap',
});

/** No-flash theme bootstrap: reads the persisted theme before first paint.
 * Dark (control room) is primary; 'atlas-light' is the skyblue daytime skin. */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('railbloc-theme');var d=t==='atlas-light'?'atlas-light':'atlas-dark';document.documentElement.classList.add(d);}catch(e){document.documentElement.classList.add('atlas-dark');}})();`;

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
    <html lang="en" className="atlas-dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${plexSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} atlas-dark font-sans`}
        suppressHydrationWarning
      >
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </body>
    </html>
  );
}
