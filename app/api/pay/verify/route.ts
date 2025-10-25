import { NextResponse } from 'next/server';
import { isHex } from 'viem';
import { basePublicClient } from '@/lib/base';
import { ENV } from '@/lib/env';

const allowOrigin = ENV.NEXT_PUBLIC_URL.replace(/\/$/, '');

const HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  Vary: 'Origin',
};

type VerifyBody = {
  txHash?: string;
  minWei?: string;
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const body: VerifyBody = await request.json();
    if (!body?.txHash || !isHex(body.txHash)) {
      return NextResponse.json(
        { ok: false, reason: 'INVALID_HASH' },
        { status: 400, headers: HEADERS }
      );
    }

    const hash = body.txHash as `0x${string}`;
    const receipt = await basePublicClient.getTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { ok: false, reason: 'TX_NOT_SUCCESS' },
        { status: 400, headers: HEADERS }
      );
    }

    const transaction = await basePublicClient.getTransaction({ hash });
    const recipient = (transaction.to ?? '').toLowerCase();
    const expectedRecipient = ENV.PAY_TO_ADDRESS.toLowerCase();

    if (recipient !== expectedRecipient) {
      return NextResponse.json(
        { ok: false, reason: 'WRONG_RECIPIENT', actual: transaction.to },
        { status: 400, headers: HEADERS }
      );
    }

    const paidValue = BigInt(transaction.value);
    const minRequired = BigInt(body.minWei ?? ENV.MIN_PRICE_WEI);

    if (paidValue < minRequired) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'UNDERPAID',
          paid: paidValue.toString(),
          expected: minRequired.toString(),
        },
        { status: 400, headers: HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        hash,
        value: paidValue.toString(),
      },
      { headers: HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json(
      { ok: false, reason: 'INVALID_REQUEST', error: message },
      { status: 400, headers: HEADERS }
    );
  }
}
