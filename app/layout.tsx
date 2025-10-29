import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { getEnv } from '@/lib/env';
import './globals.css';
import '@/styles/mobile-frame.css';

const env = getEnv();
const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_URL;
const heroImageUrl = `${siteUrl.replace(/\/$/, '')}/api/og/hero`;
const noindex = env.SITE_NOINDEX;

const title = 'Bubble’it! — Pop & Win';
const description =
  'Fast arcade popping with boosts, rewards, and daily challenges on Base.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: 'Bubble’it!',
    images: [
      {
        url: heroImageUrl,
        width: 1200,
        height: 630,
        alt: 'Bubble’it! hero artwork',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [heroImageUrl],
  },
  robots: {
    index: !noindex,
    follow: !noindex,
  },
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
        <Analytics />
        {children}
      </body>
    </html>
  );
}
