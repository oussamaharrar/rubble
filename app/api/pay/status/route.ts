import { NextResponse } from 'next/server';
import { isSessionPaid } from '@/lib/pay';

const HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId')?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { granted: false, reason: 'Missing sessionId' },
      { status: 400, headers: HEADERS },
    );
  }

  return NextResponse.json(
    { granted: isSessionPaid(sessionId) },
    { headers: HEADERS },
  );
}
