import { NextResponse } from 'next/server';

const SIGNER_KEYS = [
  'FARCASTER_SIGNER_UUID',
  'FARCASTER_SIGNER_PUBLIC_KEY',
  'FARCASTER_SIGNER_PRIVATE_KEY',
  'FARCASTER_SIGNER_TOKEN',
  'FARCASTER_SIGNER_DELEGATION',
  'FARCASTER_SIGNER_SIGNATURE',
  'NEYNAR_API_KEY',
  'NEYNAR_CLIENT_ID',
  'NEYNAR_CLIENT_SECRET',
  'NEYNAR_API_BASE',
] as const;

export async function GET() {
  const presence = Object.fromEntries(
    SIGNER_KEYS.map((key) => [key, Boolean(process.env[key as keyof NodeJS.ProcessEnv])])
  );

  return NextResponse.json(
    {
      signer: presence,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
