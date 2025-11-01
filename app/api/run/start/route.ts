import { NextResponse } from 'next/server';
import { issueRunToken, RUN_TOKEN_TTL_MS } from '@/lib/server/run-token';
import { getLeaderboardConfig } from '@/lib/server/leaderboard';
import { logEvent } from '@/lib/server/telemetry';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const config = getLeaderboardConfig();
  let address: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.address === 'string') {
      address = body.address;
    }
  } catch {
    // ignore parse errors, fall through to validation
  }

  if (!address || typeof address !== 'string') {
    return json({ ok: false, error: 'address_required' }, 400);
  }

  const lowerAddress = address.toLowerCase();
  const token = issueRunToken(lowerAddress);
  logEvent('run_start_token_issue', {
    address: lowerAddress,
    issued: Boolean(token),
    hmacEnabled: Boolean(config.hmacKey),
  });

  if (!token) {
    return json({ ok: false, reason: 'hmac_unavailable' });
  }

  return json({
    ok: true,
    token: token.token,
    nonce: token.payload.nonce,
    issuedAt: token.payload.issuedAt,
    expiresAt: token.payload.issuedAt + RUN_TOKEN_TTL_MS,
  });
}
