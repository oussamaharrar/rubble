export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createBasePaySession } from '@/lib/pay';

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
};

const RESPONSE_HEADERS = {
  ...BASE_HEADERS,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
} as const;

type RequestBody = {
  sku?: string;
  amountWei?: string | number | bigint;
  buyerAddress?: string;
};

function parseAmount(value: RequestBody['amountWei']) {
  if (typeof value === 'undefined') {
    return ENV.MIN_PRICE_WEI;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
}

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const amount = parseAmount(body.amountWei);
  if (amount === null) {
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
    sku: body.sku,
    amountWei: amount,
    buyerAddress: body.buyerAddress,
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, session: result.session },
      { status: 200, headers: RESPONSE_HEADERS }
    );
  }

  const status =
    result.code === 'NO_API_BASE' || result.code === 'NO_API_KEYS' ? 500 : 502;

  return NextResponse.json(
    {
      ok: false,
      reason: result.code,
      error: result.detail,
      status: result.status,
    },
    { status, headers: RESPONSE_HEADERS }
  );
}
