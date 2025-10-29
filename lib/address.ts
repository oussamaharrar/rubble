export function shortenAddress(address: string) {
  if (address.length <= 10) return address;
  const start = address.slice(0, 4);
  const end = address.slice(-4);
  return `${start}…${end}`;
}
