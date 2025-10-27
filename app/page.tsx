import type { Metadata } from 'next';
import LevelsApp from '@/components/LevelsApp';

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

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolvedParams: Record<string, string | string[] | undefined> = await (searchParams ?? {});
  const refParam = resolvedParams.ref;
  const refCode = Array.isArray(refParam) ? refParam[0] : refParam;
  return <LevelsApp refCode={typeof refCode === 'string' ? refCode : undefined} />;
}
