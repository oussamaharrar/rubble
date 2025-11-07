'use client';

export async function fetchWhoAmI(): Promise<{
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
} | null> {
  try {
    const res = await fetch('/api/miniapp/whoami', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (data && typeof data === 'object' && data.ok) {
      const fid = Number((data as { fid?: unknown }).fid);
      if (Number.isFinite(fid)) {
        const identity = data as {
          username?: unknown;
          displayName?: unknown;
          pfpUrl?: unknown;
        };
        return {
          fid: Math.floor(fid),
          username: typeof identity.username === 'string' ? identity.username : undefined,
          displayName: typeof identity.displayName === 'string' ? identity.displayName : undefined,
          pfpUrl: typeof identity.pfpUrl === 'string' ? identity.pfpUrl : undefined,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
