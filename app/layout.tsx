import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import '@/styles/mobile-frame.css';
import { siteMetadata } from '@/lib/site-info';

export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.siteUrl),
  title: siteMetadata.ogTitle,
  description: siteMetadata.ogDescription,
  openGraph: {
    title: siteMetadata.ogTitle,
    description: siteMetadata.ogDescription,
    url: '/',
    type: 'website',
    images: [{ url: siteMetadata.heroImageUrl, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteMetadata.ogTitle,
    description: siteMetadata.ogDescription,
    images: [siteMetadata.heroImageUrl],
  },
  robots: siteMetadata.noindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
  other: {
    'base:app:tagline': siteMetadata.tagline,
    'base:app:hero': siteMetadata.heroImageUrl,
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
