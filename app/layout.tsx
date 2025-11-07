import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import '@/styles/mobile-frame.css';
import { Providers } from '@/components/Providers';
import MiniAppBoot from '@/components/MiniAppBoot';
import { getSiteConfig } from '@/lib/site-config';

const site = getSiteConfig();

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: site.ogTitle,
  description: site.ogDescription,
  openGraph: {
    title: site.ogTitle,
    description: site.ogDescription,
    url: site.siteUrl,
    type: 'website',
    siteName: 'Bubble’it!',
    images: [site.heroImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.ogTitle,
    description: site.ogDescription,
    images: [site.heroImageUrl],
  },
  other: {
    'fc:miniapp:name': 'Bubble’it!',
    'fc:miniapp:image': site.heroImageUrl,
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
    'fc:miniapp:description': site.tagline,
  },
  robots: site.noindex ? { index: false, follow: false } : undefined,
  alternates: {
    canonical: site.siteUrl,
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
        <Providers>
          <MiniAppBoot />
          <Analytics />
          {children}
        </Providers>
      </body>
    </html>
  );
}
