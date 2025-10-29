import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';

type AnySigner = {
  status?: string;
  signer_address?: string;
  custody_address?: string;
};

type PayloadShape = {
  signer?: AnySigner;
  result?: { signer?: AnySigner; status?: string };
  status?: string;
};

const ACTIVE_STATUSES = new Set(['approved', 'active', 'enabled']);

function pickAddress(signer: AnySigner | undefined) {
  if (!signer) {
    return { address: undefined, keyUsed: 'none' as const };
  }
  if (typeof signer.signer_address === 'string') {
    const normalized = normalizeAddress(signer.signer_address);
    if (normalized) {
      return { address: normalized, keyUsed: 'signer_address' as const };
    }
  }
  if (typeof signer.custody_address === 'string') {
    const normalized = normalizeAddress(signer.custody_address);
    if (normalized) {
      return { address: normalized, keyUsed: 'custody_address' as const };
    }
  }
  return { address: undefined, keyUsed: 'none' as const };
}

function normalizeStatus(value?: string) {
  if (!value) return '';
  return value.toLowerCase();
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }

  const parsed = (payload ?? {}) as PayloadShape;
  const signer: AnySigner | undefined = parsed.signer ?? parsed.result?.signer ?? undefined;
  const status = normalizeStatus(signer?.status ?? parsed.result?.status ?? parsed.status);

  const { address, keyUsed } = pickAddress(signer);
  const ok = Boolean(address && ACTIVE_STATUSES.has(status));
  const reason = ok
    ? undefined
    : !address
    ? 'missing_address'
    : ACTIVE_STATUSES.has(status)
    ? undefined
    : `status_${status || 'unknown'}`;

  if (process.env.DIAG === 'true') {
    console.info(`SIGNER: keyUsed=${keyUsed} ok=${ok} reason=${reason ?? 'none'}`);
  }

  if (ok && address) {
    return NextResponse.json({ ok: true, address, keyUsed });
  }

  return NextResponse.json({ ok: false, reason: reason ?? 'inactive', keyUsed });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
