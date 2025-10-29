import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

const CHAIN_ID = 8453;

function parseSignerResponse(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const result = (payload as { result?: Record<string, unknown> }).result;
  if (!result || typeof result !== 'object') {
    return {};
  }

  const signer = result.signer as Record<string, unknown> | undefined;
  if (!signer) {
    return {};
  }

  const addressCandidate =
    typeof signer.address === 'string'
      ? signer.address
      : typeof signer.owner === 'string'
        ? signer.owner
        : typeof signer.custody_address === 'string'
          ? signer.custody_address
          : undefined;
  const status = typeof signer.status === 'string' ? signer.status : undefined;
  return { address: addressCandidate, status };
}

export async function GET() {
  const env = getEnv();
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  const neynarKey = process.env.NEYNAR_API_KEY;

  if (!signerUuid) {
    return NextResponse.json(
      { ok: false, reason: 'FARCASTER_SIGNER_UUID missing' },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  }

  if (!neynarKey) {
    return NextResponse.json(
      { ok: false, reason: 'NEYNAR_API_KEY missing' },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  }

  const base = process.env.NEYNAR_API_BASE ?? 'https://api.neynar.com/v2';
  const endpoint = `${base.replace(/\/$/, '')}/farcaster/signer/${signerUuid}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        api_key: neynarKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, reason: `Signer lookup failed (${response.status})` },
        { headers: { 'Cache-Control': 'public, max-age=120' } }
      );
    }

    const payload = await response.json();
    const { address, status } = parseSignerResponse(payload);

    if (status && status.toLowerCase() !== 'approved') {
      return NextResponse.json(
        { ok: false, reason: `Signer status ${status}` },
        { headers: { 'Cache-Control': 'public, max-age=60' } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        address: env.PUBLIC_OWNER_ADDRESS ?? address ?? env.BASE_BUILDER_OWNER_ADDRESS,
        chainId: CHAIN_ID,
      },
      { headers: { 'Cache-Control': 'public, max-age=120' } }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, reason: `Network error: ${reason}` },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  }
}
