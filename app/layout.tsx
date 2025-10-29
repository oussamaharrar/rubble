import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import '@/styles/mobile-frame.css';
import { getEnv } from '@/lib/env';

function parseNoIndexFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_URL;
  const metadataBase = new URL(siteUrl);
  const heroImageUrl = `${metadataBase.origin}/api/og/hero`;
  const description =
    'Fast arcade popping with boosts, rewards, and daily challenges on Base.';
  const noindex = parseNoIndexFlag(env.NOINDEX);

  return {
    metadataBase,
    title: 'Bubble’it!',
    description,
    openGraph: {
      title: 'Bubble’it! — Pop & Win',
      description,
      url: '/',
      type: 'website',
      siteName: 'Bubble’it!',
      images: [
        {
          url: heroImageUrl,
          width: 1200,
          height: 630,
          alt: 'Bubble’it! — Pop. Win. Repeat.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Bubble’it! — Pop & Win',
      description,
      images: [heroImageUrl],
    },
    robots: {
      index: !noindex,
      follow: !noindex,
    },
    other: {
      'fc:miniapp:name': 'Bubble’it!',
      'fc:miniapp:image': '/game-icons/embed.png',
      'fc:miniapp:url': '/',
      'fc:miniapp:button:text': 'Bubble’it!',
      'base:tagline': 'Pop. Win. Repeat.',
      'base:hero:image': heroImageUrl,
    },
  } satisfies Metadata;
}

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
