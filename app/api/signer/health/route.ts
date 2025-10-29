import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
};

const HEALTH_CHAIN_ID = 8453;

function hasValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normaliseReason(reason: unknown) {
  if (!reason) return undefined;
  if (typeof reason === 'string') return reason;
  return JSON.stringify(reason);
}

export async function GET() {
  const ownerAddress = hasValue(process.env.PUBLIC_OWNER_ADDRESS)
    ? process.env.PUBLIC_OWNER_ADDRESS.trim()
    : null;
  const signerUuid = hasValue(process.env.FARCASTER_SIGNER_UUID)
    ? process.env.FARCASTER_SIGNER_UUID.trim()
    : null;
  const neynarKey = hasValue(process.env.NEYNAR_API_KEY)
    ? process.env.NEYNAR_API_KEY.trim()
    : null;
  const signerPublicKey = hasValue(process.env.FARCASTER_SIGNER_PUBLIC_KEY)
    ? process.env.FARCASTER_SIGNER_PUBLIC_KEY.trim()
    : null;

  const payload: { ok: boolean; address?: string; chainId: number; reason?: string } = {
    ok: false,
    chainId: HEALTH_CHAIN_ID,
  };

  if (ownerAddress) {
    payload.address = ownerAddress;
  }

  if (!signerUuid || !neynarKey) {
    const missing = !signerUuid && !neynarKey
      ? 'FARCASTER_SIGNER_UUID and NEYNAR_API_KEY missing'
      : !signerUuid
        ? 'FARCASTER_SIGNER_UUID missing'
        : 'NEYNAR_API_KEY missing';
    payload.reason = ownerAddress ? missing : `${missing}; PUBLIC_OWNER_ADDRESS missing`;
    return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
  }

  try {
    const endpoint = new URL('https://api.neynar.com/v2/farcaster/signer');
    endpoint.searchParams.set('signer_uuid', signerUuid);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'api-key': neynarKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = response.status === 404 ? 'Signer not found' : `Neynar ${response.status}`;
      payload.reason = ownerAddress ? reason : `${reason}; PUBLIC_OWNER_ADDRESS missing`;
      return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const signerRecord =
      (data.result && typeof data.result === 'object' && (data.result as Record<string, unknown>).signer)
        || (Array.isArray((data as Record<string, unknown>).signers)
          ? (data as Record<string, unknown>).signers?.[0]
          : undefined)
        || (data as Record<string, unknown>).signer;

    let status: string | undefined;
    let derivedAddress: string | undefined;

    if (signerRecord && typeof signerRecord === 'object') {
      const record = signerRecord as Record<string, unknown>;
      const rawStatus = record.status ?? record.state ?? record.approved;
      status = typeof rawStatus === 'string' ? rawStatus : undefined;
      const addressCandidate =
        record.signer_address ?? record.custody_address ?? record.address ?? signerPublicKey ?? undefined;
      if (typeof addressCandidate === 'string') {
        derivedAddress = addressCandidate;
      }
    }

    if (derivedAddress && !payload.address) {
      payload.address = derivedAddress;
    }

    const healthyStatuses = ['approved', 'active', 'ready', 'registered', 'enabled'];
    const statusLabel = status ? status.toLowerCase() : undefined;
    const isHealthy = statusLabel ? healthyStatuses.includes(statusLabel) : Boolean(derivedAddress);

    if (isHealthy && ownerAddress) {
      payload.ok = true;
      return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
    }

    const reason = statusLabel ? `Signer status: ${status}` : 'Unable to confirm signer status';
    payload.reason = ownerAddress ? reason : `${reason}; PUBLIC_OWNER_ADDRESS missing`;
    return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const reason = normaliseReason((error as Error)?.message ?? error);
    payload.reason = ownerAddress ? `Network error: ${reason}` : `Network error: ${reason}; PUBLIC_OWNER_ADDRESS missing`;
    return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
  }
}
