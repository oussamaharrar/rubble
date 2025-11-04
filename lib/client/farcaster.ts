'use client';

export type MiniAppIdentity = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

export async function fetchWhoAmI(): Promise<MiniAppIdentity | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const response = await fetch('/api/miniapp/whoami', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; fid?: unknown; username?: unknown; displayName?: unknown; pfpUrl?: unknown }
      | null;
    if (!data || data.ok !== true) {
      return null;
    }
    const fid = typeof data.fid === 'number' ? data.fid : Number(data.fid);
    if (!Number.isFinite(fid)) {
      return null;
    }
    const username = typeof data.username === 'string' ? data.username : null;
    const displayName = typeof data.displayName === 'string' ? data.displayName : null;
    const pfpUrl = typeof data.pfpUrl === 'string' ? data.pfpUrl : null;
    return { fid: Math.trunc(fid), username, displayName, pfpUrl };
  } catch (error) {
    console.debug('[farcaster] whoami failed', error);
    return null;
  }
}
