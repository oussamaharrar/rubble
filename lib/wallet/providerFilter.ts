export const DISALLOWED_WALLETS = ['app.warpcast', 'xyz.farcaster', 'embedded.wallet'] as const;

type ProviderDescriptor = { rdns?: string | null; name?: string | null } | null | undefined;

function normalize(value: string | null | undefined) {
  return typeof value === 'string' && value.length > 0 ? value.toLowerCase() : '';
}

export function isDisallowed(providerInfo?: ProviderDescriptor): boolean {
  const rdns = normalize(providerInfo?.rdns);
  const name = normalize(providerInfo?.name);
  if (!rdns && !name) {
    return false;
  }
  return DISALLOWED_WALLETS.some((entry) => {
    const target = entry.toLowerCase();
    return (rdns && rdns.includes(target)) || (name && name.includes(target));
  });
}
