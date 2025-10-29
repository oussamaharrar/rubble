import type { Metadata } from 'next';
import EntryExperience from '@/components/EntryExperience';
import { getEnv } from '@/lib/env';

const env = getEnv();
const siteOrigin = new URL(env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_URL).origin;
const heroImageUrl = `${siteOrigin}/api/og/hero`;
const description =
  'Fast arcade popping with boosts, rewards, and daily challenges on Base.';

export const metadata: Metadata = {
  title: 'Bubble’it! — Pop & Win',
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
        alt: 'Bubble’it! hero artwork',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bubble’it! — Pop & Win',
    description,
    images: [heroImageUrl],
  },
  other: {
    'fc:miniapp:name': 'Bubble’it!',
    'fc:miniapp:image': '/game-icons/embed.png',
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Bubble’it!',
    'base:tagline': 'Pop. Win. Repeat.',
    'base:hero:image': heroImageUrl,
  },
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolvedParams: Record<string, string | string[] | undefined> = await (searchParams ?? {});
  const rawScore = resolvedParams.score;
  const parsedScore = Array.isArray(rawScore) ? parseInt(rawScore[0] ?? '', 10) : parseInt(rawScore ?? '', 10);
  const shareScore = Number.isFinite(parsedScore) ? parsedScore : undefined;
  const rawBoard = resolvedParams.board;
  const boardParam = Array.isArray(rawBoard) ? rawBoard[0] : rawBoard;
  const shareBoard = boardParam === 'daily' ? 'daily' : 'normal';

  return <EntryExperience shareScore={shareScore} shareBoard={shareBoard} />;
}
