import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SIGNER_ENV_KEYS = [
  'FARCASTER_SIGNER_UUID',
  'FARCASTER_SIGNER_PUBLIC_KEY',
  'FARCASTER_SIGNER_PRIVATE_KEY',
  'FARCASTER_SIGNER_SECRET',
  'NEYNAR_API_KEY',
  'PUBLIC_OWNER_ADDRESS',
  'TRIAL_SIGN_KEY',
];

function present(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function GET() {
  const status: Record<string, boolean> = {};
  for (const key of SIGNER_ENV_KEYS) {
    status[key] = present(process.env[key as keyof NodeJS.ProcessEnv]);
  }

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      signer: status,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
