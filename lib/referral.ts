const REF_PREFIX = '0x';

function hexToBytes(hex: string) {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const length = normalized.length / 2;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = parseInt(normalized.substr(index * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function encodeBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  return base64;
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(value, 'base64url'));
    }
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const paddedValue = `${padded}${'='.repeat(padLength)}`;
    const binary = atob(paddedValue);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeReferralCode(address: string) {
  const trimmed = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/u.test(trimmed)) {
    throw new Error('Expected a 0x-prefixed address');
  }
  const bytes = hexToBytes(trimmed.slice(2));
  return encodeBase64Url(bytes).replace(/=+$/u, '');
}

export function decodeReferralCode(code: string): string | null {
  const cleaned = code.trim();
  if (!cleaned) {
    return null;
  }
  const bytes = decodeBase64Url(cleaned);
  if (!bytes) {
    return null;
  }
  const hex = bytesToHex(bytes);
  if (hex.length !== 40) {
    return null;
  }
  return `${REF_PREFIX}${hex}` as const;
}
