import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SIGNER_ENV_KEYS = [
  'FARCASTER_SIGNER_UUID',
  'NEYNAR_API_KEY',
  'FARCASTER_ACCOUNT_HEADER',
  'FARCASTER_ACCOUNT_PAYLOAD',
  'FARCASTER_ACCOUNT_SIGNATURE',
  'PUBLIC_OWNER_ADDRESS',
  'TRIAL_SIGN_KEY',
];

export async function GET() {
  const envReport = Object.fromEntries(
    SIGNER_ENV_KEYS.map((key) => [
      key,
      Boolean(process.env[key] && String(process.env[key]).length > 0),
    ])
  );

  return NextResponse.json(
    { ok: true, env: envReport },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

