export function shortenAddress(address: string, options?: { leading?: number; trailing?: number }) {
  const leading = options?.leading ?? 4;
  const trailing = options?.trailing ?? 4;

  if (!address || address.length <= leading + trailing + 3) {
    return address;
  }

  const start = address.slice(0, leading);
  const end = address.slice(-trailing);
  return `${start}…${end}`;
}

export function normalizeAddress(address: string | null | undefined) {
  if (!address) return null;
  return address.toLowerCase();
}
