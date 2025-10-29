export function normalizeAddress(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/u.test(trimmed)) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

export function shortenAddress(address: string | null | undefined) {
  if (!address) return '';
  const normalized = normalizeAddress(address) ?? address.trim();
  if (normalized.length <= 10) {
    return normalized;
  }
  const prefix = normalized.slice(0, 6);
  const suffix = normalized.slice(-4);
  return `${prefix}…${suffix}`;
}
