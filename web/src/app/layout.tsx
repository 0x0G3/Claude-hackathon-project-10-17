import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted so the build never depends on Google Fonts being reachable.
// Files are the Latin subsets from Fontsource (SIL Open Font License, see ./fonts).
const archivo = localFont({
  src: [
    { path: './fonts/archivo-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/archivo-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/archivo-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/archivo-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-archivo',
  display: 'swap',
});

const playfair = localFont({
  src: [
    { path: './fonts/playfair-display-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/playfair-display-latin-900-normal.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-playfair',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const metadata: Metadata = {
  title: 'Next Door | Illumination Health + Home',
  description: 'Turns a discharge from IHH recuperative care into one plain-language plan, checked against verified Orange County resources.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-ground text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
