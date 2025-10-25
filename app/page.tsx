import type { Metadata } from 'next';
import HomeContent from '@/components/HomeContent';

const description =
  'Race the Base storm timer, stack color combos, and unleash slow-time boosters in Rubble Rush: Storm & Combos.';

export const metadata: Metadata = {
  title: 'Rubble Rush — Storm & Combos',
  description,
  openGraph: {
    title: 'Rubble Rush — Storm & Combos',
    description,
    url: '/',
    type: 'website',
    siteName: 'Rubble',
    images: ['/game-icons/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rubble Rush — Storm & Combos',
    description,
    images: ['/game-icons/og.png'],
  },
  other: {
    'fc:miniapp:name': 'Rubble Rush',
    'fc:miniapp:image': '/game-icons/embed.png',
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
  },
};

export default function Page() {
  return <HomeContent />;
}
