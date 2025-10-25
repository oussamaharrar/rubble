import type { Metadata } from 'next';
import MiniAppShell from '@/components/MiniAppShell';
import BubbleGameCanvas from './game/BubbleGameCanvas';
import PayButton from '@/components/PayButton';

export const metadata: Metadata = {
  title: 'Rubble — Bubble Hunt',
  description: 'Tap bubbles, rack combos, and trigger Base Pay boosters in this Base mini arcade.',
  openGraph: {
    title: 'Rubble — Bubble Hunt',
    description: 'Tap bubbles, rack combos, and trigger Base Pay boosters in this Base mini arcade.',
    url: '/',
    type: 'website',
    siteName: 'Rubble',
    images: ['/game-icons/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rubble — Bubble Hunt',
    description: 'Tap bubbles, rack combos, and trigger Base Pay boosters in this Base mini arcade.',
    images: ['/game-icons/og.png'],
  },
  other: {
    'fc:miniapp:name': 'Rubble (Bubble Hunt)',
    'fc:miniapp:image': '/game-icons/embed.png',
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
    'fc:frame:image': '/game-icons/embed.png',
    'fc:frame:button:1': 'Play',
    'fc:frame:post_url': '/',
  },
};

export default function Page() {
  return (
    <MiniAppShell>
      <BubbleGameCanvas />
      <PayButton />
    </MiniAppShell>
  );
}
