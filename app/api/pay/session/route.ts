export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createBasePaySession } from '@/lib/pay';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}

type SessionRequestBody = {
  sku?: string;
  amountWei?: string | number | bigint;
  buyerAddress?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SessionRequestBody;
  const sku = body.sku ?? 'booster_time_freeze';
  const rawAmount = body.amountWei ?? ENV.MIN_PRICE_WEI;

  let amount: bigint;
  try {
    amount = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount);
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_AMOUNT' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  if (amount < ENV.MIN_PRICE_WEI) {
    return NextResponse.json(
      { ok: false, reason: 'UNDER_MINIMUM_AMOUNT' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const result = await createBasePaySession({
    sku,
    amountWei: amount.toString(),
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, session: result.session },
      { headers: RESPONSE_HEADERS }
    );
  }

  const status = result.status ?? (result.code === 'NO_API_BASE' || result.code === 'NO_API_KEYS' ? 500 : 502);
  return NextResponse.json(
    {
      ok: false,
      reason: result.code,
      error: result.detail,
    },
    { status, headers: RESPONSE_HEADERS }
  );
}
