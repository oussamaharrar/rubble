export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createBasePaySession } from '@/lib/pay';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

type SessionRequestBody = {
  sku?: unknown;
  amountWei?: unknown;
  buyerAddress?: unknown;
};

function parseAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: SessionRequestBody = {};
  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    body = {};
  }

  const rawAmount = body.amountWei ?? ENV.MIN_PRICE_WEI;
  const parsedAmount = parseAmount(rawAmount);
  if (parsedAmount === null) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_AMOUNT' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (parsedAmount < ENV.MIN_PRICE_WEI) {
    return NextResponse.json(
      { ok: false, reason: 'UNDER_MINIMUM_AMOUNT' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const sku =
    typeof body.sku === 'string' && body.sku.trim().length > 0
      ? body.sku
      : 'booster_time_freeze';

  const buyerAddress =
    typeof body.buyerAddress === 'string' && body.buyerAddress.length > 0
      ? body.buyerAddress
      : undefined;

  const result = await createBasePaySession({
    sku,
    amountWei: parsedAmount,
    buyerAddress,
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, session: result.session },
      { headers: NO_STORE_HEADERS }
    );
  }

  const status =
    result.code === 'NO_API_BASE' || result.code === 'NO_API_KEYS' ? 500 : 502;

  return NextResponse.json(
    { ok: false, reason: result.code, error: result.detail },
    { status, headers: NO_STORE_HEADERS }
  );
}
