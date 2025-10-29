import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_CHAIN_ID = 8453;

type HealthResponse = {
  ok: boolean;
  address?: string;
  chainId?: number;
  reason?: string;
};

type AnySigner = { status?: string; signer_address?: string; custody_address?: string };

function normalizeAddress(address: string | undefined) {
  if (!address) return undefined;
  const trimmed = address.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOwnerAddress() {
  return (
    normalizeAddress(process.env.PUBLIC_OWNER_ADDRESS) ??
    normalizeAddress(process.env.BASE_BUILDER_OWNER_ADDRESS) ??
    undefined
  );
}

async function fetchNeynarStatus(uuid: string, apiKey: string) {
  const endpoint = `https://api.neynar.com/v2/farcaster/signer/${encodeURIComponent(uuid)}`;
  const response = await fetch(endpoint, {
    headers: {
      accept: 'application/json',
      api_key: apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = response.status === 404 ? 'SIGNER_NOT_FOUND' : `API_${response.status}`;
    return { ok: false as const, reason };
  }

  try {
    const p = (await response.json()) as {
      signer?: AnySigner;
      result?: { signer?: AnySigner; status?: string };
      status?: string;
    };
    const signer: AnySigner | undefined = p.signer ?? p.result?.signer ?? undefined;
    const status = (signer?.status ?? p.result?.status ?? p.status ?? '').toLowerCase();
    const rawAddress =
      (typeof signer?.signer_address === 'string' && signer.signer_address) ||
      (typeof signer?.custody_address === 'string' && signer.custody_address) ||
      undefined;
    const address = normalizeAddress(rawAddress);
    const addressSource =
      rawAddress && typeof signer?.signer_address === 'string' && rawAddress === signer.signer_address
        ? 'signer_address'
        : rawAddress && typeof signer?.custody_address === 'string' && rawAddress === signer.custody_address
          ? 'custody_address'
          : 'none';
    if ((process.env.DIAG ?? '').toLowerCase() === 'true') {
      console.info('[signer-health] address source:', addressSource);
    }
    const statusSuggestsActive = status === 'approved' || status === 'active' || status === 'enabled';
    if (statusSuggestsActive && !address) {
      return { ok: false as const, reason: 'ADDRESS_MISSING', address: undefined };
    }
    const active = statusSuggestsActive && !!address;
    if (active) {
      return { ok: true as const, address };
    }
    const reason = status ? `STATUS_${status}` : 'STATUS_UNKNOWN';
    return { ok: false as const, reason, address };
  } catch {
    return { ok: false as const, reason: 'PARSE_ERROR' };
  }
}

export async function GET() {
  const signerUuid = normalizeAddress(process.env.FARCASTER_SIGNER_UUID ?? process.env.SIGNER_UUID);
  const apiKey = normalizeAddress(process.env.NEYNAR_API_KEY ?? process.env.FARCASTER_NEYNAR_API_KEY);
  const ownerAddress = getOwnerAddress();

  if (!signerUuid || !apiKey) {
    return NextResponse.json<HealthResponse>(
      {
        ok: false,
        address: ownerAddress,
        chainId: ownerAddress ? BASE_CHAIN_ID : undefined,
        reason: 'SIGNER_ENV_MISSING',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const status = await fetchNeynarStatus(signerUuid, apiKey);
    if (status.ok) {
      return NextResponse.json<HealthResponse>(
        {
          ok: true,
          address: status.address ?? ownerAddress,
          chainId: BASE_CHAIN_ID,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json<HealthResponse>(
      {
        ok: false,
        address: status.address ?? ownerAddress,
        chainId: ownerAddress ? BASE_CHAIN_ID : undefined,
        reason: status.reason,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json<HealthResponse>(
      {
        ok: false,
        address: ownerAddress,
        chainId: ownerAddress ? BASE_CHAIN_ID : undefined,
        reason: `NETWORK_ERROR:${reason}`,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

