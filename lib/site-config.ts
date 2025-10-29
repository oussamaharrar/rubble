import { cache } from 'react';

function normalizeUrl(value: string | undefined) {
  const fallback = 'http://localhost:3000';
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch {
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      return url.toString().replace(/\/$/, '');
    } catch {
      return fallback;
    }
  }
}

function parseOptional(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseBooleanFlag(value: string | undefined, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export const getSiteConfig = cache(() => {
  const baseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_URL);
  const heroImageUrl = `${baseUrl}/api/og/hero`;
  const tagline = parseOptional(process.env.NEXT_PUBLIC_SITE_TAGLINE, 'Pop. Win. Repeat.');
  const ogTitle = parseOptional(process.env.NEXT_PUBLIC_SITE_OG_TITLE, 'Bubble’it! — Pop & Win');
  const ogDescription = parseOptional(
    process.env.NEXT_PUBLIC_SITE_OG_DESCRIPTION,
    'Fast arcade popping with boosts, rewards, and daily challenges on Base.'
  );
  const noindex = parseBooleanFlag(process.env.SITE_NOINDEX, false);

  return {
    siteUrl: baseUrl,
    heroImageUrl,
    tagline,
    ogTitle,
    ogDescription,
    noindex,
  } as const;
});

export type SiteConfig = ReturnType<typeof getSiteConfig>;
