import { NextResponse } from 'next/server';
import { isSessionPaid } from '@/lib/pay-session-store';

export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { granted: false, reason: 'MISSING_SESSION_ID' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const granted = isSessionPaid(sessionId);
  return NextResponse.json({ granted }, { headers: RESPONSE_HEADERS });
}
