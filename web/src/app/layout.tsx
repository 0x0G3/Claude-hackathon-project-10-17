import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resource Navigator | Claude Impact Lab OC',
  description: 'Community resource navigation, matching, and action planning for Illumination Health + Home clients.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
