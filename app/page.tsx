import type { Metadata } from 'next';
import EntryExperience from '@/components/EntryExperience';
import { siteMetadata } from '@/lib/site-info';

export const metadata: Metadata = {
  title: siteMetadata.title,
  description: siteMetadata.ogDescription,
  openGraph: {
    title: siteMetadata.ogTitle,
    description: siteMetadata.ogDescription,
    url: '/',
    type: 'website',
    siteName: siteMetadata.title,
    images: [siteMetadata.heroImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteMetadata.ogTitle,
    description: siteMetadata.ogDescription,
    images: [siteMetadata.heroImageUrl],
  },
  other: {
    'fc:miniapp:name': siteMetadata.title,
    'fc:miniapp:image': siteMetadata.heroImageUrl,
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Bubble’it!',
    'base:app:tagline': siteMetadata.tagline,
    'base:app:hero': siteMetadata.heroImageUrl,
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
