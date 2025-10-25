import type { Metadata } from 'next';
import MiniAppShell from '@/components/MiniAppShell';
import GameExperience from '@/components/GameExperience';
import { ENV } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(ENV.NEXT_PUBLIC_URL),
  title: 'Rubble — Bubble Hunt',
  description: 'Tap bubbles, rack combos, boost with Base.',
  openGraph: {
    title: 'Rubble — Bubble Hunt',
    description: 'Tap bubbles, rack combos, boost with Base.',
    url: ENV.NEXT_PUBLIC_URL,
    siteName: 'Rubble',
    images: [
      {
        url: '/game-icons/og.png',
        width: 1200,
        height: 630,
        alt: 'Rubble Bubble Hunt',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rubble — Bubble Hunt',
    description: 'Tap bubbles, rack combos, boost with Base.',
    images: ['/game-icons/og.png'],
  },
  other: {
    'fc:miniapp:name': 'Rubble (Bubble Hunt)',
    'fc:miniapp:image': '/game-icons/embed.png',
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
    'fc:miniapp:button:action': 'open',
    'fc:frame:image': '/game-icons/og.png',
  },
};

export default function Page() {
  return (
    <MiniAppShell>
      <GameExperience />
    </MiniAppShell>
  );
}
