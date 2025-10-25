export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createBasePaySession } from '@/lib/pay';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
} as const;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sku?: unknown;
    amountWei?: unknown;
  };

  const sku = typeof body.sku === 'string' && body.sku ? body.sku : undefined;

  let normalizedAmount: string | undefined;
  if (typeof body.amountWei !== 'undefined') {
    try {
      const amountBigInt = BigInt(body.amountWei as never);
      if (amountBigInt <= 0n) {
        return NextResponse.json(
          { ok: false, reason: 'INVALID_AMOUNT', error: 'Amount must be positive' },
          { status: 400, headers: RESPONSE_HEADERS }
        );
      }
      if (amountBigInt < ENV.MIN_PRICE_WEI) {
        return NextResponse.json(
          { ok: false, reason: 'UNDER_MINIMUM_AMOUNT', error: 'Amount below minimum' },
          { status: 400, headers: RESPONSE_HEADERS }
        );
      }
      normalizedAmount = amountBigInt.toString();
    } catch {
      return NextResponse.json(
        { ok: false, reason: 'INVALID_AMOUNT', error: 'Amount must be numeric' },
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }
  }

  const result = await createBasePaySession({ sku, amountWei: normalizedAmount });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, session: result.session },
      { headers: RESPONSE_HEADERS }
    );
  }
  const status = result.status ?? (result.code === 'NO_API_BASE' || result.code === 'NO_API_KEYS' ? 500 : 502);
  return NextResponse.json(
    { ok: false, reason: result.code, error: result.detail },
    { status, headers: RESPONSE_HEADERS }
  );
}
