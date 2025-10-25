import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { createBasePaySession } from '@/lib/pay';

const allowOrigin = ENV.NEXT_PUBLIC_URL.replace(/\/$/, '');
const HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  Vary: 'Origin',
};

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sku?: string;
      amountWei?: string;
    };

    const sku = body.sku?.trim() || 'rubble-booster';
    const amountWei = body.amountWei?.trim() || ENV.MIN_PRICE_WEI;

    const session = await createBasePaySession({ sku, amountWei });

    return NextResponse.json(
      {
        ok: true,
        session,
      },
      { headers: HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Base Pay session';
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500, headers: HEADERS },
    );
  }
}
