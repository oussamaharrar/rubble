import { NextResponse } from 'next/server';
import { readFarcasterRequest } from '@/lib/farcaster';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface FarcasterBodyUser {
  fid?: unknown;
  username?: unknown;
  displayName?: unknown;
  pfpUrl?: unknown;
}

type FarcasterPayload =
  | { user?: FarcasterBodyUser | null }
  | { data?: { user?: FarcasterBodyUser | null; fid?: unknown } | null }
  | { trustedData?: { user?: FarcasterBodyUser | null; message?: { data?: { fid?: unknown; user?: FarcasterBodyUser | null } | null } | null } | null }
  | { message?: { data?: { fid?: unknown; user?: FarcasterBodyUser | null } | null } | null }
  | { fid?: unknown };

function parseMaybeJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  const attempts: string[] = [value];
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (decoded && decoded !== value) {
      attempts.push(decoded);
    }
  } catch {
    // ignore base64 decoding errors
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore parse failures
    }
  }
  return null;
}

function coerceUser(payload: Record<string, unknown> | null): { fid: number | null; username?: string; displayName?: string; pfpUrl?: string } {
  if (!payload) {
    return { fid: null };
  }
  const candidates: Array<FarcasterBodyUser | null | undefined> = [];
  const asPayload = payload as FarcasterPayload;
  if ('user' in asPayload) {
    candidates.push((asPayload as { user?: FarcasterBodyUser | null }).user);
  }
  if ('data' in asPayload) {
    const data = (asPayload as { data?: { user?: FarcasterBodyUser | null; fid?: unknown } | null }).data;
    if (data) {
      candidates.push(data.user);
      candidates.push({ fid: data.fid });
    }
  }
  if ('trustedData' in asPayload) {
    const trusted = (asPayload as {
      trustedData?: {
        user?: FarcasterBodyUser | null;
        message?: { data?: { fid?: unknown; user?: FarcasterBodyUser | null } | null } | null;
      } | null;
    }).trustedData;
    if (trusted) {
      candidates.push(trusted.user);
      if (trusted.message?.data) {
        candidates.push(trusted.message.data.user);
        candidates.push({ fid: trusted.message.data.fid });
      }
    }
  }
  if ('message' in asPayload) {
    const message = (asPayload as { message?: { data?: { fid?: unknown; user?: FarcasterBodyUser | null } | null } | null }).message;
    if (message?.data) {
      candidates.push(message.data.user);
      candidates.push({ fid: message.data.fid });
    }
  }
  candidates.push({ fid: (payload as { fid?: unknown }).fid });

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const fidValue = Number((candidate as FarcasterBodyUser).fid);
    if (Number.isFinite(fidValue) && fidValue > 0) {
      const username = (candidate as FarcasterBodyUser).username;
      const displayName = (candidate as FarcasterBodyUser).displayName;
      const pfpUrl = (candidate as FarcasterBodyUser).pfpUrl;
      return {
        fid: Math.floor(fidValue),
        username: typeof username === 'string' ? username : undefined,
        displayName: typeof displayName === 'string' ? displayName : undefined,
        pfpUrl: typeof pfpUrl === 'string' ? pfpUrl : undefined,
      };
    }
  }

  return { fid: null };
}

export async function GET() {
  try {
    const request = await readFarcasterRequest();
    const payload = parseMaybeJson(request.payload ?? null);
    const identity = coerceUser(payload);
    if (!identity.fid) {
      return NextResponse.json(
        { ok: false },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        fid: identity.fid,
        username: identity.username,
        displayName: identity.displayName,
        pfpUrl: identity.pfpUrl,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
