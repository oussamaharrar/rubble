export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createPaymentCommerce, createPaymentNativeBase } from '@/lib/pay';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

type SessionRequestBody = {
  sku?: unknown;
  amountWei?: unknown;
};

type ParsedBody = {
  sku: string;
  amountWei: bigint;
};

function parseAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function parseBody(input: SessionRequestBody): ParsedBody | null {
  const skuValue =
    typeof input.sku === 'string' && input.sku.trim().length > 0
      ? input.sku.trim()
      : 'booster_time_freeze';

  const amountSource = input.amountWei ?? ENV.MIN_PRICE_WEI;
  const amount = parseAmount(amountSource);
  if (amount === null) {
    return null;
  }
  return { sku: skuValue, amountWei: amount };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as SessionRequestBody;
  const parsed = parseBody(body);

  if (!parsed) {
    return NextResponse.json(
      { ok: false, reason: 'BAD_REQUEST', error: 'Invalid amount' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (parsed.amountWei < ENV.MIN_PRICE_WEI) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'BAD_REQUEST',
        error: `Amount must be at least ${ENV.MIN_PRICE_WEI.toString()} wei`,
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const modeBEnabled = ENV.PAYMENTS_MODE_B_ENABLED;

  if (modeBEnabled) {
    const commerce = await createPaymentCommerce({ sku: parsed.sku, amountWei: parsed.amountWei });
    if (commerce.ok) {
      return NextResponse.json(
        { ok: true, session: commerce.session },
        { headers: NO_STORE_HEADERS }
      );
    }
    const status =
      commerce.code === 'API_NON_2XX'
        ? commerce.status ?? 502
        : commerce.code === 'MODE_B_DISABLED'
          ? 500
          : 502;
    const detail = 'detail' in commerce ? commerce.detail : undefined;
    return NextResponse.json(
      { ok: false, reason: commerce.code, error: detail },
      { status, headers: NO_STORE_HEADERS }
    );
  }

  const native = await createPaymentNativeBase({
    amountWei: parsed.amountWei,
    to: ENV.PAY_TO_ADDRESS,
  });

  if (native.ok) {
    return NextResponse.json(
      { ok: true, intent: native.intent },
      { headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    { ok: false, reason: native.code, error: native.detail },
    { status: 400, headers: NO_STORE_HEADERS }
  );
}
