import { Buffer } from 'buffer';

export function normaliseAddress(address: string) {
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/u.test(trimmed)) {
    throw new Error('Invalid address');
  }
  return (trimmed.toLowerCase() as `0x${string}`);
}

function toUrlSafe(base64: string) {
  return base64.replace(/=+$/u, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromUrlSafe(base64: string) {
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat(padLength)}`;
  return padded;
}

function encodeHexToBinary(hex: string) {
  const clean = hex.length % 2 === 1 ? `0${hex}` : hex;
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 2) {
    const segment = clean.slice(index, index + 2);
    bytes.push(Number.parseInt(segment, 16));
  }
  return bytes;
}

function binaryToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function binaryToBase64(bytes: number[]) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const chars = bytes.map((value) => String.fromCharCode(value)).join('');
    return window.btoa(chars);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBinary(base64: string) {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const raw = window.atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }
  return Buffer.from(base64, 'base64');
}

export function makeReferralCode(address: string) {
  const normalized = normaliseAddress(address);
  const hex = normalized.slice(2);
  const bytes = encodeHexToBinary(hex);
  const base64 = binaryToBase64(bytes);
  return toUrlSafe(base64);
}

export function decodeReferralCode(code: string) {
  try {
    const base64 = fromUrlSafe(code.trim());
    const bytes = base64ToBinary(base64);
    const hex = binaryToHex(bytes);
    if (hex.length !== 40) {
      return null;
    }
    const address = `0x${hex}` as const;
    if (!/^0x[a-f0-9]{40}$/u.test(address)) {
      return null;
    }
    return address;
  } catch {
    return null;
  }
}
