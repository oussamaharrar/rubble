import { headers } from 'next/headers';

interface FarcasterRequest {
  payload: string | null;
  signature: string | null;
  header: string | null;
}

export async function readFarcasterRequest(): Promise<FarcasterRequest> {
  const headerName = process.env.FARCASTER_HEADER ?? 'FC-Request';
  const payloadHeader = process.env.FARCASTER_PAYLOAD ?? 'fc-request-body';
  const signatureHeader = process.env.FARCASTER_SIGNATURE ?? 'fc-request-signature';
  const headerStore = await headers();

  return {
    payload: headerStore.get(payloadHeader),
    signature: headerStore.get(signatureHeader),
    header: headerStore.get(headerName),
  };
}

export function verifyRequiredHeaders(req: FarcasterRequest) {
  if (!req.payload || !req.signature) {
    throw new Error('Missing Farcaster verification headers');
  }
}
