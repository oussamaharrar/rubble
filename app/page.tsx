import type { Metadata } from 'next';
import AppExperience from '@/components/AppExperience';

const description =
  'Tap through Base storms, chain combos, and post your score to the Rubble Rush daily challenge.';

export const metadata: Metadata = {
  title: 'Rubble Rush — Daily Storm Challenge',
  description,
  openGraph: {
    title: 'Rubble Rush — Daily Storm Challenge',
    description,
    url: '/',
    type: 'website',
    siteName: 'Rubble',
    images: ['/game-icons/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rubble Rush — Daily Storm Challenge',
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
  return <AppExperience />;
}
