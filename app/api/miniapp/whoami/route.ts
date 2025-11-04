import { NextResponse } from 'next/server';
import { readFarcasterRequest, verifyRequiredHeaders } from '@/lib/farcaster';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

type RawPayload = Record<string, unknown> | null;

type ParsedIdentity = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

function toNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.trunc(numeric);
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractIdentity(payload: RawPayload): ParsedIdentity {
  if (!payload) {
    return { fid: null, username: null, displayName: null, pfpUrl: null };
  }
  const maybeFid =
    toNumber((payload.untrustedData as RawPayload)?.fid) ??
    toNumber((payload.trustedData as RawPayload)?.fid) ??
    toNumber(((payload.trustedData as RawPayload)?.message as RawPayload)?.fid) ??
    toNumber(
      (((payload.trustedData as RawPayload)?.message as RawPayload)?.data as RawPayload)?.fid ??
        ((payload.message as RawPayload)?.data as RawPayload)?.fid,
    );

  const profileSource =
    (payload.untrustedData as RawPayload)?.profile ??
    ((payload.trustedData as RawPayload)?.message as RawPayload)?.data ??
    (payload.profile as RawPayload);

  const username =
    toStringValue((profileSource as RawPayload)?.username) ??
    toStringValue((payload.untrustedData as RawPayload)?.username) ??
    toStringValue((payload.profile as RawPayload)?.username);

  const displayName =
    toStringValue((profileSource as RawPayload)?.displayName) ??
    toStringValue((payload.untrustedData as RawPayload)?.displayName) ??
    toStringValue((payload.profile as RawPayload)?.displayName);

  const pfpUrl =
    toStringValue((profileSource as RawPayload)?.pfpUrl) ??
    toStringValue((payload.untrustedData as RawPayload)?.pfpUrl) ??
    toStringValue((payload.profile as RawPayload)?.pfpUrl);

  return {
    fid: maybeFid,
    username,
    displayName,
    pfpUrl,
  };
}

export async function GET() {
  try {
    const request = await readFarcasterRequest();
    verifyRequiredHeaders(request);
    if (!request.payload) {
      return NextResponse.json({ ok: false, reason: 'missing_payload' }, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }
    let parsed: RawPayload = null;
    try {
      parsed = JSON.parse(request.payload) as RawPayload;
    } catch (error) {
      console.warn('[miniapp] invalid Farcaster payload', error);
      return NextResponse.json({ ok: false, reason: 'invalid_payload' }, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const identity = extractIdentity(parsed);
    if (identity.fid === null) {
      return NextResponse.json({ ok: false, reason: 'missing_fid' }, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        fid: identity.fid,
        username: identity.username,
        displayName: identity.displayName,
        pfpUrl: identity.pfpUrl,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.warn('[miniapp] Farcaster whoami failed', error);
    return NextResponse.json({ ok: false, reason: 'not_farcaster' }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }
}
