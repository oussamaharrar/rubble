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

function computeSiteConfig() {
  const baseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_URL);
  const heroImageUrl = `${baseUrl}/og/bubbleit-hero-1200x630.jpg`;
  const embedImageUrl = `${baseUrl}/og/bubbleit-embed-1200x630.jpg`;
  const splashImageUrl = `${baseUrl}/og/bubbleit-splash.png`;
  const iconUrl = `${baseUrl}/icons/app-icon-1024.png`;
  const tagline = parseOptional(process.env.NEXT_PUBLIC_SITE_TAGLINE, 'Pop. Streak. Win.');
  const ogTitle = parseOptional(process.env.NEXT_PUBLIC_SITE_OG_TITLE, 'Bubble’it! — Mini Game');
  const ogDescription = parseOptional(
    process.env.NEXT_PUBLIC_SITE_OG_DESCRIPTION,
    'Pop bubbles, build streaks, earn boosts!'
  );
  const noindex = parseBooleanFlag(process.env.SITE_NOINDEX, false);

  return {
    siteUrl: baseUrl,
    heroImageUrl,
    embedImageUrl,
    splashImageUrl,
    iconUrl,
    tagline,
    ogTitle,
    ogDescription,
    noindex,
    miniAppName: "Bubble’it!",
    miniAppButtonTitle: 'Play Now',
  } as const;
}

export function readSiteConfig() {
  return computeSiteConfig();
}

export const getSiteConfig = cache(computeSiteConfig);

export type SiteConfig = ReturnType<typeof getSiteConfig>;
