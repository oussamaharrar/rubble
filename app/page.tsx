import type { Metadata } from 'next';
import HomeContent from '@/components/HomeContent';

const description =
  'Tap bubbles, rack combos, and trigger Base Pay boosters in this Base mini arcade.';

export const metadata: Metadata = {
  title: 'Rubble — Bubble Hunt',
  description,
  openGraph: {
    title: 'Rubble — Bubble Hunt',
    description,
    url: '/',
    type: 'website',
    siteName: 'Rubble',
    images: ['/game-icons/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rubble — Bubble Hunt',
    description,
    images: ['/game-icons/og.png'],
  },
  other: {
    'fc:miniapp:name': 'Rubble (Bubble Hunt)',
    'fc:miniapp:image': '/game-icons/embed.png',
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
  },
};

export default function Page() {
  return <HomeContent />;
}
