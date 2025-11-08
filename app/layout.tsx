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
    siteName: site.miniAppName,
    images: [site.heroImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.ogTitle,
    description: site.ogDescription,
    images: [site.heroImageUrl],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: 'next',
      imageUrl: site.embedImageUrl,
      button: {
        title: site.miniAppButtonTitle,
        action: {
          type: 'launch_miniapp',
          name: site.miniAppName,
          url: site.siteUrl,
        },
      },
    }),
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
        <meta property="og:title" content={site.ogTitle} />
        <meta property="og:description" content={site.ogDescription} />
        <meta property="og:image" content={site.heroImageUrl} />
        <meta property="og:url" content={site.siteUrl} />
        <meta name="robots" content={site.noindex ? 'noindex' : 'index,follow'} />
        <meta
          name="fc:miniapp"
          content={JSON.stringify({
            version: 'next',
            imageUrl: site.embedImageUrl,
            button: {
              title: site.miniAppButtonTitle,
              action: {
                type: 'launch_miniapp',
                name: site.miniAppName,
                url: site.siteUrl,
              },
            },
          })}
        />
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
