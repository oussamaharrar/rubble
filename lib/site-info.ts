const TAGLINE = 'Pop. Win. Repeat.' as const;
const OG_TITLE = 'Bubble’it! — Pop & Win' as const;
const OG_DESCRIPTION =
  'Fast arcade popping with boosts, rewards, and daily challenges on Base.' as const;

function parseBooleanFlag(value: string | undefined | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function resolveSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_URL;
  try {
    return new URL(envUrl ?? 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

const siteUrl = resolveSiteUrl();

export const siteMetadata = {
  siteUrl: siteUrl.toString().replace(/\/$/, ''),
  title: 'Bubble’it!' as const,
  tagline: TAGLINE,
  ogTitle: OG_TITLE,
  ogDescription: OG_DESCRIPTION,
  heroImageUrl: new URL('/api/og/hero', siteUrl).toString(),
  noindex: parseBooleanFlag(process.env.SITE_NOINDEX ?? process.env.NEXT_PUBLIC_SITE_NOINDEX),
} as const;

