import type { Metadata } from 'next';
import MiniAppShell from '@/components/MiniAppShell';
import BubbleGameCanvas from './game/BubbleGameCanvas';
import PayButton from '@/components/PayButton';

export const metadata: Metadata = {
  title: 'Rubble — Bubble Hunt',
  description: 'Tap bubbles, rack combos, boost with Base.',
  openGraph: {
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
  return (
    <MiniAppShell>
      <BubbleGameCanvas />
      <PayButton />
    </MiniAppShell>
  );
}
