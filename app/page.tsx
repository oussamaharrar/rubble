import type { Metadata } from 'next';
import EntryExperience from '@/components/EntryExperience';
import { getSiteConfig } from '@/lib/site-config';

const site = getSiteConfig();

export const metadata: Metadata = {
  title: site.ogTitle,
  description: site.ogDescription,
  openGraph: {
    title: site.ogTitle,
    description: site.ogDescription,
    url: site.siteUrl,
    type: 'website',
    siteName: 'Bubble’it!',
    images: [site.heroImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.ogTitle,
    description: site.ogDescription,
    images: [site.heroImageUrl],
  },
  other: {
    'fc:miniapp:name': 'Bubble’it!',
    'fc:miniapp:image': site.heroImageUrl,
    'fc:miniapp:url': '/',
    'fc:miniapp:button:text': 'Play',
    'fc:miniapp:description': site.tagline,
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
  const rawRef = resolvedParams.ref;
  const refParam = Array.isArray(rawRef) ? rawRef[0] : rawRef;
  const referrerAddress =
    typeof refParam === 'string' && /^0x[a-fA-F0-9]{40}$/u.test(refParam) ? refParam : undefined;

  return (
    <EntryExperience
      shareScore={shareScore}
      shareBoard={shareBoard}
      tagline={site.tagline}
      referrerAddress={referrerAddress}
    />
  );
}
