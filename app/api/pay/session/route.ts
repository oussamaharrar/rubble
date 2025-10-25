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
  try {
    const body = (await request.json().catch(() => ({}))) as SessionRequestBody;
    const sku = body.sku ?? 'booster_time_freeze';
    const rawAmount = body.amountWei ?? ENV.MIN_PRICE_WEI;
    const amount = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount);

    if (amount < ENV.MIN_PRICE_WEI) {
      return NextResponse.json(
        { ok: false, reason: 'UNDER_MINIMUM_AMOUNT' },
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }

    const session = await createBasePaySession({
      sku,
      amountWei: amount,
      buyerAddress: body.buyerAddress,
    });

    return NextResponse.json(
      {
        ok: true,
        session,
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, reason: 'SESSION_CREATION_FAILED', message },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
