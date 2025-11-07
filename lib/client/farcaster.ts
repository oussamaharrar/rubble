'use client';

type WhoAmIResponse = {
  ok: true;
  fid: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
};

export async function fetchWhoAmI(): Promise<WhoAmIResponse | null> {
  try {
    const response = await fetch('/api/miniapp/whoami', { cache: 'no-store' });
    const data = await response.json();
    return data && data.ok ? (data as WhoAmIResponse) : null;
  } catch {
    return null;
  }
}
