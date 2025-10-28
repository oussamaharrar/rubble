import type { Metadata } from 'next';
import EntryExperience from '@/components/EntryExperience';

const description =
  "Bounce into Bubble’it! for cheeky combos, Base-powered boosts, and daily bubble-burst showdowns.";

export const metadata: Metadata = {
  title: 'Bubble’it! — Cheeky Combo Challenge',
  description,
  openGraph: {
    title: 'Bubble’it! — Cheeky Combo Challenge',
    description,
    url: '/',
    type: 'website',
    siteName: 'Bubble’it!',
    images: ['/game-icons/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bubble’it! — Cheeky Combo Challenge',
    description,
    images: ['/game-icons/og.png'],
  },
  other: {
    'fc:miniapp:name': 'Bubble’it!',
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
  const rawScore = resolvedParams.score;
  const parsedScore = Array.isArray(rawScore) ? parseInt(rawScore[0] ?? '', 10) : parseInt(rawScore ?? '', 10);
  const shareScore = Number.isFinite(parsedScore) ? parsedScore : undefined;
  const rawBoard = resolvedParams.board;
  const boardParam = Array.isArray(rawBoard) ? rawBoard[0] : rawBoard;
  const shareBoard = boardParam === 'daily' ? 'daily' : 'normal';

  return <EntryExperience shareScore={shareScore} shareBoard={shareBoard} />;
}
