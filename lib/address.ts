export function shortenAddress(address: string | null | undefined) {
  if (!address) return '';
  const normalized = address.trim();
  if (normalized.length <= 10) {
    return normalized;
  }
  const prefix = normalized.slice(0, 6);
  const suffix = normalized.slice(-4);
  return `${prefix}…${suffix}`;
}
