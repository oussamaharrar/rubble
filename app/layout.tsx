import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import '@/styles/mobile-frame.css';
import VhFixProvider from '@/components/VhFixProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'),
  title: 'Rubble — Bubble Hunt',
  description: 'A Farcaster mini app arcade built for Base.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
        />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="bg-[#030712] text-slate-100 antialiased">
        <VhFixProvider />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
